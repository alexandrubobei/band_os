import { Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { AuthController } from '../../core/state/auth-controller.service';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { BandAvatarComponent } from '../../shared/components/band-avatar.component';
import { BandosMarkLogoComponent } from '../../shared/components/bandos-full-logo.component';
import { ActivityFeedComponent } from '../../shared/components/activity-feed.component';
import { MessagingService } from '../../core/services/messaging.service';

interface NavItem { label: string; icon: string; route: string; color: string; premiumOnly?: boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive, RouterOutlet,
    MatIconModule,
    BandAvatarComponent, BandosMarkLogoComponent, ActivityFeedComponent,
  ],
  template: `
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <bandos-mark-logo [size]="36"></bandos-mark-logo>
          <div class="brand-text">
            <div class="band-name">{{ workspaceName() }}</div>
            <div class="band-genre">{{ workspaceGenre() }}</div>
          </div>
        </div>

        <nav class="nav">
          @for (item of items; track item.route) {
            <a
              [routerLink]="['/app', item.route]"
              routerLinkActive="active"
              class="nav-item">
              <mat-icon [style.color]="item.color">{{ item.icon }}</mat-icon>
              <span>{{ item.label }}</span>
              @if (item.route === 'messages' && messagingUnread()) {
                <span class="nav-badge">{{ messagingUnread() }}</span>
              }
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <button class="user-button" [class.open]="menuOpen()" (click)="toggleMenu($event)">
            <band-avatar [displayName]="displayName()" [size]="32"></band-avatar>
            <span class="user-name">{{ displayName() }}</span>
            <mat-icon class="user-caret">expand_less</mat-icon>
          </button>

          @if (menuOpen()) {
            <div class="user-menu" (click)="$event.stopPropagation()">
              <button class="user-menu-item" (click)="goBand()">
                <mat-icon>group</mat-icon><span>Band settings</span>
              </button>
              <div class="user-menu-sep"></div>
              <button class="user-menu-item danger" (click)="signOut()">
                <mat-icon>logout</mat-icon><span>Sign out</span>
              </button>
            </div>
          }
        </div>
      </aside>

      <main class="content">
        <router-outlet></router-outlet>
      </main>

      <aside class="activity-panel">
        <activity-feed></activity-feed>
      </aside>
    </div>
  `,
  styles: [`
    .shell { display: grid; grid-template-columns: 260px 1fr 420px; min-height: 100vh; }
    .sidebar {
      background: #0F0F12;
      border-right: 1px solid #383842;
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 16px;
    }
    .brand { display: flex; align-items: center; gap: 12px; padding: 8px 4px; }
    .brand-text { display: flex; flex-direction: column; min-width: 0; }
    .band-name { font-weight: 800; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 170px; }
    .band-genre { font-size: 11px; color: #9D9DA7; }
    .nav { display: flex; flex-direction: column; gap: 2px; flex: 1; overflow-y: auto; }
    .nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px; border-radius: 10px; color: #C7C7CF;
      text-decoration: none; font-size: 13px; font-weight: 600;
    }
    .nav-item:hover { background: #20202A; color: #CDCDD3; }
    .nav-item.active { background: rgba(239, 74, 53, 0.12); color: #EF4A35; }
    .nav-item mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .nav-badge { margin-left: auto; background: #EF4A35; color: #fff; font-size: 10px; font-weight: 800; min-width: 18px; height: 18px; padding: 0 5px; border-radius: 999px; display: inline-flex; align-items: center; justify-content: center; }
    .sidebar-footer { border-top: 1px solid #383842; padding-top: 12px; position: relative; }
    .user-button {
      width: 100%; display: flex; align-items: center; gap: 10px;
      background: none; border: 1px solid transparent; border-radius: 10px;
      padding: 8px 10px; cursor: pointer; color: #CDCDD3; text-align: left;
      transition: background 0.15s ease, border-color 0.15s ease;
    }
    .user-button:hover { background: #20202A; }
    .user-button.open { background: #20202A; border-color: #383842; }
    .user-name { flex: 1; min-width: 0; font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .user-caret { font-size: 18px; width: 18px; height: 18px; color: #9D9DA7; transition: transform 0.2s ease; }
    .user-button.open .user-caret { transform: rotate(180deg); }

    .user-menu {
      position: absolute; left: 0; right: 0; bottom: calc(100% + 6px);
      background: #20202A; border: 1px solid #383842; border-radius: 12px;
      padding: 6px; z-index: 50; box-shadow: 0 12px 32px rgba(0,0,0,0.55);
      animation: userMenuIn 0.14s ease;
    }
    @keyframes userMenuIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
    .user-menu-item {
      width: 100%; display: flex; align-items: center; gap: 12px;
      background: none; border: none; cursor: pointer;
      padding: 10px 12px; border-radius: 8px; color: #CDCDD3;
      font-size: 13px; font-weight: 600; text-align: left;
      transition: background 0.12s ease, color 0.12s ease;
    }
    .user-menu-item:hover { background: #2A2A33; color: #C8A77B; }
    .user-menu-item mat-icon { font-size: 18px; width: 18px; height: 18px; color: #9D9DA7; transition: color 0.12s ease; }
    .user-menu-item:hover mat-icon { color: #C8A77B; }
    .user-menu-item.danger:hover { color: #EF4A35; }
    .user-menu-item.danger:hover mat-icon { color: #EF4A35; }
    .user-menu-sep { height: 1px; background: #383842; margin: 6px 4px; }
    .content { background: #14141A; overflow-y: auto; min-width: 0; }
    .activity-panel { background: #16161B; border-left: 1px solid #383842; overflow: hidden; display: flex; flex-direction: column; }
    @media (max-width: 1280px) {
      .shell { grid-template-columns: 260px 1fr; }
      .activity-panel { display: none; }
    }
    @media (max-width: 880px) {
      .shell { grid-template-columns: 72px 1fr; }
      .brand-text, .user-name, .nav-item span { display: none; }
    }
  `],
})
export class AppShellComponent {
  private readonly auth = inject(AuthController);
  private readonly ws = inject(WorkspaceController);
  private readonly router = inject(Router);
  private readonly messaging = inject(MessagingService);

  readonly messagingUnread = this.messaging.totalUnread;
  readonly menuOpen = signal(false);

  constructor() {
    // Track messaging workspace-wide so the nav unread badge stays live everywhere.
    effect(() => {
      const w = this.ws.workspace();
      if (w) this.messaging.startTracking(w.id);
      else this.messaging.stopTracking();
    }, { allowSignalWrites: true });
  }

  toggleMenu(ev: Event) { ev.stopPropagation(); this.menuOpen.update(v => !v); }
  closeMenu() { this.menuOpen.set(false); }

  @HostListener('document:click')
  onDocumentClick() { if (this.menuOpen()) this.menuOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.menuOpen()) this.menuOpen.set(false); }

  items: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard',              route: 'dashboard', color: '#60A5FA' },
    { label: 'Songs',     icon: 'library_music',          route: 'songs',     color: '#A78BFA' },
    { label: 'Setlists',  icon: 'queue_music',            route: 'setlists',  color: '#34D399' },
    { label: 'Calendar',  icon: 'event',                  route: 'calendar',  color: '#FBBF24' },
    { label: 'Tasks',     icon: 'check_box',              route: 'tasks',     color: '#FB923C' },
    { label: 'Messages',  icon: 'forum',                 route: 'messages',  color: '#818CF8' },
    { label: 'Contacts',  icon: 'contacts',               route: 'contacts',  color: '#F472B6' },
    { label: 'Riders',    icon: 'tune',                   route: 'riders',    color: '#22D3EE' },
    { label: 'Finances',  icon: 'account_balance_wallet', route: 'finances',  color: '#4ADE80' },
    { label: 'Releases',  icon: 'album',                  route: 'releases',  color: '#C8A77B' },
    { label: 'Band',      icon: 'group',                  route: 'band',      color: '#EF4A35' },
  ];

  workspaceName = computed(() => this.ws.workspace()?.bandName ?? 'No workspace');
  workspaceGenre = computed(() => this.ws.workspace()?.genre ?? '');
  displayName = computed(() => this.auth.user?.displayName ?? '');

  goBand() { this.closeMenu(); this.router.navigate(['/app/band']); }
  async signOut() {
    this.closeMenu();
    await this.auth.signOut();
    this.router.navigate(['/sign-in']);
  }
}
