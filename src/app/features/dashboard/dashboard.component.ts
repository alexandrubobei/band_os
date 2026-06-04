import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { differenceInDays, startOfDay } from 'date-fns';
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

          <!-- MY ACTIVITIES SECTION -->
          <div class="section">
              <h2 class="section-title">My Activities</h2>
              @if (myTasks().length > 0) {
                  <div class="my-tasks-list">
                      @for (task of myTasks(); track task.id) {
                          <div class="my-task-item" [class.priority-high]="task.priority === 'high'" [class.priority-medium]="task.priority === 'medium'">
                              <div class="task-dot" [class.high]="task.priority === 'high'" [class.medium]="task.priority === 'medium'"></div>
                              <div class="task-details">
                                  <div class="task-title">{{ task.title }}</div>
                                  <div class="task-meta">
                                      @if (task.dueDate) {
                                          <span class="due-date">{{ task.dueDate | date:'short' }}</span>
                                      } @else {
                                          <span class="due-date">No due date</span>
                                      }
                                      <span class="status-badge" [class]="'status-' + task.status">{{ statusLabel(task.status) }}</span>
                                  </div>
                              </div>
                          </div>
                      }
                  </div>
              } @else {
                  <p class="bandos-muted">No tasks assigned to you yet.</p>
              }
          </div>

          <!-- BAND SECTION -->
          <div class="section">
              <h2 class="section-title">Band</h2>
              <!-- Stat Cards -->
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
          </div>

                      <!-- Status Badges -->
                      <div class="status-badges">
              @if (openTasks() > 0) { <span class="bandos-pill secondary">{{ openTasks() }} open task{{ openTasks() !== 1 ? 's' : '' }}</span> }
              @if (liveReadyCount() > 0) { <span class="bandos-pill">{{ liveReadyCount() }} live ready</span> }
              @if (releaseReadyCount() > 0) { <span class="bandos-pill">{{ releaseReadyCount() }} release ready</span> }
              @if (thisMonthEventCount() > 0) { <span class="bandos-pill">{{ thisMonthEventCount() }} event{{ thisMonthEventCount() !== 1 ? 's' : '' }} this month</span> }
              @if (nextShow()) { <span class="bandos-pill secondary">Next: {{ nextShow()!.startAt | date:'short' }}</span> }
          </div>

          <div class="events-section">
              <h3>Upcoming events</h3>
              @if (upcoming().length === 0) {
                  <p class="bandos-muted">No events scheduled.</p>
              } @else {
                  <div class="events-grid">
                      @for (e of upcoming(); track e.id) {
                          <mat-card class="event-card" [attr.data-days]="daysTilEvent(e)" (click)="openEvent()">
                              <div class="event-card-header">
                                  <div class="dot" [style.background]="dotColor(e.type)"></div>
                                  <div class="ev-title">{{ e.title }}</div>
                                  <span class="days-badge" [class.days-soon]="daysTilEvent(e) <= 1" [class.days-warning]="daysTilEvent(e) > 1 && daysTilEvent(e) <= 6">{{ daysLabel(e) }}</span>
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
      </div>
  `,
  styles: [`
    /* ── Sections ── */
    .section { margin-top: 28px; }
    .section-title { margin: 0 0 16px; font-size: 16px; font-weight: 700; color: #CDCDD3; padding-bottom: 12px; border-bottom: 1px solid #383842; }

    h3 { margin: 0 0 8px; font-size: 14px; color: #9D9DA7; font-weight: 600; }
    .stat { font-size: 38px; font-weight: 800; line-height: 1; margin: 6px 0 12px; }
    .stat-text { font-size: 18px; font-weight: 700; margin: 6px 0 12px; }

    /* ── Status Badges ── */
    .status-badges { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0; }
    .bandos-pill.secondary { color: #C8A77B; border-color: rgba(200, 167, 123, 0.3); background: rgba(200, 167, 123, 0.1); }

    /* ── Events Grid ── */
    .events-section { margin-top: 24px; }
    .events-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .event-card { cursor: pointer; padding: 14px; transition: all 0.2s ease; }
    .event-card:hover { background: #22222A; box-shadow: 0 2px 8px rgba(0,0,0,0.3); }
    .event-card-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; justify-content: space-between; }
    .dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .ev-title { font-weight: 800; font-size: 15px; flex: 1; }
    .days-badge { font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 4px; background: #22C55E; color: white; white-space: nowrap; flex-shrink: 0; }
    .days-badge.days-warning { background: #FBBF24; color: #1A1A1A; }
    .days-badge.days-soon { background: #EF4A35; color: white; }
    .ev-meta-group { display: flex; flex-direction: column; gap: 6px; }
    .ev-meta-item { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #CDCDD3; }
    .ev-meta-item mat-icon { font-size: 16px; width: 16px; height: 16px; color: #C8A77B; flex-shrink: 0; }

    @media (max-width: 1024px) {
      .events-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 760px) {
      .events-grid { grid-template-columns: 1fr; }
    }

    /* ── My Tasks ── */
    .my-tasks-section { margin-top: 24px; }
    .my-tasks-list { display: flex; flex-direction: column; gap: 8px; }
    .my-task-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px; background: #1D1D23; border: 1px solid #383842; border-radius: 10px; cursor: pointer; transition: all 0.2s ease; border-left: 3px solid #9D9DA7; }
    .my-task-item:hover { background: #22222A; border-left-color: #C8A77B; }
    .my-task-item.priority-high { border-left-color: #EF4A35; }
    .my-task-item.priority-medium { border-left-color: #C8A77B; }
    .task-dot { width: 8px; height: 8px; border-radius: 50%; background: #9D9DA7; margin-top: 4px; flex-shrink: 0; }
    .task-dot.high { background: #EF4A35; }
    .task-dot.medium { background: #C8A77B; }
    .task-details { flex: 1; min-width: 0; }
    .task-title { font-weight: 700; font-size: 13px; color: #CDCDD3; margin-bottom: 4px; }
    .task-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; }
    .due-date { color: #9D9DA7; padding: 2px 6px; background: #16161B; border-radius: 4px; }
    .due-date.overdue { color: #EF4A35; background: rgba(239, 74, 53, 0.15); }
    .status-badge { padding: 2px 6px; border-radius: 4px; background: #16161B; color: #9D9DA7; text-transform: capitalize; font-weight: 600; }
    .status-badge.status-todo { color: #60A5FA; background: rgba(96, 165, 250, 0.1); }
    .status-badge.status-inProgress { color: #FBBF24; background: rgba(251, 191, 36, 0.1); }
    .status-badge.status-done { color: #22C55E; background: rgba(34, 197, 94, 0.1); }
  `],
})
export class DashboardComponent {
  private readonly wsc = inject(WorkspaceController);
  ws = computed(() => this.wsc.workspace());
  title = computed(() => this.ws()?.bandName ?? 'Dashboard');
  upcoming = computed(() => this.ws() ? M.wsUpcomingEvents(this.ws()!).slice(0, 5) : []);
  openTasks = computed(() => this.ws() ? M.wsOpenTasksCount(this.ws()!) : 0);

  myTasks = computed(() => {
    const w = this.ws();
    if (!w) return [];
    return w.tasks
      .filter(t => t.assigneeUid === w.currentUserId && t.status !== M.BandTaskStatus.done)
      .sort((a, b) => {
        // Sort by priority (high first), then by due date
        const priorityOrder = { [M.BandTaskPriority.high]: 0, [M.BandTaskPriority.medium]: 1, [M.BandTaskPriority.low]: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return 0;
      })
      .slice(0, 5); // Show top 5
  });

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

  daysTilEvent(event: M.BandEvent): number {
    const today = startOfDay(new Date());
    const eventStart = startOfDay(event.startAt);
    return differenceInDays(eventStart, today);
  }

  daysLabel(event: M.BandEvent): string {
    const days = this.daysTilEvent(event);
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    if (days < 0) return 'Past';
    return `${days}d`;
  }

  statusLabel(status: M.BandTaskStatus): string {
    return M.BandTaskStatusLabel[status];
  }

  liveReadyCount = computed(() => {
    const w = this.ws();
    return w ? w.songs.filter(s => s.status === M.SongStatus.liveReady).length : 0;
  });

  releaseReadyCount = computed(() => {
    const w = this.ws();
    return w ? w.songs.filter(s => s.status === M.SongStatus.releaseReady).length : 0;
  });

  thisMonthEventCount(): number {
    const w = this.ws();
    if (!w) return 0;
    const now = new Date();
    const thisMonth = w.events.filter(e => {
      const eDate = e.startAt;
      return eDate.getMonth() === now.getMonth() && eDate.getFullYear() === now.getFullYear();
    });
    return thisMonth.length;
  }

  nextShow = computed(() => {
    const w = this.ws();
    if (!w) return null;
    const today = startOfDay(new Date());
    const futureShows = w.events
      .filter(e => e.type === M.BandEventType.show && differenceInDays(startOfDay(e.startAt), today) >= 0)
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return futureShows.length > 0 ? futureShows[0] : null;
  });

  openEvent() {
    // Navigate to calendar page where the event can be edited
    // or integrate with a side panel similar to other pages
    window.location.hash = `/app/calendar`;
  }
}
