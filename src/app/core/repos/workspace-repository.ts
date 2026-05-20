import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import * as M from '../models/models';

export class WorkspaceRepositoryException extends Error {
  constructor(message: string, public upgradeTarget?: M.UpgradeTarget) {
    super(message);
    this.name = 'WorkspaceRepositoryException';
  }
}

export interface WorkspaceRepository {
  readonly supportsRemoteInviteDelivery: boolean;
  readonly supportsWorkspaceLogoUpload: boolean;
  readonly supportsSongAudioUpload: boolean;

  loadWorkspace(user: M.AuthUser): Promise<M.BandWorkspace | null>;
  watchWorkspace(args: { workspaceId: string; currentUserId: string }): Observable<M.BandWorkspace | null>;
  loadUserWorkspaces(user: M.AuthUser, debugTrigger?: string): Promise<M.BandWorkspace[]>;
  loadPendingAccess(user: M.AuthUser): Promise<M.PendingWorkspaceAccess | null>;
  watchPendingAccess(user: M.AuthUser): Observable<M.PendingWorkspaceAccess | null>;
  createWorkspace(args: { user: M.AuthUser; bandName: string; genre: string }): Promise<M.BandWorkspace>;
  joinWorkspace(args: { user: M.AuthUser; inviteCode: string }): Promise<M.PendingWorkspaceAccess | null>;
  sendInvite(args: { workspace: M.BandWorkspace; invite: M.BandInvite }): Promise<M.BandWorkspace>;
  acceptPendingInvite(args: { workspace: M.BandWorkspace; inviteId: string }): Promise<M.BandWorkspace>;
  declinePendingInvite(args: { workspace: M.BandWorkspace; inviteId: string }): Promise<M.BandWorkspace>;
  clearDeclinedPendingAccess(user: M.AuthUser): Promise<void>;
  saveWorkspace(workspace: M.BandWorkspace): Promise<M.BandWorkspace>;
  activateTestPremiumPlan(args: { workspace: M.BandWorkspace; entitlement: M.WorkspacePremiumEntitlement }): Promise<M.BandWorkspace>;
  saveFinances(args: { workspace: M.BandWorkspace; expenses?: M.FinanceExpense[]; incomes?: M.FinanceIncome[]; merchItems?: M.MerchItem[] }): Promise<M.BandWorkspace>;
  updateWorkspaceLogo(args: { workspace: M.BandWorkspace; imageBytes: ArrayBuffer; fileExtension: string; contentType?: string }): Promise<M.BandWorkspace>;
  clearWorkspaceLogo(args: { workspace: M.BandWorkspace }): Promise<M.BandWorkspace>;
  updateMemberRole(args: { workspace: M.BandWorkspace; targetUid: string; role: M.BandRole }): Promise<M.BandWorkspace>;
  saveSong(args: { workspace: M.BandWorkspace; song: M.Song }): Promise<M.BandWorkspace>;
  updateSongAudio(args: { workspace: M.BandWorkspace; song: M.Song; audioBytes: ArrayBuffer; originalFileName: string }): Promise<M.BandWorkspace>;
  clearSongAudio(args: { workspace: M.BandWorkspace; song: M.Song }): Promise<M.BandWorkspace>;
  saveSongs(args: { workspace: M.BandWorkspace; songs: M.Song[] }): Promise<M.BandWorkspace>;
  deleteSong(args: { workspace: M.BandWorkspace; songId: string }): Promise<M.BandWorkspace>;
  saveSetlist(args: { workspace: M.BandWorkspace; setlist: M.BandSetlist }): Promise<M.BandWorkspace>;
  deleteSetlist(args: { workspace: M.BandWorkspace; setlistId: string }): Promise<M.BandWorkspace>;
  saveRelease(args: { workspace: M.BandWorkspace; release: M.SongRelease }): Promise<M.BandWorkspace>;
  saveReleases(args: { workspace: M.BandWorkspace; releases: M.SongRelease[] }): Promise<M.BandWorkspace>;
  deleteRelease(args: { workspace: M.BandWorkspace; releaseId: string }): Promise<M.BandWorkspace>;
  saveEvent(args: { workspace: M.BandWorkspace; event: M.BandEvent }): Promise<M.BandWorkspace>;
  deleteEvent(args: { workspace: M.BandWorkspace; eventId: string }): Promise<M.BandWorkspace>;
  saveContact(args: { workspace: M.BandWorkspace; contact: M.BandContact }): Promise<M.BandWorkspace>;
  deleteContact(args: { workspace: M.BandWorkspace; contactId: string }): Promise<M.BandWorkspace>;
  saveTechnicalRider(args: { workspace: M.BandWorkspace; rider: M.TechnicalRider }): Promise<M.BandWorkspace>;
  deleteTechnicalRider(args: { workspace: M.BandWorkspace; riderId: string }): Promise<M.BandWorkspace>;
  saveTask(args: { workspace: M.BandWorkspace; task: M.BandTask }): Promise<M.BandWorkspace>;
  updateTaskStatus(args: { workspace: M.BandWorkspace; taskId: string; status: M.BandTaskStatus }): Promise<M.BandWorkspace>;
  deleteTask(args: { workspace: M.BandWorkspace; taskId: string }): Promise<M.BandWorkspace>;
  selectWorkspace(args: { user: M.AuthUser; workspaceId: string }): Promise<M.BandWorkspace | null>;
  leaveWorkspace(args: { user: M.AuthUser; workspace: M.BandWorkspace }): Promise<void>;
}

export const WORKSPACE_REPOSITORY = new InjectionToken<WorkspaceRepository>('bandos.WorkspaceRepository');
