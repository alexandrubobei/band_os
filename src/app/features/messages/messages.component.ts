import { Component, ElementRef, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MessagingService } from '../../core/services/messaging.service';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { AuthController } from '../../core/state/auth-controller.service';
import * as M from '../../core/models/models';

@Component({
  selector: 'messages-screen',
  standalone: true,
  imports: [CommonModule, FormsModule, MatIconModule, MatButtonModule, MatTooltipModule],
  template: `
    <div class="msg-layout">
      <!-- ── Sidebar: channels + DMs ── -->
      <aside class="chat-sidebar">
        <div class="cs-section">
          <div class="cs-head">
            <span>Channels</span>
            <button class="cs-add" (click)="toggleCreate()" matTooltip="New channel"><mat-icon>add</mat-icon></button>
          </div>
          @if (creating()) {
            <div class="cs-new">
              <input #newInput class="cs-new-input" [(ngModel)]="newChannelName" placeholder="channel-name"
                     (keydown.enter)="confirmCreate()" (keydown.escape)="cancelCreate()" />
              <button class="cs-new-go" (click)="confirmCreate()"><mat-icon>check</mat-icon></button>
            </div>
          }
          @for (c of channels(); track c.id) {
            <button class="cs-item" [class.active]="isActive('channel', c.id)" (click)="openChannel(c.id)">
              <span class="cs-hash">#</span>
              <span class="cs-name">{{ c.name }}</span>
              @if (unread('channel', c.id); as n) { <span class="cs-badge">{{ n }}</span> }
            </button>
          }
        </div>

        <div class="cs-section">
          <div class="cs-head"><span>Direct Messages</span></div>
          @for (m of otherMembers(); track m.userId) {
            <button class="cs-item" [class.active]="isActiveDm(m.userId)" (click)="openDm(m.userId)">
              <span class="cs-avatar" [style.background]="colorFor(m.userId)">{{ initials(m.displayName) }}</span>
              <span class="cs-name">{{ m.displayName }}</span>
              @if (unread('dm', dmId(m.userId)); as n) { <span class="cs-badge">{{ n }}</span> }
            </button>
          }
          @if (!otherMembers().length) {
            <p class="cs-empty">Invite bandmates to start a DM.</p>
          }
        </div>
      </aside>

      <!-- ── Thread ── -->
      <section class="thread">
        @if (active()) {
          <header class="thread-head">
            <span class="th-title">{{ activeTitle() }}</span>
          </header>

          <div class="thread-messages" #threadEl>
            @if (!messages().length) {
              <p class="thread-empty">No messages yet — say hi 👋</p>
            }
            @for (msg of messages(); track msg.id) {
              <div class="msg" [class.mine]="msg.authorId === myId()">
                <span class="msg-avatar" [style.background]="colorFor(msg.authorId)">{{ initials(msg.authorName) }}</span>
                <div class="msg-col">
                  <div class="msg-meta">
                    @if (msg.authorId !== myId()) { <span class="msg-author">{{ msg.authorName }}</span> }
                    <span class="msg-time">{{ timeLabel(msg.createdAt) }}</span>
                    @if (msg.editedAt) { <span class="msg-edited">(edited)</span> }
                  </div>

                  @if (editingId() === msg.id) {
                    <div class="msg-edit">
                      <textarea class="msg-edit-input" [(ngModel)]="editText" rows="2"
                                (keydown.escape)="cancelEdit()"></textarea>
                      <div class="msg-edit-actions">
                        <button class="mini-btn" (click)="saveEdit(msg.id)">Save</button>
                        <button class="mini-btn ghost" (click)="cancelEdit()">Cancel</button>
                      </div>
                    </div>
                  } @else {
                    <div class="msg-text">{{ msg.text }}</div>
                  }

                  @if (reactionEntries(msg); as rx) {
                    @if (rx.length) {
                      <div class="msg-reactions">
                        @for (r of rx; track r.emoji) {
                          <button class="rx-chip" [class.mine]="r.mine" (click)="react(msg.id, r.emoji)">
                            <span>{{ r.emoji }}</span><span class="rx-count">{{ r.count }}</span>
                          </button>
                        }
                      </div>
                    }
                  }

                  <div class="msg-actions">
                    <button class="act" matTooltip="React" (click)="togglePicker(msg.id)"><mat-icon>add_reaction</mat-icon></button>
                    @if (msg.authorId === myId()) {
                      <button class="act" matTooltip="Edit" (click)="startEdit(msg)"><mat-icon>edit</mat-icon></button>
                      <button class="act danger" matTooltip="Delete" (click)="remove(msg.id)"><mat-icon>delete_outline</mat-icon></button>
                    }
                    @if (pickerFor() === msg.id) {
                      <div class="emoji-pop">
                        @for (e of EMOJIS; track e) {
                          <button class="emoji-opt" (click)="react(msg.id, e)">{{ e }}</button>
                        }
                      </div>
                    }
                  </div>
                </div>
              </div>
            }
          </div>

          <footer class="composer">
            <textarea class="composer-input" [(ngModel)]="draft" rows="1"
                      [placeholder]="'Message ' + activeTitle()"
                      (keydown)="onKey($event)"></textarea>
            <button class="composer-send" [disabled]="!draft.trim()" (click)="send()">
              <mat-icon>send</mat-icon>
            </button>
          </footer>
        } @else {
          <div class="thread-placeholder">
            <mat-icon>forum</mat-icon>
            <p>Select a channel or member to start chatting.</p>
          </div>
        }
      </section>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .msg-layout { display: grid; grid-template-columns: 240px 1fr; height: 100%; min-height: 0; }

    /* ── Sidebar ── */
    .chat-sidebar { background: #16161B; border-right: 1px solid #383842; overflow-y: auto; padding: 12px 8px; display: flex; flex-direction: column; gap: 18px; }
    .cs-section { display: flex; flex-direction: column; gap: 2px; }
    .cs-head { display: flex; align-items: center; justify-content: space-between; padding: 4px 8px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9D9DA7; }
    .cs-add { background: none; border: none; color: #9D9DA7; cursor: pointer; display: flex; padding: 2px; border-radius: 6px; }
    .cs-add:hover { color: #C8A77B; background: #20202A; }
    .cs-add mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .cs-new { display: flex; gap: 4px; padding: 2px 6px 6px; }
    .cs-new-input { flex: 1; min-width: 0; background: #14141A; border: 1px solid #383842; border-radius: 8px; color: #CDCDD3; padding: 6px 8px; font-size: 13px; outline: none; }
    .cs-new-input:focus { border-color: #C8A77B; }
    .cs-new-go { background: #C8A77B; border: none; border-radius: 8px; color: #16161B; cursor: pointer; display: flex; align-items: center; padding: 0 8px; }
    .cs-new-go mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .cs-item { display: flex; align-items: center; gap: 8px; width: 100%; background: none; border: none; cursor: pointer; padding: 7px 8px; border-radius: 8px; color: #C7C7CF; font-size: 13px; font-weight: 600; text-align: left; }
    .cs-item:hover { background: #20202A; color: #CDCDD3; }
    .cs-item.active { background: rgba(200,167,123,0.16); color: #C8A77B; }
    .cs-hash { color: #6B6D7A; font-weight: 700; }
    .cs-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .cs-avatar { width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #14141A; flex-shrink: 0; }
    .cs-badge { background: #EF4A35; color: #fff; font-size: 10px; font-weight: 800; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; }
    .cs-empty { color: #6B6D7A; font-size: 12px; padding: 4px 8px; margin: 0; }

    /* ── Thread ── */
    .thread { display: flex; flex-direction: column; min-width: 0; min-height: 0; background: #14141A; }
    .thread-head { flex-shrink: 0; padding: 14px 20px; border-bottom: 1px solid #383842; }
    .th-title { font-weight: 800; font-size: 16px; color: #CDCDD3; }
    .thread-messages { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 4px; }
    /* Anchor messages to the bottom; spacer collapses once they overflow (so scroll-up still works). */
    .thread-messages::before { content: ''; margin-top: auto; }
    .thread-empty { color: #6B6D7A; text-align: center; margin: auto; }

    .msg { display: flex; gap: 10px; padding: 5px 8px; position: relative; align-items: flex-start; }
    .msg.mine { flex-direction: row-reverse; }
    .msg-avatar { width: 34px; height: 34px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: #14141A; flex-shrink: 0; }
    .msg-col { display: flex; flex-direction: column; max-width: 70%; min-width: 0; position: relative; }
    .msg.mine .msg-col { align-items: flex-end; }
    .msg-meta { display: flex; align-items: baseline; gap: 8px; margin-bottom: 3px; padding: 0 4px; }
    .msg-author { font-weight: 700; font-size: 13px; color: #CDCDD3; }
    .msg-time { font-size: 11px; color: #6B6D7A; }
    .msg-edited { font-size: 10px; color: #6B6D7A; font-style: italic; }
    .msg-text { padding: 9px 13px; border-radius: 16px; border-bottom-left-radius: 5px; font-size: 14px; line-height: 1.45; white-space: pre-wrap; word-break: break-word; background: #23232E; color: #C7C7CF; }
    .msg.mine .msg-text { background: #C8A77B; color: #16161B; border-bottom-left-radius: 16px; border-bottom-right-radius: 5px; }

    .msg-reactions { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 5px; }
    .msg.mine .msg-reactions { justify-content: flex-end; }
    .rx-chip { display: inline-flex; align-items: center; gap: 4px; background: #20202A; border: 1px solid #383842; border-radius: 999px; padding: 2px 8px; cursor: pointer; font-size: 12px; color: #C7C7CF; }
    .rx-chip.mine { border-color: #C8A77B; background: rgba(200,167,123,0.15); color: #C8A77B; }
    .rx-count { font-size: 11px; font-weight: 700; }

    .msg-actions { position: absolute; top: -13px; right: 0; display: flex; gap: 2px; background: #20202A; border: 1px solid #383842; border-radius: 8px; padding: 2px; opacity: 0; transition: opacity 0.12s ease; z-index: 3; }
    .msg.mine .msg-actions { right: auto; left: 0; }
    .msg:hover .msg-actions { opacity: 1; }
    .act { background: none; border: none; color: #9D9DA7; cursor: pointer; display: flex; padding: 4px; border-radius: 6px; }
    .act:hover { background: #14141A; color: #C8A77B; }
    .act.danger:hover { color: #EF4A35; }
    .act mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .emoji-pop { position: absolute; top: 110%; right: 0; display: flex; gap: 2px; background: #20202A; border: 1px solid #383842; border-radius: 10px; padding: 4px; z-index: 5; }
    .emoji-opt { background: none; border: none; cursor: pointer; font-size: 18px; padding: 2px 4px; border-radius: 6px; }
    .emoji-opt:hover { background: #14141A; }

    .msg-edit { margin-top: 4px; }
    .msg-edit-input { width: 100%; background: #14141A; border: 1px solid #C8A77B; border-radius: 8px; color: #CDCDD3; padding: 8px; font-size: 14px; resize: vertical; outline: none; font-family: inherit; }
    .msg-edit-actions { display: flex; gap: 6px; margin-top: 6px; }
    .mini-btn { background: #C8A77B; color: #16161B; border: none; border-radius: 7px; padding: 5px 12px; font-size: 12px; font-weight: 700; cursor: pointer; }
    .mini-btn.ghost { background: transparent; color: #9D9DA7; border: 1px solid #383842; }

    /* ── Composer ── */
    .composer { flex-shrink: 0; display: flex; gap: 8px; padding: 14px 20px; border-top: 1px solid #383842; align-items: flex-end; }
    .composer-input { flex: 1; background: #20202A; border: 1px solid #383842; border-radius: 12px; color: #CDCDD3; padding: 11px 14px; font-size: 14px; resize: none; outline: none; font-family: inherit; max-height: 160px; line-height: 1.4; }
    .composer-input:focus { border-color: #C8A77B; }
    .composer-send { background: #C8A77B; border: none; border-radius: 12px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #16161B; flex-shrink: 0; }
    .composer-send:hover:not(:disabled) { background: #D4B68C; }
    .composer-send:disabled { opacity: 0.4; cursor: default; }

    .thread-placeholder { margin: auto; text-align: center; color: #6B6D7A; display: flex; flex-direction: column; align-items: center; gap: 8px; }
    .thread-placeholder mat-icon { font-size: 40px; width: 40px; height: 40px; color: #383842; }

    @media (max-width: 760px) {
      .msg-layout { grid-template-columns: 1fr; }
      .chat-sidebar { display: none; }
    }
  `],
})
export class MessagesComponent {
  private readonly messaging = inject(MessagingService);
  private readonly wsc = inject(WorkspaceController);
  private readonly auth = inject(AuthController);

  readonly EMOJIS = ['👍', '❤️', '😂', '🎸', '🔥', '🎉'];

  readonly channels = this.messaging.channels;
  readonly active = this.messaging.active;
  readonly messages = this.messaging.messages;

  readonly myId = computed(() => this.auth.user?.id ?? '');
  readonly ws = computed(() => this.wsc.workspace());
  readonly otherMembers = computed(() => {
    const w = this.ws();
    return w ? w.members.filter(m => m.userId !== this.myId()) : [];
  });

  readonly activeTitle = computed(() => {
    const a = this.active();
    if (!a) return '';
    if (a.kind === 'channel') {
      const c = this.channels().find(x => x.id === a.id);
      return c ? '# ' + c.name : '#';
    }
    const otherId = a.id.split('__').find(x => x !== this.myId());
    return this.memberName(otherId ?? '') || 'Direct message';
  });

  draft = '';
  editText = '';
  newChannelName = '';
  readonly creating = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly pickerFor = signal<string | null>(null);

  @ViewChild('threadEl') threadEl?: ElementRef<HTMLDivElement>;

  constructor() {
    // Auto-open the default channel once channels load (no active conversation yet).
    effect(() => {
      const chans = this.channels();
      if (!this.active() && chans.length) {
        const def = chans.find(c => c.isDefault) ?? chans[0];
        this.messaging.openConversation('channel', def.id);
      }
    }, { allowSignalWrites: true });

    // Auto-scroll to newest on message changes.
    effect(() => {
      this.messages();
      setTimeout(() => this.scrollToBottom(), 0);
    });
  }

  // ── Sidebar actions ──
  isActive(kind: M.ConversationKind, id: string): boolean {
    const a = this.active();
    return !!a && a.kind === kind && a.id === id;
  }
  isActiveDm(otherUserId: string): boolean { return this.isActive('dm', this.dmId(otherUserId)); }
  dmId(otherUserId: string): string { return M.dmConversationId(this.myId(), otherUserId); }
  unread(kind: M.ConversationKind, id: string): number { return this.messaging.unreadFor(kind, id); }

  openChannel(id: string): void { this.pickerFor.set(null); this.messaging.openConversation('channel', id); }
  async openDm(otherUserId: string): Promise<void> {
    this.pickerFor.set(null);
    const id = await this.messaging.openOrCreateDm(otherUserId);
    if (id) this.messaging.openConversation('dm', id);
  }

  toggleCreate(): void { this.creating.update(v => !v); this.newChannelName = ''; }
  cancelCreate(): void { this.creating.set(false); this.newChannelName = ''; }
  async confirmCreate(): Promise<void> {
    const name = this.newChannelName.trim();
    if (!name) { this.cancelCreate(); return; }
    const id = await this.messaging.createChannel(name);
    this.cancelCreate();
    if (id) this.messaging.openConversation('channel', id);
  }

  // ── Composer ──
  onKey(ev: KeyboardEvent): void {
    if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); this.send(); }
  }
  send(): void {
    const text = this.draft.trim();
    if (!text) return;
    this.draft = '';
    void this.messaging.sendMessage(text);
  }

  // ── Message actions ──
  togglePicker(id: string): void { this.pickerFor.update(c => (c === id ? null : id)); }
  react(messageId: string, emoji: string): void {
    this.pickerFor.set(null);
    void this.messaging.toggleReaction(messageId, emoji);
  }
  startEdit(msg: M.ChatMessage): void { this.editingId.set(msg.id); this.editText = msg.text; }
  cancelEdit(): void { this.editingId.set(null); this.editText = ''; }
  saveEdit(id: string): void {
    const text = this.editText.trim();
    if (text) void this.messaging.editMessage(id, text);
    this.cancelEdit();
  }
  remove(id: string): void { void this.messaging.deleteMessage(id); }

  reactionEntries(msg: M.ChatMessage): { emoji: string; count: number; mine: boolean }[] {
    const rx = msg.reactions ?? {};
    const me = this.myId();
    return Object.keys(rx)
      .map(emoji => ({ emoji, count: rx[emoji]?.length ?? 0, mine: !!rx[emoji]?.includes(me) }))
      .filter(r => r.count > 0);
  }

  // ── Member display helpers ──
  memberName(uid: string): string { return this.ws()?.members.find(m => m.userId === uid)?.displayName ?? ''; }
  initials(name: string): string { return M.memberInitials(name); }
  colorFor(uid: string): string {
    const m = this.ws()?.members.find(x => x.userId === uid);
    if (m?.assignedColor) return m.assignedColor;
    const palette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#C8A77B', '#A8D5BA', '#FF8C94'];
    let hash = 0;
    for (let i = 0; i < uid.length; i++) hash = ((hash << 5) - hash) + uid.charCodeAt(i) | 0;
    return palette[Math.abs(hash) % palette.length];
  }

  timeLabel(d: Date): string {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  private scrollToBottom(): void {
    const el = this.threadEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }
}
