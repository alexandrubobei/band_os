import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  collection, doc, getDoc, getDocs, onSnapshot, query, setDoc, updateDoc, writeBatch, where, limit, deleteDoc, deleteField,
  DocumentSnapshot,
} from 'firebase/firestore';
import { getDownloadURL, ref as storageRef, uploadBytes, deleteObject } from 'firebase/storage';
import { v4 as uuid } from 'uuid';
import * as M from '../models/models';
import {
  WorkspaceJson, MemberJson, InviteJson, SongJson, ReleaseJson, EventJson, TaskJson,
  SetlistJson, RiderJson, ExpenseJson, IncomeJson, MerchItemJson, ContactJson, EntitlementJson,
} from '../models/json';
import { getFirebase } from '../firebase/firebase-bootstrap';
import { WorkspaceRepository, WorkspaceRepositoryException } from './workspace-repository';

// Schema (must match lib/src/core/services/firebase_workspace_repository.dart):
//   users/{uid}                            { email, displayName, selectedWorkspaceId, updatedAt }
//   workspaces/{wsId}                      bandName, genre, inviteCode, inviteCodeLookup, plan, billing, currency,
//                                          setlistsCount, contactsCount, monthSpendEur, releaseMilestoneLabel,
//                                          updatedAt, logoUrl, logoStoragePath, createdBy
//   workspaces/{wsId}/members/{uid}        BandMember
//   workspaces/{wsId}/joinRequests/{id}    BandInvite (doc id = user uid for join requests)
//   workspaces/{wsId}/songs/{songId}       Song    (also sentinel doc id 'songs_meta')
//   workspaces/{wsId}/setlists/{id}        BandSetlist (sentinel 'setlists_meta')
//   workspaces/{wsId}/releases/{id}        SongRelease (sentinel 'releases_meta')
//   workspaces/{wsId}/events/{id}          BandEvent (sentinel 'events_meta')
//   workspaces/{wsId}/contacts/{id}        BandContact (sentinel 'contacts_meta')
//   workspaces/{wsId}/expenses/{id}        FinanceExpense (sentinel 'expenses_meta')
//   workspaces/{wsId}/incomes/{id}         FinanceIncome (sentinel 'incomes_meta')
//   workspaces/{wsId}/merchItems/{id}      MerchItem (sentinel 'merch_items_meta')
//   workspaces/{wsId}/technicalRiders/{id} TechnicalRider (sentinel 'technical_riders_meta')
//   workspaces/{wsId}/tasks/{id}           BandTask

const C = {
  users: 'users',
  workspaces: 'workspaces',
  members: 'members',
  joinRequests: 'joinRequests',
  songs: 'songs',
  setlists: 'setlists',
  releases: 'releases',
  events: 'events',
  contacts: 'contacts',
  expenses: 'expenses',
  incomes: 'incomes',
  merchItems: 'merchItems',
  technicalRiders: 'technicalRiders',
  tasks: 'tasks',
};

const META = {
  songs: 'songs_meta',
  setlists: 'setlists_meta',
  releases: 'releases_meta',
  events: 'events_meta',
  contacts: 'contacts_meta',
  expenses: 'expenses_meta',
  incomes: 'incomes_meta',
  merchItems: 'merch_items_meta',
  technicalRiders: 'technical_riders_meta',
};

const STORAGE_FOLDER = { logos: 'workspace-logos', songAudio: 'song-audio' };
const INVITE_LOOKUP_FIELD = 'inviteCodeLookup';

function inviteCodeLookup(value: string): string {
  return value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

function canonicalInviteCode(value: string): string {
  const compact = inviteCodeLookup(value);
  if (compact.length <= 4) return compact;
  return `${compact.slice(0, 4)}-${compact.slice(4)}`;
}

function buildInviteCode(bandName: string): string {
  const compact = bandName.replace(/[^A-Za-z0-9]/g, '').toUpperCase().padEnd(4, 'X');
  const prefix = compact.slice(0, 4);
  const suffix = uuid().replace(/-/g, '').slice(0, 3).toUpperCase();
  return `${prefix}-${suffix}`;
}

function jsonWithId(snap: DocumentSnapshot): any {
  return { id: snap.id, ...(snap.data() as any) };
}

function workspaceDocFields(workspace: M.BandWorkspace, opts?: { createdBy?: string }): any {
  // Match _workspaceDocData in Dart: strip nested entity arrays, keep the root metadata.
  const json: any = WorkspaceJson.toJson(workspace);
  delete json.id;
  delete json.currentUserId;
  delete json.members;
  delete json.technicalRiders;
  delete json.contacts;
  delete json.events;
  delete json.songs;
  delete json.setlists;
  delete json.releases;
  delete json.expenses;
  delete json.incomes;
  delete json.merchItems;
  delete json.tasks;
  delete json.pendingInvites;
  json.inviteCode = canonicalInviteCode(workspace.inviteCode);
  json[INVITE_LOOKUP_FIELD] = inviteCodeLookup(workspace.inviteCode);
  if (opts?.createdBy) json.createdBy = opts.createdBy.trim();
  return json;
}

function userDocFields(input: { email: string; displayName: string; selectedWorkspaceId?: string | null; includeSelectedWorkspaceId?: boolean }): any {
  const out: any = {
    email: input.email.trim().toLowerCase(),
    displayName: input.displayName.trim(),
    updatedAt: new Date().toISOString(),
  };
  if (input.includeSelectedWorkspaceId) out.selectedWorkspaceId = input.selectedWorkspaceId ?? null;
  return out;
}

function inferContentType(fileName: string): string {
  const ext = fileName.toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'png': return 'image/png';
    case 'jpg': case 'jpeg': return 'image/jpeg';
    case 'webp': return 'image/webp';
    case 'heic': return 'image/heic';
    case 'heif': return 'image/heif';
    case 'mp3': return 'audio/mpeg';
    case 'm4a': return 'audio/mp4';
    case 'wav': return 'audio/wav';
    case 'aac': return 'audio/aac';
  }
  return 'application/octet-stream';
}

function normalizeLogoExtension(ext: string): string {
  const n = ext.trim().toLowerCase().replace(/^\./, '');
  if (!n) return 'jpg';
  if (['jpeg'].includes(n)) return 'jpg';
  if (['jpg', 'png', 'webp', 'heic', 'heif'].includes(n)) return n;
  return 'jpg';
}

function normalizeSongAudioExtension(ext: string): string | null {
  const n = ext.trim().toLowerCase().replace(/^\./, '');
  return ['mp3', 'm4a', 'wav', 'aac'].includes(n) ? n : null;
}

@Injectable({ providedIn: 'root' })
export class FirebaseWorkspaceRepository implements WorkspaceRepository {
  readonly supportsRemoteInviteDelivery = true;
  readonly supportsWorkspaceLogoUpload = true;
  readonly supportsSongAudioUpload = true;

  // Reference helpers ---------------------------------------------------------

  private userDoc(uid: string) { return doc(getFirebase().firestore, C.users, uid); }
  private workspacesCol() { return collection(getFirebase().firestore, C.workspaces); }
  private workspaceDoc(wsId: string) { return doc(getFirebase().firestore, C.workspaces, wsId); }
  private membersCol(wsId: string) { return collection(this.workspaceDoc(wsId), C.members); }
  private memberDoc(wsId: string, uid: string) { return doc(this.membersCol(wsId), uid); }
  private joinRequestsCol(wsId: string) { return collection(this.workspaceDoc(wsId), C.joinRequests); }
  private joinRequestDoc(wsId: string, id: string) { return doc(this.joinRequestsCol(wsId), id); }
  private entityCol(wsId: string, name: string) { return collection(this.workspaceDoc(wsId), name); }
  private entityDoc(wsId: string, name: string, id: string) { return doc(this.entityCol(wsId, name), id); }

  private joinRequestIdForUser(uid: string): string { return uid.trim(); }

  // Public API ---------------------------------------------------------------

  async loadWorkspace(user: M.AuthUser): Promise<M.BandWorkspace | null> {
    const userSnap = await getDoc(this.userDoc(user.id));
    const selectedId = (userSnap.exists() && (userSnap.data() as any).selectedWorkspaceId as string | undefined) || null;

    if (selectedId) {
      const memberSnap = await getDoc(this.memberDoc(selectedId, user.id));
      if (memberSnap.exists()) {
        return this.loadWorkspaceById(selectedId, user.id);
      }
    }
    const workspaces = await this.loadUserWorkspaces(user);
    if (workspaces.length === 0) {
      await this.setSelectedWorkspaceId(user, null);
      return null;
    }
    const ws = workspaces.find(w => w.id === selectedId) ?? workspaces[0];
    if (selectedId !== ws.id) await this.setSelectedWorkspaceId(user, ws.id);
    return ws;
  }

  watchWorkspace({ workspaceId, currentUserId }: { workspaceId: string; currentUserId: string }): Observable<M.BandWorkspace | null> {
    return new Observable<M.BandWorkspace | null>(sub => {
      let closed = false;
      let reloadInFlight = false;
      let reloadQueued = false;
      let debounce: any = null;

      const reload = async () => {
        if (closed) return;
        if (reloadInFlight) { reloadQueued = true; return; }
        reloadInFlight = true;
        try {
          const ws = await this.loadWorkspaceById(workspaceId, currentUserId);
          if (!closed) sub.next(ws);
        } catch (err: any) {
          if (!closed) {
            if (err?.message === 'That workspace is no longer available.') sub.next(null);
            else sub.error(err);
          }
        } finally {
          reloadInFlight = false;
          if (reloadQueued && !closed) { reloadQueued = false; void reload(); }
        }
      };
      const schedule = () => {
        if (closed) return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(() => { void reload(); }, 75);
      };

      const unsubs: Array<() => void> = [];
      unsubs.push(onSnapshot(this.workspaceDoc(workspaceId), schedule));
      unsubs.push(onSnapshot(this.memberDoc(workspaceId, currentUserId), schedule));
      unsubs.push(onSnapshot(this.membersCol(workspaceId), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.songs), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.setlists), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.releases), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.events), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.contacts), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.technicalRiders), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.expenses), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.incomes), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.merchItems), schedule));
      unsubs.push(onSnapshot(this.entityCol(workspaceId, C.tasks), schedule));
      unsubs.push(onSnapshot(this.joinRequestsCol(workspaceId), schedule));
      void reload();

      return () => {
        closed = true;
        if (debounce) clearTimeout(debounce);
        for (const u of unsubs) u();
      };
    });
  }

  async loadUserWorkspaces(user: M.AuthUser): Promise<M.BandWorkspace[]> {
    const ids = await this.loadWorkspaceIdsForUser(user.id);
    const list: M.BandWorkspace[] = [];
    for (const id of ids) {
      try {
        list.push(await this.loadWorkspaceById(id, user.id));
      } catch { /* skip workspaces that fail to hydrate */ }
    }
    list.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return list;
  }

  async loadPendingAccess(user: M.AuthUser): Promise<M.PendingWorkspaceAccess | null> {
    const records = await this.loadPendingAccessRecords(user);
    if (records.length === 0) return null;
    records.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return records[0].access;
  }

  watchPendingAccess(user: M.AuthUser): Observable<M.PendingWorkspaceAccess | null> {
    return new Observable(sub => { this.loadPendingAccess(user).then(v => { sub.next(v); sub.complete(); }); });
  }

  async createWorkspace({ user, bandName, genre }: { user: M.AuthUser; bandName: string; genre: string }): Promise<M.BandWorkspace> {
    const workspace: M.BandWorkspace = {
      id: uuid(),
      bandName, genre,
      inviteCode: buildInviteCode(bandName),
      plan: M.WorkspacePlan.free,
      premiumEntitlement: null,
      currency: M.WorkspaceCurrency.eur,
      currentUserId: user.id,
      members: [{ userId: user.id, displayName: user.displayName, role: M.BandRole.admin, email: user.email }],
      songs: [], events: [], tasks: [], contacts: [], releases: [], technicalRiders: [],
      expenses: [], incomes: [], merchItems: [], setlists: [],
      setlistsCount: 0, contactsCount: 0, monthSpendEur: 0, releaseMilestoneLabel: '',
      updatedAt: new Date(), pendingInvites: [], logoUrl: null, logoStoragePath: null,
    };
    await setDoc(this.workspaceDoc(workspace.id), workspaceDocFields(workspace, { createdBy: user.id }));
    await setDoc(this.memberDoc(workspace.id, user.id), MemberJson.toJson(workspace.members[0]));
    await setDoc(this.userDoc(user.id),
      userDocFields({ email: user.email, displayName: user.displayName, selectedWorkspaceId: workspace.id, includeSelectedWorkspaceId: true }),
      { merge: true });
    return workspace;
  }

  async joinWorkspace({ user, inviteCode }: { user: M.AuthUser; inviteCode: string }): Promise<M.PendingWorkspaceAccess | null> {
    const wsSnap = await this.findWorkspaceByInviteCode(inviteCode);
    if (!wsSnap) throw new WorkspaceRepositoryException('Workspace not found for this invite code.');
    const wsId = wsSnap.id;
    const memberSnap = await getDoc(this.memberDoc(wsId, user.id));
    if (memberSnap.exists()) {
      await this.setSelectedWorkspaceId(user, wsId);
      return null;
    }
    const wsData = wsSnap.data() as any;
    const normalizedEmail = user.email.trim().toLowerCase();
    const requestId = this.joinRequestIdForUser(user.id);
    const existingSnap = await getDoc(this.joinRequestDoc(wsId, requestId));
    const existing = existingSnap.exists() ? InviteJson.fromJson(jsonWithId(existingSnap)) : null;
    if (existing?.status === M.BandInviteStatus.pending) {
      return {
        workspaceId: wsId,
        bandName: wsData.bandName ?? '',
        genre: wsData.genre ?? '',
        inviteCode: wsData.inviteCode ?? '',
        inviteId: existing.id,
        status: existing.status,
        alreadyPending: true,
      };
    }
    const ts = new Date();
    const invite: M.BandInvite = existing
      ? { ...existing, displayName: user.displayName, email: normalizedEmail, requestedUserId: user.id, status: M.BandInviteStatus.pending, lastSentAt: ts }
      : { id: requestId, displayName: user.displayName, email: normalizedEmail, role: M.BandRole.member, status: M.BandInviteStatus.pending, createdAt: ts, lastSentAt: ts, requestedUserId: user.id };
    await setDoc(this.joinRequestDoc(wsId, invite.id), InviteJson.toJson(invite), { merge: true });
    await setDoc(this.userDoc(user.id), userDocFields({ email: user.email, displayName: user.displayName }), { merge: true });
    return {
      workspaceId: wsId,
      bandName: wsData.bandName ?? '',
      genre: wsData.genre ?? '',
      inviteCode: wsData.inviteCode ?? '',
      inviteId: invite.id,
      status: invite.status,
    };
  }

  async sendInvite({ workspace, invite }: { workspace: M.BandWorkspace; invite: M.BandInvite }): Promise<M.BandWorkspace> {
    const normalizedEmail = invite.email.trim().toLowerCase();
    const byEmail = await getDocs(query(this.membersCol(workspace.id), where('email', '==', normalizedEmail), limit(1)));
    if (!byEmail.empty) throw new WorkspaceRepositoryException('That email is already in the band.');
    const existingByEmail = await getDocs(query(this.joinRequestsCol(workspace.id), where('email', '==', normalizedEmail), limit(1)));
    const existing = existingByEmail.empty ? null : InviteJson.fromJson(jsonWithId(existingByEmail.docs[0]));
    const ts = new Date();
    const saved: M.BandInvite = {
      ...invite,
      id: existing?.id ?? invite.id,
      email: normalizedEmail,
      createdAt: existing?.createdAt ?? ts,
      lastSentAt: ts,
    };
    await setDoc(this.joinRequestDoc(workspace.id, saved.id), InviteJson.toJson(saved), { merge: true });
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async acceptPendingInvite({ workspace, inviteId }: { workspace: M.BandWorkspace; inviteId: string }): Promise<M.BandWorkspace> {
    const snap = await getDoc(this.joinRequestDoc(workspace.id, inviteId));
    if (!snap.exists()) throw new WorkspaceRepositoryException('That pending request is no longer available.');
    const invite = InviteJson.fromJson(jsonWithId(snap));
    if (!invite.requestedUserId) throw new WorkspaceRepositoryException('This invite has not been claimed by a user yet.');
    const existingMember = await getDoc(this.memberDoc(workspace.id, invite.requestedUserId));
    if (M.wsIsFree(workspace) && !existingMember.exists() && M.wsHasReachedMemberLimit(workspace)) {
      throw new WorkspaceRepositoryException(
        'Free plan limit reached\nThis workspace can have up to 4 members on the Free plan. Upgrade to Premium for unlimited members.',
        M.UpgradeTarget.members,
      );
    }
    const batch = writeBatch(getFirebase().firestore);
    batch.set(this.memberDoc(workspace.id, invite.requestedUserId), MemberJson.toJson({
      userId: invite.requestedUserId, displayName: invite.displayName, role: invite.role, email: invite.email,
    }));
    batch.delete(this.joinRequestDoc(workspace.id, inviteId));
    await batch.commit();
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async declinePendingInvite({ workspace, inviteId }: { workspace: M.BandWorkspace; inviteId: string }): Promise<M.BandWorkspace> {
    const snap = await getDoc(this.joinRequestDoc(workspace.id, inviteId));
    if (!snap.exists()) throw new WorkspaceRepositoryException('That pending request is no longer available.');
    const invite = InviteJson.fromJson(jsonWithId(snap));
    await setDoc(this.joinRequestDoc(workspace.id, inviteId),
      InviteJson.toJson({ ...invite, status: M.BandInviteStatus.declined, lastSentAt: new Date() }));
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async clearDeclinedPendingAccess(user: M.AuthUser): Promise<void> {
    const records = await this.loadPendingAccessRecords(user);
    const declined = records.filter(r => r.access.status === M.BandInviteStatus.declined);
    if (declined.length === 0) return;
    const batch = writeBatch(getFirebase().firestore);
    for (const r of declined) batch.delete(this.joinRequestDoc(r.access.workspaceId, r.access.inviteId));
    await batch.commit();
  }

  async saveWorkspace(workspace: M.BandWorkspace): Promise<M.BandWorkspace> {
    await setDoc(this.workspaceDoc(workspace.id), { ...workspaceDocFields(workspace), tasks: deleteField() }, { merge: true });
    await this.syncMembers(workspace);
    await this.syncJoinRequests(workspace);
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async activateTestPremiumPlan({ workspace, entitlement }: { workspace: M.BandWorkspace; entitlement: M.WorkspacePremiumEntitlement }): Promise<M.BandWorkspace> {
    const nowUtc = new Date();
    await updateDoc(this.workspaceDoc(workspace.id), {
      billing: EntitlementJson.toJson(entitlement),
      plan: 'premium',
      updatedAt: nowUtc.toISOString(),
    });
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async saveFinances({ workspace, expenses, incomes, merchItems }: { workspace: M.BandWorkspace; expenses?: M.FinanceExpense[]; incomes?: M.FinanceIncome[]; merchItems?: M.MerchItem[] }): Promise<M.BandWorkspace> {
    if (expenses) await this.replaceCollection(workspace.id, C.expenses, META.expenses, expenses, e => e.id, ExpenseJson.toJson);
    if (incomes) await this.replaceCollection(workspace.id, C.incomes, META.incomes, incomes, e => e.id, IncomeJson.toJson);
    if (merchItems) await this.replaceCollection(workspace.id, C.merchItems, META.merchItems, merchItems, e => e.id, MerchItemJson.toJson);
    await updateDoc(this.workspaceDoc(workspace.id), { updatedAt: new Date().toISOString() });
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async updateWorkspaceLogo({ workspace, imageBytes, fileExtension, contentType }: { workspace: M.BandWorkspace; imageBytes: ArrayBuffer; fileExtension: string; contentType?: string }): Promise<M.BandWorkspace> {
    const ext = normalizeLogoExtension(fileExtension);
    const ct = contentType ?? inferContentType(`logo.${ext}`);
    const path = `${STORAGE_FOLDER.logos}/${workspace.id}/logo_${Date.now()}.${ext}`;
    const ref = storageRef(getFirebase().storage, path);
    await uploadBytes(ref, new Uint8Array(imageBytes), { contentType: ct, cacheControl: 'public,max-age=3600' });
    const url = await getDownloadURL(ref);
    const previous = workspace.logoStoragePath?.trim();
    await updateDoc(this.workspaceDoc(workspace.id), {
      logoUrl: url, logoStoragePath: path, updatedAt: new Date().toISOString(),
    });
    if (previous && previous !== path) {
      try { await deleteObject(storageRef(getFirebase().storage, previous)); } catch { /* */ }
    }
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async clearWorkspaceLogo({ workspace }: { workspace: M.BandWorkspace }): Promise<M.BandWorkspace> {
    const previous = workspace.logoStoragePath?.trim();
    await updateDoc(this.workspaceDoc(workspace.id), { logoUrl: null, logoStoragePath: null, updatedAt: new Date().toISOString() });
    if (previous) {
      try { await deleteObject(storageRef(getFirebase().storage, previous)); } catch { /* */ }
    }
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async updateMemberRole({ workspace, targetUid, role }: { workspace: M.BandWorkspace; targetUid: string; role: M.BandRole }): Promise<M.BandWorkspace> {
    await updateDoc(this.memberDoc(workspace.id, targetUid.trim()), { role, updatedAt: new Date().toISOString() });
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async saveSong({ workspace, song }: { workspace: M.BandWorkspace; song: M.Song }): Promise<M.BandWorkspace> {
    await setDoc(this.entityDoc(workspace.id, C.songs, song.id), SongJson.toJson(song), { merge: true });
    await this.deleteDoc(workspace.id, C.songs, META.songs);
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async saveSongs({ workspace, songs }: { workspace: M.BandWorkspace; songs: M.Song[] }): Promise<M.BandWorkspace> {
    await this.replaceCollection(workspace.id, C.songs, META.songs, songs, s => s.id, SongJson.toJson);
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async updateSongAudio({ workspace, song, audioBytes, originalFileName }: { workspace: M.BandWorkspace; song: M.Song; audioBytes: ArrayBuffer; originalFileName: string }): Promise<M.BandWorkspace> {
    const ext = normalizeSongAudioExtension(originalFileName.split('.').pop() ?? '');
    if (!ext) throw new WorkspaceRepositoryException('Unsupported audio format. Use MP3, M4A, WAV, or AAC.');
    const ct = inferContentType(`audio.${ext}`);
    const path = `${STORAGE_FOLDER.songAudio}/${workspace.id}/${song.id}/audio_${Date.now()}.${ext}`;
    const ref = storageRef(getFirebase().storage, path);
    await uploadBytes(ref, new Uint8Array(audioBytes), { contentType: ct, cacheControl: 'public,max-age=3600' });
    const url = await getDownloadURL(ref);
    const previous = song.audioStoragePath?.trim();
    const updated: M.Song = {
      ...song,
      audioUrl: url, audioStoragePath: path,
      audioFileName: originalFileName.trim() || `audio.${ext}`,
      audioContentType: ct, audioSizeBytes: audioBytes.byteLength,
      audioUploadedAt: new Date(), audioUploadedByUid: workspace.currentUserId,
      updatedAt: new Date(),
    };
    await setDoc(this.entityDoc(workspace.id, C.songs, song.id), SongJson.toJson(updated), { merge: true });
    if (previous && previous !== path) {
      try { await deleteObject(storageRef(getFirebase().storage, previous)); } catch { /* */ }
    }
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async clearSongAudio({ workspace, song }: { workspace: M.BandWorkspace; song: M.Song }): Promise<M.BandWorkspace> {
    if (song.audioStoragePath) {
      try { await deleteObject(storageRef(getFirebase().storage, song.audioStoragePath)); } catch { /* */ }
    }
    const updated: M.Song = {
      ...song, audioUrl: null, audioStoragePath: null, audioFileName: null, audioContentType: null,
      audioSizeBytes: null, audioUploadedAt: null, audioUploadedByUid: null, updatedAt: new Date(),
    };
    await setDoc(this.entityDoc(workspace.id, C.songs, song.id), SongJson.toJson(updated), { merge: true });
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async deleteSong({ workspace, songId }: { workspace: M.BandWorkspace; songId: string }): Promise<M.BandWorkspace> {
    await deleteDoc(this.entityDoc(workspace.id, C.songs, songId));
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async saveSetlist({ workspace, setlist }: { workspace: M.BandWorkspace; setlist: M.BandSetlist }): Promise<M.BandWorkspace> {
    await setDoc(this.entityDoc(workspace.id, C.setlists, setlist.id), SetlistJson.toJson(setlist), { merge: true });
    await this.deleteDoc(workspace.id, C.setlists, META.setlists);
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }
  async deleteSetlist({ workspace, setlistId }: { workspace: M.BandWorkspace; setlistId: string }): Promise<M.BandWorkspace> {
    await deleteDoc(this.entityDoc(workspace.id, C.setlists, setlistId));
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async saveRelease({ workspace, release }: { workspace: M.BandWorkspace; release: M.SongRelease }): Promise<M.BandWorkspace> {
    await setDoc(this.entityDoc(workspace.id, C.releases, release.id), ReleaseJson.toJson(release), { merge: true });
    await this.deleteDoc(workspace.id, C.releases, META.releases);
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }
  async saveReleases({ workspace, releases }: { workspace: M.BandWorkspace; releases: M.SongRelease[] }): Promise<M.BandWorkspace> {
    await this.replaceCollection(workspace.id, C.releases, META.releases, releases, r => r.id, ReleaseJson.toJson);
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }
  async deleteRelease({ workspace, releaseId }: { workspace: M.BandWorkspace; releaseId: string }): Promise<M.BandWorkspace> {
    await deleteDoc(this.entityDoc(workspace.id, C.releases, releaseId));
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async saveEvent({ workspace, event }: { workspace: M.BandWorkspace; event: M.BandEvent }): Promise<M.BandWorkspace> {
    await setDoc(this.entityDoc(workspace.id, C.events, event.id), EventJson.toJson(event), { merge: true });
    await this.deleteDoc(workspace.id, C.events, META.events);
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }
  async deleteEvent({ workspace, eventId }: { workspace: M.BandWorkspace; eventId: string }): Promise<M.BandWorkspace> {
    await deleteDoc(this.entityDoc(workspace.id, C.events, eventId));
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async saveContact({ workspace, contact }: { workspace: M.BandWorkspace; contact: M.BandContact }): Promise<M.BandWorkspace> {
    await setDoc(this.entityDoc(workspace.id, C.contacts, contact.id), ContactJson.toJson(contact), { merge: true });
    await this.deleteDoc(workspace.id, C.contacts, META.contacts);
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }
  async deleteContact({ workspace, contactId }: { workspace: M.BandWorkspace; contactId: string }): Promise<M.BandWorkspace> {
    await deleteDoc(this.entityDoc(workspace.id, C.contacts, contactId));
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async saveTechnicalRider({ workspace, rider }: { workspace: M.BandWorkspace; rider: M.TechnicalRider }): Promise<M.BandWorkspace> {
    await setDoc(this.entityDoc(workspace.id, C.technicalRiders, rider.id), RiderJson.toJson(rider), { merge: true });
    await this.deleteDoc(workspace.id, C.technicalRiders, META.technicalRiders);
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }
  async deleteTechnicalRider({ workspace, riderId }: { workspace: M.BandWorkspace; riderId: string }): Promise<M.BandWorkspace> {
    await deleteDoc(this.entityDoc(workspace.id, C.technicalRiders, riderId));
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async saveTask({ workspace, task }: { workspace: M.BandWorkspace; task: M.BandTask }): Promise<M.BandWorkspace> {
    await setDoc(this.entityDoc(workspace.id, C.tasks, task.id), TaskJson.toJson(task), { merge: true });
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }
  async updateTaskStatus({ workspace, taskId, status }: { workspace: M.BandWorkspace; taskId: string; status: M.BandTaskStatus }): Promise<M.BandWorkspace> {
    await updateDoc(this.entityDoc(workspace.id, C.tasks, taskId), { status, updatedAt: new Date().toISOString() });
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }
  async deleteTask({ workspace, taskId }: { workspace: M.BandWorkspace; taskId: string }): Promise<M.BandWorkspace> {
    await deleteDoc(this.entityDoc(workspace.id, C.tasks, taskId));
    return this.loadWorkspaceById(workspace.id, workspace.currentUserId);
  }

  async selectWorkspace({ user, workspaceId }: { user: M.AuthUser; workspaceId: string }): Promise<M.BandWorkspace | null> {
    const memberSnap = await getDoc(this.memberDoc(workspaceId, user.id));
    if (!memberSnap.exists()) throw new WorkspaceRepositoryException('That workspace is no longer available.');
    await this.setSelectedWorkspaceId(user, workspaceId);
    return this.loadWorkspaceById(workspaceId, user.id);
  }

  async leaveWorkspace({ user, workspace }: { user: M.AuthUser; workspace: M.BandWorkspace }): Promise<void> {
    const memberSnap = await getDoc(this.memberDoc(workspace.id, user.id));
    if (!memberSnap.exists()) {
      await this.setSelectedWorkspaceId(user, null);
      return;
    }
    const leaving = MemberJson.fromJson(memberSnap.data());
    const allMembers = await getDocs(this.membersCol(workspace.id));
    const adminCount = allMembers.docs.filter(d => (d.data() as any).role === 'admin').length;
    if (leaving.role === M.BandRole.admin && adminCount <= 1) {
      throw new WorkspaceRepositoryException('Assign another admin before leaving this workspace.');
    }
    await deleteDoc(this.memberDoc(workspace.id, user.id));
    // Pick next workspace for the user.
    const remaining = await this.loadWorkspaceIdsForUser(user.id);
    await this.setSelectedWorkspaceId(user, remaining[0] ?? null);
  }

  // Internals ----------------------------------------------------------------

  private async loadWorkspaceById(wsId: string, currentUserId: string): Promise<M.BandWorkspace> {
    const wsSnap = await getDoc(this.workspaceDoc(wsId));
    if (!wsSnap.exists()) throw new WorkspaceRepositoryException('That workspace is no longer available.');
    const wsData = wsSnap.data() as any;
    const currentMemberSnap = await getDoc(this.memberDoc(wsId, currentUserId));
    if (!currentMemberSnap.exists()) throw new WorkspaceRepositoryException('That workspace is no longer available.');
    const currentMember = MemberJson.fromJson(currentMemberSnap.data());

    const [
      membersSnap, songsSnap, setlistsSnap, releasesSnap, eventsSnap, contactsSnap,
      ridersSnap, expensesSnap, incomesSnap, merchSnap, tasksSnap,
    ] = await Promise.all([
      getDocs(this.membersCol(wsId)),
      getDocs(this.entityCol(wsId, C.songs)),
      getDocs(this.entityCol(wsId, C.setlists)),
      getDocs(this.entityCol(wsId, C.releases)),
      getDocs(this.entityCol(wsId, C.events)),
      getDocs(this.entityCol(wsId, C.contacts)),
      getDocs(this.entityCol(wsId, C.technicalRiders)),
      getDocs(this.entityCol(wsId, C.expenses)),
      getDocs(this.entityCol(wsId, C.incomes)),
      getDocs(this.entityCol(wsId, C.merchItems)),
      getDocs(this.entityCol(wsId, C.tasks)),
    ]);

    const members = membersSnap.docs.map(d => MemberJson.fromJson(d.data()));
    const songs = this.entityList(songsSnap.docs, META.songs, SongJson.fromJson, wsData.songs);
    const setlists = this.entityList(setlistsSnap.docs, META.setlists, SetlistJson.fromJson, wsData.setlists);
    const releases = this.entityList(releasesSnap.docs, META.releases, ReleaseJson.fromJson, wsData.releases);
    const events = this.entityList(eventsSnap.docs, META.events, EventJson.fromJson, wsData.events);
    const contacts = this.entityList(contactsSnap.docs, META.contacts, ContactJson.fromJson, wsData.contacts);
    const riders = this.entityList(ridersSnap.docs, META.technicalRiders, RiderJson.fromJson, wsData.technicalRiders);
    const expenses = this.entityList(expensesSnap.docs, META.expenses, ExpenseJson.fromJson, wsData.expenses);
    const incomes = this.entityList(incomesSnap.docs, META.incomes, IncomeJson.fromJson, wsData.incomes);
    const merchItems = this.entityList(merchSnap.docs, META.merchItems, MerchItemJson.fromJson, wsData.merchItems);
    const embeddedTasks = ((wsData.tasks as any[]) ?? []).map(TaskJson.fromJson);
    const tasksById = new Map<string, M.BandTask>();
    for (const t of embeddedTasks) tasksById.set(t.id, t);
    for (const d of tasksSnap.docs) {
      const t = TaskJson.fromJson(jsonWithId(d));
      tasksById.set(t.id, t);
    }
    const tasks = [...tasksById.values()];

    let pendingInvites: M.BandInvite[] = [];
    if (currentMember.role === M.BandRole.admin) {
      const reqSnap = await getDocs(this.joinRequestsCol(wsId));
      pendingInvites = reqSnap.docs.map(d => InviteJson.fromJson(jsonWithId(d)))
        .sort((a, b) => (b.lastSentAt ?? b.createdAt).getTime() - (a.lastSentAt ?? a.createdAt).getTime());
    }

    const merged: any = {
      ...wsData,
      id: wsId,
      currentUserId,
      members: members.map(MemberJson.toJson),
      technicalRiders: riders.map(RiderJson.toJson),
      contacts: contacts.map(ContactJson.toJson),
      events: events.map(EventJson.toJson),
      songs: songs.map(SongJson.toJson),
      setlists: setlists.map(SetlistJson.toJson),
      releases: releases.map(ReleaseJson.toJson),
      expenses: expenses.map(ExpenseJson.toJson),
      incomes: incomes.map(IncomeJson.toJson),
      merchItems: merchItems.map(MerchItemJson.toJson),
      tasks: tasks.map(TaskJson.toJson),
      pendingInvites: pendingInvites.map(InviteJson.toJson),
      setlistsCount: setlists.length,
      contactsCount: wsData.contactsCount ?? 0,
      monthSpendEur: wsData.monthSpendEur ?? 0,
      releaseMilestoneLabel: wsData.releaseMilestoneLabel ?? '',
      updatedAt: wsData.updatedAt ?? new Date().toISOString(),
    };
    return WorkspaceJson.fromJson(merged);
  }

  private entityList<T>(docs: DocumentSnapshot[], metaId: string, fromJson: (j: any) => T, embeddedFallback?: any[]): T[] {
    const realDocs = docs.filter(d => d.id !== metaId && d.exists());
    if (realDocs.length > 0) return realDocs.map(d => fromJson(jsonWithId(d)));
    const hasMeta = docs.some(d => d.id === metaId && d.exists());
    if (hasMeta) return [];
    if (Array.isArray(embeddedFallback)) return embeddedFallback.map(fromJson);
    return [];
  }

  private async loadWorkspaceIdsForUser(uid: string): Promise<string[]> {
    const snap = await getDocs(this.workspacesCol());
    const checks = await Promise.all(snap.docs.map(async d => {
      const ms = await getDoc(this.memberDoc(d.id, uid));
      return ms.exists() ? d.id : null;
    }));
    return checks.filter((s): s is string => !!s);
  }

  private async loadPendingAccessRecords(user: M.AuthUser): Promise<Array<{ access: M.PendingWorkspaceAccess; timestamp: Date }>> {
    const normalizedEmail = user.email.trim().toLowerCase();
    const snap = await getDocs(this.workspacesCol());
    const records: Array<{ access: M.PendingWorkspaceAccess; timestamp: Date }> = [];
    for (const wsDoc of snap.docs) {
      const reqSnap = await getDoc(this.joinRequestDoc(wsDoc.id, this.joinRequestIdForUser(user.id)));
      if (!reqSnap.exists()) continue;
      const invite = InviteJson.fromJson(jsonWithId(reqSnap));
      const matchesUser = invite.requestedUserId === user.id;
      const matchesEmail = !!normalizedEmail && invite.email.trim().toLowerCase() === normalizedEmail;
      if (!matchesUser && !matchesEmail) continue;
      if (invite.status !== M.BandInviteStatus.pending && invite.status !== M.BandInviteStatus.declined) continue;
      const data = wsDoc.data() as any;
      records.push({
        access: {
          workspaceId: wsDoc.id, bandName: data.bandName ?? '', genre: data.genre ?? '',
          inviteCode: data.inviteCode ?? '', inviteId: invite.id, status: invite.status,
        },
        timestamp: invite.lastSentAt ?? invite.createdAt,
      });
    }
    return records;
  }

  private async findWorkspaceByInviteCode(code: string): Promise<DocumentSnapshot | null> {
    const lookup = inviteCodeLookup(code);
    const byLookup = await getDocs(query(this.workspacesCol(), where(INVITE_LOOKUP_FIELD, '==', lookup), limit(1)));
    if (!byLookup.empty) return byLookup.docs[0];
    const canonical = canonicalInviteCode(code);
    const byCanonical = await getDocs(query(this.workspacesCol(), where('inviteCode', '==', canonical), limit(1)));
    return byCanonical.empty ? null : byCanonical.docs[0];
  }

  private async setSelectedWorkspaceId(user: M.AuthUser, wsId: string | null): Promise<void> {
    await setDoc(this.userDoc(user.id),
      userDocFields({ email: user.email, displayName: user.displayName, selectedWorkspaceId: wsId, includeSelectedWorkspaceId: true }),
      { merge: true });
  }

  private async syncMembers(workspace: M.BandWorkspace): Promise<void> {
    const existing = await getDocs(this.membersCol(workspace.id));
    const existingIds = new Set(existing.docs.map(d => d.id));
    const nextIds = new Set(workspace.members.map(m => m.userId));
    const batch = writeBatch(getFirebase().firestore);
    for (const m of workspace.members) batch.set(this.memberDoc(workspace.id, m.userId), MemberJson.toJson(m));
    for (const id of existingIds) if (!nextIds.has(id)) batch.delete(this.memberDoc(workspace.id, id));
    await batch.commit();
  }

  private async syncJoinRequests(workspace: M.BandWorkspace): Promise<void> {
    const existing = await getDocs(this.joinRequestsCol(workspace.id));
    const existingIds = new Set(existing.docs.map(d => d.id));
    const nextIds = new Set(workspace.pendingInvites.map(i => i.id));
    const batch = writeBatch(getFirebase().firestore);
    for (const i of workspace.pendingInvites) batch.set(this.joinRequestDoc(workspace.id, i.id), InviteJson.toJson(i));
    for (const id of existingIds) if (!nextIds.has(id)) batch.delete(this.joinRequestDoc(workspace.id, id));
    await batch.commit();
  }

  private async replaceCollection<T>(
    wsId: string, name: string, metaId: string,
    items: T[], idOf: (item: T) => string, toJson: (item: T) => any,
  ): Promise<void> {
    const col = this.entityCol(wsId, name);
    const existing = await getDocs(col);
    const existingIds = new Set(existing.docs.filter(d => d.id !== metaId).map(d => d.id));
    const nextIds = new Set(items.map(idOf));
    const batch = writeBatch(getFirebase().firestore);
    for (const item of items) batch.set(this.entityDoc(wsId, name, idOf(item)), toJson(item));
    for (const id of existingIds) if (!nextIds.has(id)) batch.delete(this.entityDoc(wsId, name, id));
    if (items.length === 0) {
      batch.set(this.entityDoc(wsId, name, metaId), { kind: `${name}Meta`, updatedAt: new Date().toISOString() });
    } else {
      batch.delete(this.entityDoc(wsId, name, metaId));
    }
    await batch.commit();
  }

  private async deleteDoc(wsId: string, name: string, id: string): Promise<void> {
    try { await deleteDoc(this.entityDoc(wsId, name, id)); } catch { /* */ }
  }
}
