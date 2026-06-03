import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthController } from '../../core/state/auth-controller.service';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { BandAvatarComponent } from '../../shared/components/band-avatar.component';
import { BandosMarkLogoComponent } from '../../shared/components/bandos-full-logo.component';
import { ActivityFeedComponent } from '../../shared/components/activity-feed.component';

interface NavItem { label: string; icon: string; route: string; color: string; premiumOnly?: boolean; }

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule, RouterLink, RouterLinkActive, RouterOutlet,
    MatIconModule, MatButtonModule, MatMenuModule, MatDividerModule,
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
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <button mat-button [matMenuTriggerFor]="userMenu" class="user-button">
            <band-avatar [displayName]="displayName()" [size]="32"></band-avatar>
            <span class="user-name">{{ displayName() }}</span>
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #userMenu="matMenu">
            <button mat-menu-item (click)="goBand()">
              <mat-icon>group</mat-icon><span>Band settings</span>
            </button>
            <mat-divider></mat-divider>
            <button mat-menu-item (click)="signOut()">
              <mat-icon>logout</mat-icon><span>Sign out</span>
            </button>
          </mat-menu>
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
      border-right: 1px solid #2A2A31;
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
    .nav-item:hover { background: #17171B; color: #F6F1E8; }
    .nav-item.active { background: rgba(239, 74, 53, 0.12); color: #EF4A35; }
    .nav-item mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .sidebar-footer { border-top: 1px solid #2A2A31; padding-top: 12px; }
    .user-button { width: 100%; justify-content: flex-start !important; gap: 10px; }
    .user-name { flex: 1; text-align: left; font-size: 13px; }
    .content { background: #0B0B0D; overflow-y: auto; min-width: 0; }
    .activity-panel { background: #16161B; border-left: 1px solid #2A2A31; overflow: hidden; display: flex; flex-direction: column; }
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

  items: NavItem[] = [
    { label: 'Dashboard', icon: 'dashboard',              route: 'dashboard', color: '#60A5FA' },
    { label: 'Songs',     icon: 'library_music',          route: 'songs',     color: '#A78BFA' },
    { label: 'Setlists',  icon: 'queue_music',            route: 'setlists',  color: '#34D399' },
    { label: 'Calendar',  icon: 'event',                  route: 'calendar',  color: '#FBBF24' },
    { label: 'Tasks',     icon: 'check_box',              route: 'tasks',     color: '#FB923C' },
    { label: 'Contacts',  icon: 'contacts',               route: 'contacts',  color: '#F472B6' },
    { label: 'Riders',    icon: 'tune',                   route: 'riders',    color: '#22D3EE' },
    { label: 'Finances',  icon: 'account_balance_wallet', route: 'finances',  color: '#4ADE80' },
    { label: 'Releases',  icon: 'album',                  route: 'releases',  color: '#C8A77B' },
    { label: 'Band',      icon: 'group',                  route: 'band',      color: '#EF4A35' },
  ];

  workspaceName = computed(() => this.ws.workspace()?.bandName ?? 'No workspace');
  workspaceGenre = computed(() => this.ws.workspace()?.genre ?? '');
  displayName = computed(() => this.auth.user?.displayName ?? '');

  goBand() { this.router.navigate(['/app/band']); }
  async signOut() {
    await this.auth.signOut();
    this.router.navigate(['/sign-in']);
  }
}
