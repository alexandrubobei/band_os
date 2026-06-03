import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { debounceTime, Subscription } from 'rxjs';
import * as M from '../models/models';
import { WORKSPACE_REPOSITORY, WorkspaceRepository, WorkspaceRepositoryException } from '../repos/workspace-repository';
import { AuthController } from './auth-controller.service';
import { AsyncState } from './async-state';
import { PresenceService } from '../services/presence.service';
import { ActivityLogService } from '../services/activity-log.service';

@Injectable({ providedIn: 'root' })
export class WorkspaceController {
  private readonly repo = inject(WORKSPACE_REPOSITORY) as WorkspaceRepository;
  private readonly auth = inject(AuthController);
  private readonly presence = inject(PresenceService);
  private readonly activityLog = inject(ActivityLogService);

  private realtimeSyncUnsubscribe: Subscription | null = null;

  readonly state = signal<AsyncState<M.BandWorkspace | null>>(AsyncState.loading());
  readonly memberships = signal<AsyncState<M.BandWorkspace[]>>(AsyncState.loading());
  readonly pendingAccess = signal<AsyncState<M.PendingWorkspaceAccess | null>>(AsyncState.loading());
  readonly hydratedUserId = signal<string | null>(null);
  readonly pendingHydratedUserId = signal<string | null>(null);
  readonly bandSetupEntryContext = signal<{ mode: 'create' | 'join' | null } | null>(null);

  readonly workspace = computed(() => AsyncState.valueOrNull(this.state()));

  get supportsRemoteInviteDelivery(): boolean { return this.repo.supportsRemoteInviteDelivery; }
  get supportsWorkspaceLogoUpload(): boolean { return this.repo.supportsWorkspaceLogoUpload; }
  get supportsSongAudioUpload(): boolean { return this.repo.supportsSongAudioUpload; }

  constructor() {
    effect(() => {
      const auth = this.auth.state();
      if (auth.kind !== 'data') return;
      const user = auth.value;
      if (!user) {
        this.state.set(AsyncState.data(null));
        this.memberships.set(AsyncState.data([]));
        this.pendingAccess.set(AsyncState.data(null));
        this.hydratedUserId.set(null);
        this.pendingHydratedUserId.set(null);
        this.stopRealtimeSync();
        return;
      }
      void this.hydrateFor(user);
    }, { allowSignalWrites: true });

    // Set up real-time sync when workspace loads
    effect(() => {
      const ws = this.workspace();
      if (ws) {
        this.initializeRealtimeSync(ws.id);
        this.presence.startPresenceTracking(ws.id);
        this.activityLog.startActivityTracking(ws.id);
      } else {
        this.stopRealtimeSync();
        this.presence.stopPresenceTracking();
        this.activityLog.stopActivityTracking();
      }
    }, { allowSignalWrites: true });
  }

  private async hydrateFor(user: M.AuthUser): Promise<void> {
    this.state.set(AsyncState.loading());
    this.memberships.set(AsyncState.loading());
    this.pendingAccess.set(AsyncState.loading());
    try {
      const [ws, memberships, pending] = await Promise.all([
        this.repo.loadWorkspace(user),
        this.repo.loadUserWorkspaces(user),
        this.repo.loadPendingAccess(user),
      ]);
      this.state.set(AsyncState.data(ws));
      this.memberships.set(AsyncState.data(memberships));
      this.pendingAccess.set(AsyncState.data(pending));
      this.hydratedUserId.set(user.id);
      this.pendingHydratedUserId.set(user.id);
    } catch (err: any) {
      this.state.set(AsyncState.error(err?.message ?? 'Failed to load workspace'));
    }
  }

  async refreshMemberships(): Promise<void> {
    const user = this.auth.user;
    if (!user) return;
    try {
      const memberships = await this.repo.loadUserWorkspaces(user);
      this.memberships.set(AsyncState.data(memberships));
    } catch (err: any) {
      this.memberships.set(AsyncState.error(err?.message ?? 'Failed to load memberships'));
    }
  }

  async resolvePendingForStartup(): Promise<void> {
    const user = this.auth.user;
    if (!user) return;
    try {
      const pending = await this.repo.loadPendingAccess(user);
      this.pendingAccess.set(AsyncState.data(pending));
      this.pendingHydratedUserId.set(user.id);
    } catch (err: any) {
      this.pendingAccess.set(AsyncState.error(err?.message ?? 'Failed to load pending access'));
    }
  }

  setBandSetupEntryContext(ctx: { mode: 'create' | 'join' | null } | null) { this.bandSetupEntryContext.set(ctx); }

  async createWorkspace(args: { bandName: string; genre: string }): Promise<M.BandWorkspace> {
    const user = this.requireUser();
    const ws = await this.repo.createWorkspace({ user, bandName: args.bandName, genre: args.genre });
    await this.auth.finalizePendingSignUp();
    this.state.set(AsyncState.data(ws));
    await this.refreshMemberships();
    return ws;
  }

  async joinWorkspace(inviteCode: string): Promise<{ outcome: M.JoinWorkspaceOutcome; pending?: M.PendingWorkspaceAccess | null }> {
    const user = this.requireUser();
    const pending = await this.repo.joinWorkspace({ user, inviteCode });
    await this.auth.finalizePendingSignUp();
    if (pending == null) {
      await this.hydrateFor(user);
      return { outcome: M.JoinWorkspaceOutcome.joinedWorkspace };
    }
    this.pendingAccess.set(AsyncState.data(pending));
    return { outcome: M.JoinWorkspaceOutcome.pendingApproval, pending };
  }

  async selectWorkspace(workspaceId: string): Promise<void> {
    const user = this.requireUser();
    const ws = await this.repo.selectWorkspace({ user, workspaceId });
    this.state.set(AsyncState.data(ws));
  }

  async leaveWorkspace(): Promise<void> {
    const user = this.requireUser();
    const ws = this.workspace();
    if (!ws) return;
    await this.repo.leaveWorkspace({ user, workspace: ws });
    await this.hydrateFor(user);
  }

  async clearDeclinedPendingAccess(): Promise<void> {
    const user = this.requireUser();
    await this.repo.clearDeclinedPendingAccess(user);
    this.pendingAccess.set(AsyncState.data(null));
  }

  /**
   * Initialize real-time sync for workspace changes
   * Subscribes to watchWorkspace() observable with debouncing
   */
  private initializeRealtimeSync(workspaceId: string): void {
    // Stop previous subscription if exists
    this.stopRealtimeSync();

    const user = this.auth.user;
    if (!user) return;

    try {
      const watchObservable = this.repo.watchWorkspace?.({ workspaceId, currentUserId: user.id });
      if (watchObservable) {
        this.realtimeSyncUnsubscribe = watchObservable
          .pipe(debounceTime(150)) // Debounce rapid updates to prevent UI thrashing
          .subscribe({
            next: (updated) => {
              if (updated) {
                this.apply(updated);
              }
            },
            error: (error) => {
              console.error('Real-time sync error:', error);
              // Don't set error state - real-time is optional, app still works with manual refreshes
            },
          });
      }
    } catch (error) {
      console.error('Error setting up real-time sync:', error);
    }
  }

  /**
   * Stop real-time sync subscription
   */
  private stopRealtimeSync(): void {
    if (this.realtimeSyncUnsubscribe) {
      this.realtimeSyncUnsubscribe.unsubscribe();
      this.realtimeSyncUnsubscribe = null;
    }
  }

  /** Apply a workspace mutation returned by the repo. */
  private apply(ws: M.BandWorkspace): M.BandWorkspace {
    this.state.set(AsyncState.data(ws));
    return ws;
  }

  async saveSong(song: M.Song) {
    const user = this.requireUser();
    const existingSong = this.workspace()?.songs.find(s => s.id === song.id);
    const result = await this.mutate(ws => this.repo.saveSong({ workspace: ws, song }));
    await this.activityLog.logActivity(
      user.id,
      user.displayName,
      existingSong ? 'updated' : 'created',
      'song',
      song.id,
      song.title
    );
    return result;
  }

  async deleteSong(songId: string) {
    const user = this.requireUser();
    const song = this.workspace()?.songs.find(s => s.id === songId);
    const result = await this.mutate(ws => this.repo.deleteSong({ workspace: ws, songId }));
    if (song) {
      await this.activityLog.logActivity(
        user.id,
        user.displayName,
        'deleted',
        'song',
        song.id,
        song.title
      );
    }
    return result;
  }
  saveSongs(songs: M.Song[]) { return this.mutate(ws => this.repo.saveSongs({ workspace: ws, songs })); }
  updateSongAudio(song: M.Song, audioBytes: ArrayBuffer, originalFileName: string) { return this.mutate(ws => this.repo.updateSongAudio({ workspace: ws, song, audioBytes, originalFileName })); }
  clearSongAudio(song: M.Song) { return this.mutate(ws => this.repo.clearSongAudio({ workspace: ws, song })); }

  async saveSetlist(setlist: M.BandSetlist) {
    const user = this.requireUser();
    const existingSetlist = this.workspace()?.setlists.find(s => s.id === setlist.id);
    const result = await this.mutate(ws => this.repo.saveSetlist({ workspace: ws, setlist }));
    await this.activityLog.logActivity(
      user.id,
      user.displayName,
      existingSetlist ? 'updated' : 'created',
      'setlist',
      setlist.id,
      setlist.title
    );
    return result;
  }

  async deleteSetlist(setlistId: string) {
    const user = this.requireUser();
    const setlist = this.workspace()?.setlists.find(s => s.id === setlistId);
    const result = await this.mutate(ws => this.repo.deleteSetlist({ workspace: ws, setlistId }));
    if (setlist) {
      await this.activityLog.logActivity(
        user.id,
        user.displayName,
        'deleted',
        'setlist',
        setlist.id,
        setlist.title
      );
    }
    return result;
  }

  saveRelease(release: M.SongRelease) { return this.mutate(ws => this.repo.saveRelease({ workspace: ws, release })); }
  deleteRelease(releaseId: string) { return this.mutate(ws => this.repo.deleteRelease({ workspace: ws, releaseId })); }
  saveReleases(releases: M.SongRelease[]) { return this.mutate(ws => this.repo.saveReleases({ workspace: ws, releases })); }

  async saveEvent(event: M.BandEvent) {
    const user = this.requireUser();
    const existingEvent = this.workspace()?.events.find(e => e.id === event.id);
    const result = await this.mutate(ws => this.repo.saveEvent({ workspace: ws, event }));
    await this.activityLog.logActivity(
      user.id,
      user.displayName,
      existingEvent ? 'updated' : 'created',
      'event',
      event.id,
      event.title
    );
    return result;
  }

  async deleteEvent(eventId: string) {
    const user = this.requireUser();
    const event = this.workspace()?.events.find(e => e.id === eventId);
    const result = await this.mutate(ws => this.repo.deleteEvent({ workspace: ws, eventId }));
    if (event) {
      await this.activityLog.logActivity(
        user.id,
        user.displayName,
        'deleted',
        'event',
        event.id,
        event.title
      );
    }
    return result;
  }

  saveContact(contact: M.BandContact) { return this.mutate(ws => this.repo.saveContact({ workspace: ws, contact })); }
  deleteContact(contactId: string) { return this.mutate(ws => this.repo.deleteContact({ workspace: ws, contactId })); }

  saveRider(rider: M.TechnicalRider) { return this.mutate(ws => this.repo.saveTechnicalRider({ workspace: ws, rider })); }
  deleteRider(riderId: string) { return this.mutate(ws => this.repo.deleteTechnicalRider({ workspace: ws, riderId })); }

  async saveTask(task: M.BandTask) {
    const user = this.requireUser();
    const existingTask = this.workspace()?.tasks.find(t => t.id === task.id);
    const result = await this.mutate(ws => this.repo.saveTask({ workspace: ws, task }));
    await this.activityLog.logActivity(
      user.id,
      user.displayName,
      existingTask ? 'updated' : 'created',
      'task',
      task.id,
      task.title
    );
    return result;
  }

  async updateTaskStatus(taskId: string, status: M.BandTaskStatus) {
    const user = this.requireUser();
    const task = this.workspace()?.tasks.find(t => t.id === taskId);
    const result = await this.mutate(ws => this.repo.updateTaskStatus({ workspace: ws, taskId, status }));
    if (task) {
      await this.activityLog.logActivity(
        user.id,
        user.displayName,
        'updated',
        'task',
        task.id,
        task.title,
        { newStatus: status }
      );
    }
    return result;
  }

  async deleteTask(taskId: string) {
    const user = this.requireUser();
    const task = this.workspace()?.tasks.find(t => t.id === taskId);
    const result = await this.mutate(ws => this.repo.deleteTask({ workspace: ws, taskId }));
    if (task) {
      await this.activityLog.logActivity(
        user.id,
        user.displayName,
        'deleted',
        'task',
        task.id,
        task.title
      );
    }
    return result;
  }

  saveFinances(args: { expenses?: M.FinanceExpense[]; incomes?: M.FinanceIncome[]; merchItems?: M.MerchItem[] }) {
    return this.mutate(ws => this.repo.saveFinances({ workspace: ws, ...args }));
  }

  sendInvite(invite: M.BandInvite) { return this.mutate(ws => this.repo.sendInvite({ workspace: ws, invite })); }
  acceptPendingInvite(inviteId: string) { return this.mutate(ws => this.repo.acceptPendingInvite({ workspace: ws, inviteId })); }
  declinePendingInvite(inviteId: string) { return this.mutate(ws => this.repo.declinePendingInvite({ workspace: ws, inviteId })); }
  updateMemberRole(targetUid: string, role: M.BandRole) { return this.mutate(ws => this.repo.updateMemberRole({ workspace: ws, targetUid, role })); }

  updateLogo(imageBytes: ArrayBuffer, fileExtension: string, contentType?: string) {
    return this.mutate(ws => this.repo.updateWorkspaceLogo({ workspace: ws, imageBytes, fileExtension, contentType }));
  }
  clearLogo() { return this.mutate(ws => this.repo.clearWorkspaceLogo({ workspace: ws })); }
  activatePremium(entitlement: M.WorkspacePremiumEntitlement) {
    return this.mutate(ws => this.repo.activateTestPremiumPlan({ workspace: ws, entitlement }));
  }

  private async mutate(op: (ws: M.BandWorkspace) => Promise<M.BandWorkspace>): Promise<M.BandWorkspace> {
    const ws = this.workspace();
    if (!ws) throw new WorkspaceRepositoryException('No workspace is loaded.');
    const next = await op(ws);
    return this.apply(next);
  }

  private requireUser(): M.AuthUser {
    const u = this.auth.user;
    if (!u) throw new WorkspaceRepositoryException('Not signed in.');
    return u;
  }
}
