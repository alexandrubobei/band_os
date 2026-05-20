import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { v4 as uuid } from 'uuid';
import * as M from '../models/models';
import { WorkspaceJson } from '../models/json';
import { buildDemoWorkspace, DEMO_BAND_NAME, DEMO_GENRE, DEMO_INVITE_CODE } from '../demo/demo-workspace-seed';
import { WorkspaceRepository, WorkspaceRepositoryException } from './workspace-repository';

const WORKSPACES_KEY = 'bandos.local.workspaces';
const SELECTED_MAP_KEY = 'bandos.local.userWorkspaceMap';

interface LocalState {
  workspaces: M.BandWorkspace[];
  selectedWorkspaceMap: Record<string, string>;
}

function loadState(): LocalState {
  const rawWorkspaces = localStorage.getItem(WORKSPACES_KEY);
  const rawSelected = localStorage.getItem(SELECTED_MAP_KEY);
  let workspaces: M.BandWorkspace[] = [];
  let selectedWorkspaceMap: Record<string, string> = {};
  if (rawWorkspaces) {
    try { workspaces = (JSON.parse(rawWorkspaces) as any[]).map(WorkspaceJson.fromJson); } catch { /* */ }
  }
  if (rawSelected) {
    try { selectedWorkspaceMap = JSON.parse(rawSelected); } catch { /* */ }
  }
  // Migrate legacy pending invites: keep only those with requestedUserId.
  let migrated = false;
  workspaces = workspaces.map(w => {
    const filtered = w.pendingInvites.filter(i => i.requestedUserId != null);
    if (filtered.length !== w.pendingInvites.length) {
      migrated = true;
      return { ...w, pendingInvites: filtered };
    }
    return w;
  });
  const state = { workspaces, selectedWorkspaceMap };
  if (migrated) saveState(state);
  return state;
}

function saveState(state: LocalState): void {
  localStorage.setItem(WORKSPACES_KEY, JSON.stringify(state.workspaces.map(WorkspaceJson.toJson)));
  localStorage.setItem(SELECTED_MAP_KEY, JSON.stringify(state.selectedWorkspaceMap));
}

function ensureDemoJoinTarget(state: LocalState): void {
  if (state.workspaces.some(w => w.inviteCode === DEMO_INVITE_CODE)) return;
  state.workspaces.push(buildDemoWorkspace({
    workspaceId: 'seed-demo-workspace',
    currentUserId: 'seed-nova-vale',
    adminDisplayName: 'Nova Vale',
    bandName: DEMO_BAND_NAME, genre: DEMO_GENRE,
  }));
  saveState(state);
}

function isActiveMember(ws: M.BandWorkspace, user: M.AuthUser): boolean {
  return ws.members.some(m => m.userId === user.id || (m.email ?? '').toLowerCase() === user.email.toLowerCase());
}

function userMemberships(workspaces: M.BandWorkspace[], user: M.AuthUser): M.BandWorkspace[] {
  return [...workspaces].filter(w => isActiveMember(w, user)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

function buildInviteCode(value: string): string {
  const compact = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().padEnd(4, 'X');
  const prefix = compact.substring(0, 4);
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const suffix = Array.from({ length: 3 }, () => chars.charAt(Math.floor(Math.random() * chars.length))).join('');
  return `${prefix}-${suffix}`;
}

@Injectable({ providedIn: 'root' })
export class LocalWorkspaceRepository implements WorkspaceRepository {
  readonly supportsRemoteInviteDelivery = false;
  readonly supportsWorkspaceLogoUpload = false;
  readonly supportsSongAudioUpload = false;

  // Reactive cache for the currently-loaded workspace so screens can react.
  private readonly currentWorkspace$ = new BehaviorSubject<M.BandWorkspace | null>(null);

  async loadWorkspace(user: M.AuthUser): Promise<M.BandWorkspace | null> {
    const state = loadState();
    ensureDemoJoinTarget(state);
    const memberships = userMemberships(state.workspaces, user);
    if (memberships.length === 0) {
      delete state.selectedWorkspaceMap[user.id];
      saveState(state);
      this.currentWorkspace$.next(null);
      return null;
    }
    const selectedId = state.selectedWorkspaceMap[user.id];
    const ws = memberships.find(w => w.id === selectedId) ?? memberships[0];
    if (selectedId !== ws.id) {
      state.selectedWorkspaceMap[user.id] = ws.id;
      saveState(state);
    }
    const result = { ...ws, currentUserId: user.id };
    this.currentWorkspace$.next(result);
    return result;
  }

  watchWorkspace({ workspaceId, currentUserId }: { workspaceId: string; currentUserId: string }): Observable<M.BandWorkspace | null> {
    const state = loadState();
    ensureDemoJoinTarget(state);
    const ws = state.workspaces.find(w => w.id === workspaceId);
    return of(ws ? { ...ws, currentUserId } : null);
  }

  async loadUserWorkspaces(user: M.AuthUser): Promise<M.BandWorkspace[]> {
    const state = loadState();
    ensureDemoJoinTarget(state);
    return userMemberships(state.workspaces, user).map(w => ({ ...w, currentUserId: user.id }));
  }

  async loadPendingAccess(user: M.AuthUser): Promise<M.PendingWorkspaceAccess | null> {
    const state = loadState();
    ensureDemoJoinTarget(state);
    let match: M.PendingWorkspaceAccess | null = null;
    let latest: Date | null = null;
    for (const workspace of state.workspaces) {
      for (const invite of workspace.pendingInvites) {
        const matchesUser = invite.requestedUserId === user.id ||
          (invite.email.toLowerCase() === user.email.toLowerCase());
        if (!matchesUser) continue;
        if (invite.status !== M.BandInviteStatus.pending && invite.status !== M.BandInviteStatus.declined) continue;
        const ts = invite.lastSentAt ?? invite.createdAt;
        if (!latest || ts.getTime() > latest.getTime()) {
          latest = ts;
          match = {
            workspaceId: workspace.id, bandName: workspace.bandName, genre: workspace.genre,
            inviteCode: workspace.inviteCode, inviteId: invite.id, status: invite.status,
          };
        }
      }
    }
    return match;
  }

  watchPendingAccess(user: M.AuthUser): Observable<M.PendingWorkspaceAccess | null> {
    return new Observable(sub => { this.loadPendingAccess(user).then(v => { sub.next(v); sub.complete(); }); });
  }

  async createWorkspace({ user, bandName, genre }: { user: M.AuthUser; bandName: string; genre: string }): Promise<M.BandWorkspace> {
    const state = loadState();
    const workspace: M.BandWorkspace = {
      id: uuid(), bandName, genre, inviteCode: buildInviteCode(bandName),
      plan: M.WorkspacePlan.free, premiumEntitlement: null,
      currency: M.WorkspaceCurrency.eur, currentUserId: user.id,
      members: [{ userId: user.id, displayName: user.displayName, role: M.BandRole.admin, email: user.email }],
      songs: [], events: [], tasks: [], contacts: [], releases: [], technicalRiders: [],
      expenses: [], incomes: [], merchItems: [], setlists: [],
      setlistsCount: 0, contactsCount: 0, monthSpendEur: 0, releaseMilestoneLabel: '',
      updatedAt: new Date(), pendingInvites: [], logoUrl: null, logoStoragePath: null,
    };
    state.workspaces.push(workspace);
    state.selectedWorkspaceMap[user.id] = workspace.id;
    saveState(state);
    this.currentWorkspace$.next(workspace);
    return workspace;
  }

  async joinWorkspace({ user, inviteCode }: { user: M.AuthUser; inviteCode: string }): Promise<M.PendingWorkspaceAccess | null> {
    const state = loadState();
    ensureDemoJoinTarget(state);
    const normalizedInvite = inviteCode.trim().toUpperCase();
    const idx = state.workspaces.findIndex(w => w.inviteCode.toUpperCase() === normalizedInvite);
    if (idx === -1) throw new WorkspaceRepositoryException('Workspace not found for this invite code.');
    const workspace = state.workspaces[idx];
    if (isActiveMember(workspace, user)) {
      state.selectedWorkspaceMap[user.id] = workspace.id;
      saveState(state);
      return null;
    }
    if (M.wsIsFree(workspace) && M.wsHasReachedMemberLimit(workspace)) {
      throw new WorkspaceRepositoryException(
        'Free plan limit reached\nThis workspace can have up to 4 members on the Free plan. Upgrade to Premium for unlimited members.',
        M.UpgradeTarget.members,
      );
    }
    const invites = [...workspace.pendingInvites];
    const timestamp = new Date();
    const inviteIndex = invites.findIndex(i => i.requestedUserId === user.id || i.email.toLowerCase() === user.email.toLowerCase());
    const existing = inviteIndex === -1 ? null : invites[inviteIndex];
    const pendingInvite: M.BandInvite = existing
      ? { ...existing, displayName: user.displayName, email: user.email.toLowerCase(), requestedUserId: user.id, status: M.BandInviteStatus.pending, lastSentAt: timestamp }
      : { id: uuid(), displayName: user.displayName, email: user.email.toLowerCase(), role: M.BandRole.member, status: M.BandInviteStatus.pending, createdAt: timestamp, lastSentAt: timestamp, requestedUserId: user.id };
    if (inviteIndex === -1) invites.unshift(pendingInvite); else invites[inviteIndex] = pendingInvite;
    state.workspaces[idx] = { ...workspace, pendingInvites: invites, updatedAt: timestamp };
    saveState(state);
    return {
      workspaceId: workspace.id, bandName: workspace.bandName, genre: workspace.genre,
      inviteCode: workspace.inviteCode, inviteId: pendingInvite.id, status: pendingInvite.status,
    };
  }

  async sendInvite({ workspace, invite }: { workspace: M.BandWorkspace; invite: M.BandInvite }): Promise<M.BandWorkspace> {
    const normalizedEmail = invite.email.trim().toLowerCase();
    if (workspace.members.some(m => (m.email ?? '').toLowerCase() === normalizedEmail)) {
      throw new WorkspaceRepositoryException('That email is already in the band.');
    }
    const state = loadState();
    const wsIndex = state.workspaces.findIndex(w => w.id === workspace.id);
    if (wsIndex === -1) throw new WorkspaceRepositoryException('No workspace is available.');
    const stored = state.workspaces[wsIndex];
    const invites = [...stored.pendingInvites];
    const existingIdx = invites.findIndex(e => e.email.toLowerCase() === normalizedEmail);
    const timestamp = new Date();
    const saved: M.BandInvite = {
      ...invite, email: normalizedEmail,
      createdAt: existingIdx === -1 ? timestamp : invites[existingIdx].createdAt,
      lastSentAt: timestamp,
    };
    if (existingIdx === -1) invites.unshift(saved); else invites[existingIdx] = saved;
    const updated: M.BandWorkspace = { ...stored, currentUserId: workspace.currentUserId, pendingInvites: invites, updatedAt: timestamp };
    state.workspaces[wsIndex] = updated;
    state.selectedWorkspaceMap[workspace.currentUserId] = updated.id;
    saveState(state);
    this.currentWorkspace$.next(updated);
    return updated;
  }

  async acceptPendingInvite({ workspace, inviteId }: { workspace: M.BandWorkspace; inviteId: string }): Promise<M.BandWorkspace> {
    const state = loadState();
    const wsIndex = state.workspaces.findIndex(w => w.id === workspace.id);
    if (wsIndex === -1) throw new WorkspaceRepositoryException('No workspace is available.');
    const stored = state.workspaces[wsIndex];
    const inviteIdx = stored.pendingInvites.findIndex(e => e.id === inviteId);
    if (inviteIdx === -1) throw new WorkspaceRepositoryException('That pending request is no longer available.');
    const invite = stored.pendingInvites[inviteIdx];
    const reqUid = invite.requestedUserId;
    if (!reqUid) throw new WorkspaceRepositoryException('This invite has not been claimed by a user yet.');

    const alreadyMember = stored.members.some(m => m.userId === reqUid || (m.email ?? '').toLowerCase() === invite.email.toLowerCase());
    if (M.wsIsFree(stored) && !alreadyMember && M.wsHasReachedMemberLimit(stored)) {
      throw new WorkspaceRepositoryException(
        'Free plan limit reached\nThis workspace can have up to 4 members on the Free plan. Upgrade to Premium for unlimited members.',
        M.UpgradeTarget.members,
      );
    }
    const members = [...stored.members];
    const existingIdx = members.findIndex(m => m.userId === reqUid || (m.email ?? '').toLowerCase() === invite.email.toLowerCase());
    const approved: M.BandMember = { userId: reqUid, displayName: invite.displayName, role: invite.role, email: invite.email };
    if (existingIdx === -1) members.push(approved); else members[existingIdx] = approved;
    const invites = [...stored.pendingInvites]; invites.splice(inviteIdx, 1);
    const updated: M.BandWorkspace = { ...stored, currentUserId: workspace.currentUserId, members, pendingInvites: invites, updatedAt: new Date() };
    state.workspaces[wsIndex] = updated;
    if (!state.selectedWorkspaceMap[reqUid]) state.selectedWorkspaceMap[reqUid] = updated.id;
    saveState(state);
    this.currentWorkspace$.next(updated);
    return updated;
  }

  async declinePendingInvite({ workspace, inviteId }: { workspace: M.BandWorkspace; inviteId: string }): Promise<M.BandWorkspace> {
    const state = loadState();
    const wsIndex = state.workspaces.findIndex(w => w.id === workspace.id);
    if (wsIndex === -1) throw new WorkspaceRepositoryException('No workspace is available.');
    const stored = state.workspaces[wsIndex];
    const inviteIdx = stored.pendingInvites.findIndex(e => e.id === inviteId);
    if (inviteIdx === -1) throw new WorkspaceRepositoryException('That pending request is no longer available.');
    const invites = [...stored.pendingInvites];
    invites[inviteIdx] = { ...invites[inviteIdx], status: M.BandInviteStatus.declined, lastSentAt: new Date() };
    const updated: M.BandWorkspace = { ...stored, currentUserId: workspace.currentUserId, pendingInvites: invites, updatedAt: new Date() };
    state.workspaces[wsIndex] = updated;
    saveState(state);
    this.currentWorkspace$.next(updated);
    return updated;
  }

  async clearDeclinedPendingAccess(user: M.AuthUser): Promise<void> {
    const state = loadState();
    let changed = false;
    for (let i = 0; i < state.workspaces.length; i++) {
      const ws = state.workspaces[i];
      const filtered = ws.pendingInvites.filter(inv => {
        const matches = inv.requestedUserId === user.id || inv.email.toLowerCase() === user.email.toLowerCase();
        return !(matches && inv.status === M.BandInviteStatus.declined);
      });
      if (filtered.length !== ws.pendingInvites.length) {
        changed = true;
        state.workspaces[i] = { ...ws, pendingInvites: filtered, updatedAt: new Date() };
      }
    }
    if (changed) saveState(state);
  }

  async saveWorkspace(workspace: M.BandWorkspace): Promise<M.BandWorkspace> {
    const state = loadState();
    const idx = state.workspaces.findIndex(w => w.id === workspace.id);
    if (idx === -1) state.workspaces.push(workspace); else state.workspaces[idx] = workspace;
    state.selectedWorkspaceMap[workspace.currentUserId] = workspace.id;
    saveState(state);
    this.currentWorkspace$.next(workspace);
    return workspace;
  }

  activateTestPremiumPlan({ workspace, entitlement }: { workspace: M.BandWorkspace; entitlement: M.WorkspacePremiumEntitlement }): Promise<M.BandWorkspace> {
    return this.saveWorkspace({ ...workspace, plan: M.WorkspacePlan.premium, premiumEntitlement: entitlement, updatedAt: new Date() });
  }

  saveFinances({ workspace, expenses, incomes, merchItems }: { workspace: M.BandWorkspace; expenses?: M.FinanceExpense[]; incomes?: M.FinanceIncome[]; merchItems?: M.MerchItem[] }): Promise<M.BandWorkspace> {
    return this.saveWorkspace({
      ...workspace,
      expenses: expenses ?? workspace.expenses,
      incomes: incomes ?? workspace.incomes,
      merchItems: merchItems ?? workspace.merchItems,
      updatedAt: new Date(),
    });
  }

  async updateWorkspaceLogo(): Promise<M.BandWorkspace> {
    throw new WorkspaceRepositoryException('Workspace logo upload is only available in Firebase mode.');
  }

  clearWorkspaceLogo({ workspace }: { workspace: M.BandWorkspace }): Promise<M.BandWorkspace> {
    return this.saveWorkspace({ ...workspace, logoUrl: null, logoStoragePath: null, updatedAt: new Date() });
  }

  updateMemberRole({ workspace, targetUid, role }: { workspace: M.BandWorkspace; targetUid: string; role: M.BandRole }): Promise<M.BandWorkspace> {
    const members = workspace.members.map(m => m.userId === targetUid ? { ...m, role } : m);
    return this.saveWorkspace({ ...workspace, members, updatedAt: new Date() });
  }

  saveSong({ workspace, song }: { workspace: M.BandWorkspace; song: M.Song }): Promise<M.BandWorkspace> {
    const songs = [...workspace.songs];
    const idx = songs.findIndex(s => s.id === song.id);
    if (idx === -1) songs.unshift(song); else songs[idx] = song;
    return this.saveWorkspace({ ...workspace, songs, updatedAt: new Date() });
  }

  saveSongs({ workspace, songs }: { workspace: M.BandWorkspace; songs: M.Song[] }): Promise<M.BandWorkspace> {
    return this.saveWorkspace({ ...workspace, songs, updatedAt: new Date() });
  }

  async updateSongAudio(): Promise<M.BandWorkspace> {
    throw new WorkspaceRepositoryException('Audio upload is available in Firebase mode.');
  }

  async clearSongAudio(): Promise<M.BandWorkspace> {
    throw new WorkspaceRepositoryException('Audio upload is available in Firebase mode.');
  }

  deleteSong({ workspace, songId }: { workspace: M.BandWorkspace; songId: string }): Promise<M.BandWorkspace> {
    const songs = workspace.songs.filter(s => s.id !== songId);
    return this.saveWorkspace({ ...workspace, songs, updatedAt: new Date() });
  }

  saveSetlist({ workspace, setlist }: { workspace: M.BandWorkspace; setlist: M.BandSetlist }): Promise<M.BandWorkspace> {
    const setlists = [...workspace.setlists];
    const idx = setlists.findIndex(s => s.id === setlist.id);
    if (idx === -1) setlists.unshift(setlist); else setlists[idx] = setlist;
    setlists.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return this.saveWorkspace({ ...workspace, setlists, setlistsCount: setlists.length, updatedAt: new Date() });
  }

  deleteSetlist({ workspace, setlistId }: { workspace: M.BandWorkspace; setlistId: string }): Promise<M.BandWorkspace> {
    const setlists = workspace.setlists.filter(s => s.id !== setlistId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return this.saveWorkspace({ ...workspace, setlists, setlistsCount: setlists.length, updatedAt: new Date() });
  }

  saveRelease({ workspace, release }: { workspace: M.BandWorkspace; release: M.SongRelease }): Promise<M.BandWorkspace> {
    const releases = [...workspace.releases];
    const idx = releases.findIndex(r => r.id === release.id);
    if (idx === -1) releases.unshift(release); else releases[idx] = release;
    releases.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return this.saveWorkspace({ ...workspace, releases, updatedAt: new Date() });
  }

  saveReleases({ workspace, releases }: { workspace: M.BandWorkspace; releases: M.SongRelease[] }): Promise<M.BandWorkspace> {
    const sorted = [...releases].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return this.saveWorkspace({ ...workspace, releases: sorted, updatedAt: new Date() });
  }

  deleteRelease({ workspace, releaseId }: { workspace: M.BandWorkspace; releaseId: string }): Promise<M.BandWorkspace> {
    const releases = workspace.releases.filter(r => r.id !== releaseId);
    return this.saveWorkspace({ ...workspace, releases, updatedAt: new Date() });
  }

  saveEvent({ workspace, event }: { workspace: M.BandWorkspace; event: M.BandEvent }): Promise<M.BandWorkspace> {
    const events = [...workspace.events];
    const idx = events.findIndex(e => e.id === event.id);
    if (idx === -1) events.push(event); else events[idx] = event;
    events.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return this.saveWorkspace({ ...workspace, events, updatedAt: new Date() });
  }

  deleteEvent({ workspace, eventId }: { workspace: M.BandWorkspace; eventId: string }): Promise<M.BandWorkspace> {
    const events = workspace.events.filter(e => e.id !== eventId).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return this.saveWorkspace({ ...workspace, events, updatedAt: new Date() });
  }

  saveContact({ workspace, contact }: { workspace: M.BandWorkspace; contact: M.BandContact }): Promise<M.BandWorkspace> {
    const contacts = [...workspace.contacts];
    const idx = contacts.findIndex(c => c.id === contact.id);
    if (idx === -1) contacts.unshift(contact); else contacts[idx] = contact;
    contacts.sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    return this.saveWorkspace({ ...workspace, contacts, updatedAt: new Date() });
  }

  deleteContact({ workspace, contactId }: { workspace: M.BandWorkspace; contactId: string }): Promise<M.BandWorkspace> {
    const contacts = workspace.contacts.filter(c => c.id !== contactId)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    return this.saveWorkspace({ ...workspace, contacts, updatedAt: new Date() });
  }

  saveTechnicalRider({ workspace, rider }: { workspace: M.BandWorkspace; rider: M.TechnicalRider }): Promise<M.BandWorkspace> {
    const riders = [...workspace.technicalRiders];
    const idx = riders.findIndex(r => r.id === rider.id);
    if (idx === -1) riders.unshift(rider); else riders[idx] = rider;
    riders.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return this.saveWorkspace({ ...workspace, technicalRiders: riders, updatedAt: new Date() });
  }

  deleteTechnicalRider({ workspace, riderId }: { workspace: M.BandWorkspace; riderId: string }): Promise<M.BandWorkspace> {
    const riders = workspace.technicalRiders.filter(r => r.id !== riderId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return this.saveWorkspace({ ...workspace, technicalRiders: riders, updatedAt: new Date() });
  }

  saveTask({ workspace, task }: { workspace: M.BandWorkspace; task: M.BandTask }): Promise<M.BandWorkspace> {
    const tasks = [...workspace.tasks];
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx === -1) tasks.unshift(task); else tasks[idx] = task;
    return this.saveWorkspace({ ...workspace, tasks, updatedAt: new Date() });
  }

  updateTaskStatus({ workspace, taskId, status }: { workspace: M.BandWorkspace; taskId: string; status: M.BandTaskStatus }): Promise<M.BandWorkspace> {
    const tasks = workspace.tasks.map(t => t.id === taskId ? { ...t, status } : t);
    return this.saveWorkspace({ ...workspace, tasks, updatedAt: new Date() });
  }

  deleteTask({ workspace, taskId }: { workspace: M.BandWorkspace; taskId: string }): Promise<M.BandWorkspace> {
    const tasks = workspace.tasks.filter(t => t.id !== taskId);
    return this.saveWorkspace({ ...workspace, tasks, updatedAt: new Date() });
  }

  async selectWorkspace({ user, workspaceId }: { user: M.AuthUser; workspaceId: string }): Promise<M.BandWorkspace | null> {
    const state = loadState();
    ensureDemoJoinTarget(state);
    const memberships = userMemberships(state.workspaces, user);
    const ws = memberships.find(w => w.id === workspaceId);
    if (!ws) throw new WorkspaceRepositoryException('That workspace is no longer available.');
    state.selectedWorkspaceMap[user.id] = workspaceId;
    saveState(state);
    const result = { ...ws, currentUserId: user.id };
    this.currentWorkspace$.next(result);
    return result;
  }

  async leaveWorkspace({ user, workspace }: { user: M.AuthUser; workspace: M.BandWorkspace }): Promise<void> {
    const state = loadState();
    const wsIndex = state.workspaces.findIndex(w => w.id === workspace.id);
    if (wsIndex === -1) throw new WorkspaceRepositoryException('No workspace is available.');
    const stored = state.workspaces[wsIndex];
    const memberIndex = stored.members.findIndex(m => m.userId === user.id || (m.email ?? '').toLowerCase() === user.email.toLowerCase());
    if (memberIndex === -1) {
      delete state.selectedWorkspaceMap[user.id];
      saveState(state);
      return;
    }
    const leaving = stored.members[memberIndex];
    const adminCount = stored.members.filter(m => m.role === M.BandRole.admin).length;
    if (leaving.role === M.BandRole.admin && adminCount <= 1) {
      throw new WorkspaceRepositoryException('Assign another admin before leaving this workspace.');
    }
    const updatedMembers = [...stored.members]; updatedMembers.splice(memberIndex, 1);
    state.workspaces[wsIndex] = { ...stored, members: updatedMembers, updatedAt: new Date() };
    const remaining = userMemberships(state.workspaces, user);
    if (state.selectedWorkspaceMap[user.id] === workspace.id) {
      if (remaining.length === 0) delete state.selectedWorkspaceMap[user.id];
      else state.selectedWorkspaceMap[user.id] = remaining[0].id;
    }
    saveState(state);
    this.currentWorkspace$.next(null);
  }
}
