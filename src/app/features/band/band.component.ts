import { Component, computed, inject, signal, HostListener, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar } from '@angular/material/snack-bar';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import { BandAvatarComponent } from '../../shared/components/band-avatar.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'invite-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <form [formGroup]="form" class="bandos-stack">
      <mat-form-field appearance="outline"><mat-label>Display name</mat-label><input matInput formControlName="displayName" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput formControlName="email" /></mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Role</mat-label>
        <mat-select formControlName="role">
          @for (r of roles; track r) { <mat-option [value]="r">{{ roleLabel(r) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
        <button mat-button type="button" (click)="cancel.emit()">Cancel</button>
        <button mat-flat-button color="primary" type="button" (click)="save()">Send invite</button>
      </div>
    </form>
  `,
})
export class InviteForm {
  private readonly fb = inject(FormBuilder);
  roles = Object.values(M.BandRole);
  roleLabel(r: M.BandRole) { return M.BandRoleLabel[r]; }
  form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    role: [M.BandRole.member],
  });

  @Output() done = new EventEmitter<M.BandInvite>();
  @Output() cancel = new EventEmitter<void>();

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const invite: M.BandInvite = {
      id: uuid(), displayName: v.displayName, email: v.email.toLowerCase(),
      role: v.role, status: M.BandInviteStatus.pending,
      createdAt: new Date(), lastSentAt: new Date(),
    };
    this.done.emit(invite);
  }
}

@Component({
  selector: 'band-screen',
  standalone: true,
  imports: [
    CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatMenuModule,
    BandAvatarComponent, ScreenHeaderComponent, InviteForm,
  ],
  template: `
    <div class="bandos-page">
      <screen-header [title]="ws()?.bandName ?? 'Band'" subtitle="Members, roles, invite code, and plan."></screen-header>

      <div class="bandos-card">
        <div class="bandos-row" style="justify-content:space-between;align-items:center;">
          <div>
            <div class="bandos-muted" style="font-size:12px;">Invite code</div>
            <div style="font-size:22px;font-weight:800;letter-spacing:2px;">{{ ws()?.inviteCode }}</div>
          </div>
          <button mat-stroked-button (click)="copyInvite()">Copy</button>
        </div>
      </div>

      <div class="bandos-card">
        <div class="bandos-row" style="justify-content:space-between;align-items:center;">
          <h3 class="bandos-section-title">Members ({{ ws()?.members?.length ?? 0 }})</h3>
          @if (canManage()) { <button mat-flat-button color="primary" (click)="invite()">+ Invite member</button> }
        </div>
        <div class="bandos-stack" style="margin-top:12px;">
          @for (m of ws()?.members ?? []; track m.userId) {
            <div class="member-row">
              <band-avatar [displayName]="m.displayName" [size]="40"></band-avatar>
              <div style="flex:1;">
                <div class="m-name">{{ m.displayName }} @if (m.userId === ws()?.currentUserId) { <span class="bandos-pill secondary">you</span> }</div>
                <div class="m-meta">{{ m.email }}</div>
              </div>
              <span class="bandos-pill">{{ roleLabel(m.role) }}</span>
              <div style="width:40px;flex-shrink:0;">
                @if (canManage() && m.userId !== ws()?.currentUserId) {
                  <button mat-icon-button [matMenuTriggerFor]="menu"><mat-icon>more_vert</mat-icon></button>
                  <mat-menu #menu>
                    @for (r of roles; track r) {
                      <button mat-menu-item (click)="changeRole(m.userId, r)">Set as {{ roleLabel(r) }}</button>
                    }
                  </mat-menu>
                }
              </div>
            </div>
          }
        </div>
      </div>

      @if (pendingInvites().length > 0) {
        <div class="bandos-card">
          <h3 class="bandos-section-title">Pending invites ({{ pendingInvites().length }})</h3>
          <div class="bandos-stack" style="margin-top:12px;">
            @for (i of pendingInvites(); track i.id) {
              <div class="member-row">
                <band-avatar [displayName]="i.displayName" [size]="36"></band-avatar>
                <div style="flex:1;">
                  <div class="m-name">{{ i.displayName }}</div>
                  <div class="m-meta">{{ i.email }} · {{ roleLabel(i.role) }}</div>
                </div>
                @if (canManage()) {
                  @if (i.requestedUserId) {
                    <button mat-flat-button color="primary" (click)="accept(i.id)">Accept</button>
                  }
                  <button mat-stroked-button (click)="decline(i.id)">Decline</button>
                }
              </div>
            }
          </div>
        </div>
      }

      <div class="bandos-card">
        <h3 class="bandos-section-title">Plan</h3>
        <div class="bandos-row" style="justify-content:space-between;align-items:center;margin-top:8px;">
          <div>
            <div style="font-weight:800;font-size:18px;">{{ planLabel() }}</div>
            <div class="bandos-muted" style="font-size:12px;">{{ planSubLabel() }}</div>
          </div>
          @if (!isPremium()) {
            <button mat-flat-button color="primary" (click)="upgradeToPremium()">Activate test premium</button>
          }
        </div>
      </div>

      <div class="bandos-card">
        <button mat-stroked-button color="warn" (click)="leave()">Leave workspace</button>
      </div>

      <!-- Backdrop -->
      <div class="panel-backdrop" [class.visible]="panelOpen()" (click)="closePanel()"></div>
      <!-- Side panel -->
      <aside class="editor-panel" [class.open]="panelOpen()">
        <div class="panel-header">
          <div class="panel-header-text">
            <span class="panel-label">Invite member</span>
          </div>
          <button mat-icon-button (click)="closePanel()"><mat-icon>close</mat-icon></button>
        </div>
        <div class="panel-body">
          @if (panelOpen()) {
            <invite-form
              (done)="onInviteDone($event)"
              (cancel)="closePanel()" />
          }
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .member-row { display: flex; gap: 12px; align-items: center; }
    .m-name { font-weight: 700; display: flex; align-items: center; gap: 8px; }
    .m-meta { font-size: 12px; color: #9D9DA7; }

    /* ── Side panel ── */
    .panel-backdrop { position: fixed; inset: 0; z-index: 200; background: transparent; pointer-events: none; transition: background 0.25s ease; }
    .panel-backdrop.visible { background: rgba(0,0,0,0.35); }
    .editor-panel { position: fixed; top: 16px; right: 16px; bottom: 16px; width: 460px; z-index: 201; background: #20202A; border: 1px solid #383842; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; transform: translateX(calc(100% + 32px)); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow: 0 12px 48px rgba(0,0,0,0.55); }
    .editor-panel.open { transform: translateX(0); }
    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 14px; border-bottom: 1px solid #383842; flex-shrink: 0; }
    .panel-header-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .panel-label { font-size: 11px; font-weight: 700; color: #9D9DA7; text-transform: uppercase; letter-spacing: 0.06em; }
    .panel-title { font-size: 17px; font-weight: 800; color: #CDCDD3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .panel-body { flex: 1; overflow-y: auto; padding: 20px; }
    @media (max-width: 760px) { .editor-panel { inset: 0; width: 100%; border-radius: 0; border: none; } }
  `],
})
export class BandComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly snack = inject(MatSnackBar);
  private readonly router = inject(Router);

  ws = computed(() => this.wsc.workspace());
  roles = Object.values(M.BandRole);
  pendingInvites = computed(() => this.ws()?.pendingInvites ?? []);
  canManage = computed(() => { const w = this.ws(); return w ? M.wsCanManageMembers(w) : false; });
  isPremium = computed(() => { const w = this.ws(); return w ? M.wsIsPremium(w) : false; });
  planLabel = computed(() => this.ws() ? M.wsCurrentPlanLabel(this.ws()!) : '');
  planSubLabel = computed(() => {
    const w = this.ws(); if (!w) return '';
    if (M.wsIsPremium(w)) {
      const until = w.premiumEntitlement?.premiumUntil;
      return w.premiumEntitlement?.isLifetime ? 'Lifetime access' : (until ? `Renews ${until.toLocaleDateString()}` : 'Premium active');
    }
    return `Up to ${M.wsMaxMembers(w)} members, ${M.wsMaxSongs(w)} songs, ${M.wsMaxSetlists(w)} setlist`;
  });

  panelOpen = signal(false);
  private _keepPanelOpen = false;

  openPanel() { this.panelOpen.set(true); this._keepPanelOpen = true; setTimeout(() => (this._keepPanelOpen = false)); }
  closePanel() { this.panelOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.panelOpen()) this.closePanel(); }

  @HostListener("document:click", ["$event"])
  onDocumentClick(ev: MouseEvent) {
    if (!this.panelOpen()) return;
    if (this._keepPanelOpen) { this._keepPanelOpen = false; return; }
    const target = ev.target as HTMLElement | null;
    if (target && target.closest(".editor-panel, .songs-panel, .cdk-overlay-container")) return;
    this.closePanel();
  }

  roleLabel(r: M.BandRole) { return M.BandRoleLabel[r]; }

  copyInvite() {
    const code = this.ws()?.inviteCode; if (!code) return;
    navigator.clipboard.writeText(code).then(() => this.snack.open(`Copied ${code}`, 'OK', { duration: 1800 }));
  }

  invite() { this.openPanel(); }

  async onInviteDone(invite: M.BandInvite) {
    try {
      await this.wsc.sendInvite(invite);
      this.snack.open('Invite sent.', 'OK', { duration: 1800 });
      this.closePanel();
    } catch (err: any) {
      this.snack.open(err?.message ?? 'Could not send invite.', 'OK', { duration: 3000 });
    }
  }

  async changeRole(uid: string, role: M.BandRole) { await this.wsc.updateMemberRole(uid, role); }
  async accept(id: string) {
    try { await this.wsc.acceptPendingInvite(id); }
    catch (err: any) { this.snack.open(err?.message ?? 'Could not accept.', 'OK', { duration: 3000 }); }
  }
  async decline(id: string) { await this.wsc.declinePendingInvite(id); }
  async upgradeToPremium() {
    const w = this.ws(); if (!w) return;
    const uid = w.currentUserId;
    const entitlement = M.makeTestPremiumEntitlement(M.WorkspacePremiumProduct.yearly, uid);
    await this.wsc.activatePremium(entitlement);
    this.snack.open('Test premium plan activated (1 year).', 'OK', { duration: 2400 });
  }
  async leave() {
    if (!confirm('Leave this workspace?')) return;
    try {
      await this.wsc.leaveWorkspace();
      this.router.navigate(['/band-setup']);
    } catch (err: any) {
      this.snack.open(err?.message ?? 'Could not leave workspace.', 'OK', { duration: 3000 });
    }
  }
}
