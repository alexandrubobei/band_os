import { Injectable, computed, inject, signal } from '@angular/core';
import {
  collection, doc, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy, Timestamp, increment, arrayUnion, arrayRemove,
} from 'firebase/firestore';
import { getFirebase } from '../firebase/firebase-bootstrap';
import { AuthController } from '../state/auth-controller.service';
import * as M from '../models/models';

export interface ActiveConversation {
  kind: M.ConversationKind;
  id: string;
}

@Injectable({ providedIn: 'root' })
export class MessagingService {
  private readonly auth = inject(AuthController);

  private currentWorkspaceId: string | null = null;

  // ── State signals ───────────────────────────────────────────
  readonly channels = signal<M.ChatChannel[]>([]);
  readonly dms = signal<M.DmConversation[]>([]);
  /** Per-conversation read counts for the current user: convId -> count. */
  readonly readCounts = signal<Record<string, number>>({});
  readonly active = signal<ActiveConversation | null>(null);
  readonly messages = signal<M.ChatMessage[]>([]);

  // ── Listener handles ────────────────────────────────────────
  private channelsUnsub: (() => void) | null = null;
  private dmsUnsub: (() => void) | null = null;
  private readStateUnsub: (() => void) | null = null;
  private messagesUnsub: (() => void) | null = null;
  private seededDefault = false;

  // ── Derived ─────────────────────────────────────────────────
  /** Unread count for a conversation = messageCount - readCount (never negative). */
  unreadFor(kind: M.ConversationKind, id: string): number {
    const conv = kind === 'channel'
      ? this.channels().find(c => c.id === id)
      : this.dms().find(d => d.id === id);
    if (!conv) return 0;
    const read = this.readCounts()[id] ?? 0;
    return Math.max(0, conv.messageCount - read);
  }

  readonly totalUnread = computed(() => {
    const reads = this.readCounts();
    let total = 0;
    for (const c of this.channels()) total += Math.max(0, c.messageCount - (reads[c.id] ?? 0));
    for (const d of this.dms()) total += Math.max(0, d.messageCount - (reads[d.id] ?? 0));
    return total;
  });

  // ── Lifecycle ───────────────────────────────────────────────
  startTracking(workspaceId: string): void {
    if (this.currentWorkspaceId === workspaceId && this.channelsUnsub) return;
    this.stopTracking();
    this.currentWorkspaceId = workspaceId;
    this.seededDefault = false;

    const fs = getFirebase().firestore;
    const uid = this.auth.user?.id;

    // Channels — all band-wide channels, ordered by creation.
    const channelsCol = collection(fs, `workspaces/${workspaceId}/channels`);
    this.channelsUnsub = onSnapshot(query(channelsCol, orderBy('createdAt', 'asc')), (snap) => {
      const list = snap.docs.map(d => this.toChannel(d.id, d.data()));
      this.channels.set(list);
      if (!list.length && !this.seededDefault) {
        this.seededDefault = true;
        void this.ensureDefaultChannel();
      }
    });

    // DMs — only conversations that include me.
    if (uid) {
      const dmsCol = collection(fs, `workspaces/${workspaceId}/dms`);
      this.dmsUnsub = onSnapshot(
        query(dmsCol, where('participants', 'array-contains', uid)),
        (snap) => this.dms.set(snap.docs.map(d => this.toDm(d.id, d.data()))),
      );

      // My read-state doc.
      const readRef = doc(fs, `workspaces/${workspaceId}/messagingReadState/${uid}`);
      this.readStateUnsub = onSnapshot(readRef, (snap) => {
        this.readCounts.set((snap.data()?.['counts'] as Record<string, number>) ?? {});
      });
    }
  }

  stopTracking(): void {
    this.channelsUnsub?.(); this.channelsUnsub = null;
    this.dmsUnsub?.(); this.dmsUnsub = null;
    this.readStateUnsub?.(); this.readStateUnsub = null;
    this.messagesUnsub?.(); this.messagesUnsub = null;
    this.channels.set([]); this.dms.set([]); this.messages.set([]);
    this.readCounts.set({}); this.active.set(null);
    this.currentWorkspaceId = null;
  }

  // ── Open / read ─────────────────────────────────────────────
  openConversation(kind: M.ConversationKind, id: string): void {
    const cur = this.active();
    if (cur && cur.kind === kind && cur.id === id && this.messagesUnsub) return;

    this.messagesUnsub?.(); this.messagesUnsub = null;
    this.messages.set([]);
    this.active.set({ kind, id });

    const ws = this.currentWorkspaceId;
    if (!ws) return;
    // Single-level collection (like activities) + client-side sort — avoids a nested
    // subcollection (rules) and a composite index (where + orderBy on different fields).
    const msgsCol = collection(getFirebase().firestore, `workspaces/${ws}/messages`);
    this.messagesUnsub = onSnapshot(
      query(msgsCol, where('conversationId', '==', id)),
      (snap) => {
        const list = snap.docs
          .map(d => this.toMessage(d.id, d.data()))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        this.messages.set(list);
        void this.markActiveRead();
      },
      (err) => console.error('[Messaging] messages listener error', err),
    );
  }

  async markActiveRead(): Promise<void> {
    const ws = this.currentWorkspaceId;
    const uid = this.auth.user?.id;
    const a = this.active();
    if (!ws || !uid || !a) return;
    const conv = a.kind === 'channel'
      ? this.channels().find(c => c.id === a.id)
      : this.dms().find(d => d.id === a.id);
    if (!conv) return;
    const readRef = doc(getFirebase().firestore, `workspaces/${ws}/messagingReadState/${uid}`);
    try {
      await setDoc(readRef, { counts: { [a.id]: conv.messageCount } }, { merge: true });
    } catch (e) { console.error('[Messaging] markRead failed', e); }
  }

  // ── Channels ────────────────────────────────────────────────
  private async ensureDefaultChannel(): Promise<void> {
    const ws = this.currentWorkspaceId;
    const uid = this.auth.user?.id;
    if (!ws || !uid) return;
    const ref = doc(getFirebase().firestore, `workspaces/${ws}/channels/general`);
    try {
      await setDoc(ref, {
        name: 'general', description: 'Band-wide chat', isDefault: true,
        createdAt: Timestamp.now(), createdBy: uid, messageCount: 0,
      }, { merge: true });
    } catch (e) { console.error('[Messaging] seed #general failed', e); }
  }

  async createChannel(name: string, description?: string): Promise<string | null> {
    const ws = this.currentWorkspaceId;
    const uid = this.auth.user?.id;
    if (!ws || !uid) return null;
    const clean = name.trim().replace(/^#+/, '').replace(/\s+/g, '-').toLowerCase();
    if (!clean) return null;
    const col = collection(getFirebase().firestore, `workspaces/${ws}/channels`);
    const ref = await addDoc(col, {
      name: clean, description: description?.trim() || null, isDefault: false,
      createdAt: Timestamp.now(), createdBy: uid, messageCount: 0,
    });
    return ref.id;
  }

  // ── DMs ─────────────────────────────────────────────────────
  /** Ensure a DM conversation exists with `otherUserId` and return its id. */
  async openOrCreateDm(otherUserId: string): Promise<string | null> {
    const ws = this.currentWorkspaceId;
    const uid = this.auth.user?.id;
    if (!ws || !uid) return null;
    const id = M.dmConversationId(uid, otherUserId);
    const ref = doc(getFirebase().firestore, `workspaces/${ws}/dms/${id}`);
    try {
      await setDoc(ref, {
        participants: [uid, otherUserId].sort(),
        createdAt: Timestamp.now(), messageCount: 0,
      }, { merge: true });
    } catch (e) { console.error('[Messaging] create DM failed', e); }
    return id;
  }

  // ── Messages ────────────────────────────────────────────────
  async sendMessage(text: string): Promise<void> {
    const ws = this.currentWorkspaceId;
    const user = this.auth.user;
    const a = this.active();
    const body = text.trim();
    if (!ws || !user || !a || !body) return;
    const fs = getFirebase().firestore;
    try {
      await addDoc(collection(fs, `workspaces/${ws}/messages`), {
        conversationKind: a.kind, conversationId: a.id,
        authorId: user.id, authorName: user.displayName, text: body,
        createdAt: Timestamp.now(), reactions: {},
      });
      await updateDoc(doc(fs, this.basePath(a.kind, a.id)), {
        messageCount: increment(1),
        lastMessageAt: Timestamp.now(),
        lastMessageText: body.slice(0, 140),
        lastMessageBy: user.id,
      });
    } catch (e) { console.error('[Messaging] send failed', e); }
  }

  async editMessage(messageId: string, text: string): Promise<void> {
    const a = this.active(); const ws = this.currentWorkspaceId;
    const body = text.trim();
    if (!a || !ws || !body) return;
    const ref = doc(getFirebase().firestore, `workspaces/${ws}/messages/${messageId}`);
    try { await updateDoc(ref, { text: body, editedAt: Timestamp.now() }); }
    catch (e) { console.error('[Messaging] edit failed', e); }
  }

  async deleteMessage(messageId: string): Promise<void> {
    const a = this.active(); const ws = this.currentWorkspaceId;
    if (!a || !ws) return;
    const ref = doc(getFirebase().firestore, `workspaces/${ws}/messages/${messageId}`);
    try { await deleteDoc(ref); }
    catch (e) { console.error('[Messaging] delete failed', e); }
  }

  async toggleReaction(messageId: string, emoji: string): Promise<void> {
    const a = this.active(); const ws = this.currentWorkspaceId; const uid = this.auth.user?.id;
    if (!a || !ws || !uid) return;
    const msg = this.messages().find(m => m.id === messageId);
    const mine = msg?.reactions?.[emoji]?.includes(uid) ?? false;
    const ref = doc(getFirebase().firestore, `workspaces/${ws}/messages/${messageId}`);
    try {
      await updateDoc(ref, {
        [`reactions.${emoji}`]: mine ? arrayRemove(uid) : arrayUnion(uid),
      });
    } catch (e) { console.error('[Messaging] reaction failed', e); }
  }

  // ── Helpers ─────────────────────────────────────────────────
  private basePath(kind: M.ConversationKind, id: string): string {
    const ws = this.currentWorkspaceId;
    return kind === 'channel'
      ? `workspaces/${ws}/channels/${id}`
      : `workspaces/${ws}/dms/${id}`;
  }

  private toChannel(id: string, d: any): M.ChatChannel {
    return {
      id, name: d.name, description: d.description ?? null, isDefault: !!d.isDefault,
      createdAt: d.createdAt?.toDate?.() ?? new Date(), createdBy: d.createdBy,
      messageCount: d.messageCount ?? 0,
      lastMessageAt: d.lastMessageAt?.toDate?.() ?? null,
      lastMessageText: d.lastMessageText ?? null, lastMessageBy: d.lastMessageBy ?? null,
    };
  }

  private toDm(id: string, d: any): M.DmConversation {
    return {
      id, participants: d.participants ?? [],
      createdAt: d.createdAt?.toDate?.() ?? new Date(),
      messageCount: d.messageCount ?? 0,
      lastMessageAt: d.lastMessageAt?.toDate?.() ?? null,
      lastMessageText: d.lastMessageText ?? null, lastMessageBy: d.lastMessageBy ?? null,
    };
  }

  private toMessage(id: string, d: any): M.ChatMessage {
    return {
      id, authorId: d.authorId, authorName: d.authorName, text: d.text,
      createdAt: d.createdAt?.toDate?.() ?? new Date(),
      editedAt: d.editedAt?.toDate?.() ?? null,
      reactions: d.reactions ?? {},
    };
  }
}
