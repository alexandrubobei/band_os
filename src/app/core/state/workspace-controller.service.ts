import { Injectable, computed, effect, inject, signal } from '@angular/core';
import * as M from '../models/models';
import { WORKSPACE_REPOSITORY, WorkspaceRepository, WorkspaceRepositoryException } from '../repos/workspace-repository';
import { AuthController } from './auth-controller.service';
import { AsyncState } from './async-state';

@Injectable({ providedIn: 'root' })
export class WorkspaceController {
  private readonly repo = inject(WORKSPACE_REPOSITORY) as WorkspaceRepository;
  private readonly auth = inject(AuthController);

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
        return;
      }
      void this.hydrateFor(user);
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

  /** Apply a workspace mutation returned by the repo. */
  private apply(ws: M.BandWorkspace): M.BandWorkspace {
    this.state.set(AsyncState.data(ws));
    return ws;
  }

  saveSong(song: M.Song) { return this.mutate(ws => this.repo.saveSong({ workspace: ws, song })); }
  deleteSong(songId: string) { return this.mutate(ws => this.repo.deleteSong({ workspace: ws, songId })); }
  saveSongs(songs: M.Song[]) { return this.mutate(ws => this.repo.saveSongs({ workspace: ws, songs })); }
  updateSongAudio(song: M.Song, audioBytes: ArrayBuffer, originalFileName: string) { return this.mutate(ws => this.repo.updateSongAudio({ workspace: ws, song, audioBytes, originalFileName })); }
  clearSongAudio(song: M.Song) { return this.mutate(ws => this.repo.clearSongAudio({ workspace: ws, song })); }

  saveSetlist(setlist: M.BandSetlist) { return this.mutate(ws => this.repo.saveSetlist({ workspace: ws, setlist })); }
  deleteSetlist(setlistId: string) { return this.mutate(ws => this.repo.deleteSetlist({ workspace: ws, setlistId })); }

  saveRelease(release: M.SongRelease) { return this.mutate(ws => this.repo.saveRelease({ workspace: ws, release })); }
  deleteRelease(releaseId: string) { return this.mutate(ws => this.repo.deleteRelease({ workspace: ws, releaseId })); }
  saveReleases(releases: M.SongRelease[]) { return this.mutate(ws => this.repo.saveReleases({ workspace: ws, releases })); }

  saveEvent(event: M.BandEvent) { return this.mutate(ws => this.repo.saveEvent({ workspace: ws, event })); }
  deleteEvent(eventId: string) { return this.mutate(ws => this.repo.deleteEvent({ workspace: ws, eventId })); }

  saveContact(contact: M.BandContact) { return this.mutate(ws => this.repo.saveContact({ workspace: ws, contact })); }
  deleteContact(contactId: string) { return this.mutate(ws => this.repo.deleteContact({ workspace: ws, contactId })); }

  saveRider(rider: M.TechnicalRider) { return this.mutate(ws => this.repo.saveTechnicalRider({ workspace: ws, rider })); }
  deleteRider(riderId: string) { return this.mutate(ws => this.repo.deleteTechnicalRider({ workspace: ws, riderId })); }

  saveTask(task: M.BandTask) { return this.mutate(ws => this.repo.saveTask({ workspace: ws, task })); }
  updateTaskStatus(taskId: string, status: M.BandTaskStatus) { return this.mutate(ws => this.repo.updateTaskStatus({ workspace: ws, taskId, status })); }
  deleteTask(taskId: string) { return this.mutate(ws => this.repo.deleteTask({ workspace: ws, taskId })); }

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
