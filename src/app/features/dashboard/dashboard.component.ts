import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'dashboard-screen',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule, ScreenHeaderComponent],
  template: `
      <div class="bandos-page">
          <screen-header [title]="title()" [subtitle]="'Quick view of what is happening in the band.'"></screen-header>

          <div class="bandos-grid">
              <mat-card>
                  <h3>Songs</h3>
                  <div class="stat">{{ ws()?.songs?.length ?? 0 }}</div>
                  <a mat-button color="primary" routerLink="/app/songs">Open library</a>
              </mat-card>
              <mat-card>
                  <h3>Open tasks</h3>
                  <div class="stat">{{ openTasks() }}</div>
                  <a mat-button color="primary" routerLink="/app/tasks">Open tasks</a>
              </mat-card>
              <mat-card>
                  <h3>Setlists</h3>
                  <div class="stat">{{ ws()?.setlists?.length ?? 0 }}</div>
                  <a mat-button color="primary" routerLink="/app/setlists">Open setlists</a>
              </mat-card>
              <mat-card>
                  <h3>Next show</h3>
                  <div class="stat-text">{{ nextShowLabel() }}</div>
                  <a mat-button color="primary" routerLink="/app/calendar">View calendar</a>
              </mat-card>
          </div>

          <div class="events-section">
              <h3>Upcoming events</h3>
              @if (upcoming().length === 0) {
                  <p class="bandos-muted">No events scheduled.</p>
              } @else {
                  <div class="events-grid">
                      @for (e of upcoming(); track e.id) {
                          <mat-card class="event-card" (click)="openEvent()">
                              <div class="event-card-header">
                                  <div class="dot" [style.background]="dotColor(e.type)"></div>
                                  <div class="ev-title">{{ e.title }}</div>
                              </div>
                              <div class="ev-meta-group">
                                  <div class="ev-meta-item">
                                      <mat-icon>calendar_today</mat-icon>
                                      <span>{{ e.startAt | date:'mediumDate' }}</span>
                                  </div>
                                  <div class="ev-meta-item">
                                      <mat-icon>schedule</mat-icon>
                                      <span>{{ e.startAt | date:'shortTime' }}</span>
                                  </div>
                                  @if (e.location) {
                                      <div class="ev-meta-item">
                                          <mat-icon>location_on</mat-icon>
                                          <span>{{ e.location }}</span>
                                      </div>
                                  }
                              </div>
                          </mat-card>
                      }
                  </div>
              }
          </div>
      </div>
  `,
  styles: [`
    h3 { margin: 0 0 8px; font-size: 14px; color: #9D9DA7; font-weight: 600; }
    .stat { font-size: 38px; font-weight: 800; line-height: 1; margin: 6px 0 12px; }
    .stat-text { font-size: 18px; font-weight: 700; margin: 6px 0 12px; }

    /* ── Events Grid ── */
    .events-section { margin-top: 16px; }
    .events-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .event-card { cursor: pointer; padding: 14px; transition: all 0.2s ease; }
    .event-card:hover { background: #22222A; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .event-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .ev-title { font-weight: 800; font-size: 15px; flex: 1; }
    .ev-meta-group { display: flex; flex-direction: column; gap: 6px; }
    .ev-meta-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #E6E6EC; }
    .ev-meta-item mat-icon { font-size: 16px; width: 16px; height: 16px; color: #C8A77B; flex-shrink: 0; }

    @media (max-width: 1024px) {
      .events-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 760px) {
      .events-grid { grid-template-columns: 1fr; }
    }
  `],
})
export class DashboardComponent {
  private readonly wsc = inject(WorkspaceController);
  ws = computed(() => this.wsc.workspace());
  title = computed(() => this.ws()?.bandName ?? 'Dashboard');
  upcoming = computed(() => this.ws() ? M.wsUpcomingEvents(this.ws()!).slice(0, 5) : []);
  openTasks = computed(() => this.ws() ? M.wsOpenTasksCount(this.ws()!) : 0);
  nextShowLabel = computed(() => {
    const w = this.ws(); if (!w) return '—';
    const next = M.wsNextShow(w);
    return next ? `${next.title} · ${next.startAt.toLocaleDateString()}` : 'No show scheduled';
  });

  dotColor(t: M.BandEventType): string {
    return {
      [M.BandEventType.show]: '#EF4A35',
      [M.BandEventType.rehearsal]: '#C8A77B',
      [M.BandEventType.recording]: '#7BC8A4',
      [M.BandEventType.meeting]: '#7BA4C8',
      [M.BandEventType.release]: '#C87B9C',
      [M.BandEventType.other]: '#9D9DA7',
    }[t];
  }

  openEvent() {
    // Navigate to calendar page where the event can be edited
    // or integrate with a side panel similar to other pages
    window.location.hash = `/app/calendar`;
  }
}
