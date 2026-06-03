import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ActivityLogService, ActivityAction } from '../../core/services/activity-log.service';
import { Router } from '@angular/router';

@Component({
  selector: 'activity-feed',
  standalone: true,
  imports: [CommonModule, MatIconModule, MatButtonModule, MatChipsModule, MatTooltipModule],
  template: `
    <div class="activity-feed-container">
      <div class="activity-feed-header">
        <h3>Activity Feed</h3>
      </div>

      <!-- Filter Chips -->
      <div class="activity-filters">
        <div class="filter-group">
          <button class="filter-chip" [class.active]="selectedFilter() === 'all'" (click)="selectedFilter.set('all')">All</button>
          <button class="filter-chip" [class.active]="selectedFilter() === 'created'" (click)="selectedFilter.set('created')">Created</button>
          <button class="filter-chip" [class.active]="selectedFilter() === 'updated'" (click)="selectedFilter.set('updated')">Updated</button>
          <button class="filter-chip" [class.active]="selectedFilter() === 'deleted'" (click)="selectedFilter.set('deleted')">Deleted</button>
        </div>
      </div>

      <!-- Activity Timeline -->
      <div class="activity-timeline">
        @if (filteredActivities().length === 0) {
          <p class="activity-empty">No activities yet</p>
        } @else {
          @for (activity of filteredActivities(); track activity.id) {
            <div class="activity-item" (click)="navigateToEntity(activity)" [class.clickable]="canNavigateToEntity(activity)">
              <div class="activity-icon">
                <mat-icon [class]="'icon-' + activity.action">{{ getActionIcon(activity.action) }}</mat-icon>
              </div>
              <div class="activity-content">
                <div class="activity-text">
                  <span class="activity-user">{{ activity.displayName }}</span>
                  <span class="activity-action">{{ getActionLabel(activity.action) }}</span>
                  <span class="activity-entity">"{{ activity.entityName }}"</span>
                </div>
                <div class="activity-meta">
                  <span class="activity-type" [class]="'type-' + activity.entityType">{{ activity.entityType }}</span>
                  <span class="activity-time">{{ formatTime(activity.timestamp) }}</span>
                </div>
              </div>
            </div>
          }
        }
      </div>
    </div>
  `,
  styles: [`
    .activity-feed-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: #16161B;
      color: #E6E6EC;
    }

    .activity-feed-header {
      padding: 16px;
      border-bottom: 1px solid #2A2A31;
      flex-shrink: 0;
    }

    .activity-feed-header h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 700;
      color: #E6E6EC;
    }

    .activity-filters {
      padding: 12px 16px;
      border-bottom: 1px solid #2A2A31;
      flex-shrink: 0;
    }

    .filter-group {
      width: 100%;
      display: flex;
      gap: 0;
      align-items: stretch;
      justify-content: space-between;
    }

    .filter-chip {
      flex: 1;
      font-size: 11px;
      font-weight: 600;
      height: 36px;
      padding: 0 12px;
      border: 1px solid #2A2A31;
      border-right: none;
      background: #1D1D23;
      color: #9D9DA7;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      border-radius: 0;
      transition: all 0.2s ease;
    }

    .filter-chip:first-child {
      border-radius: 6px 0 0 6px;
    }

    .filter-chip:last-child {
      border-radius: 0 6px 6px 0;
      border-right: 1px solid #2A2A31;
    }

    .filter-chip:hover:not(.active) {
      background: #22222A;
      color: #C8A77B;
    }

    .filter-chip.active {
      background: #C8A77B;
      color: #16161B;
      border-color: #C8A77B;
      font-weight: 700;
    }

    .activity-timeline {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }

    .activity-empty {
      padding: 24px 16px;
      text-align: center;
      color: #9D9DA7;
      font-size: 13px;
      margin: 0;
    }

    .activity-item {
      display: flex;
      gap: 12px;
      padding: 12px;
      border: 1px solid #2A2A31;
      border-radius: 8px;
      margin-bottom: 8px;
      background: #1D1D23;
      transition: all 0.2s ease;
    }

    .activity-item.clickable {
      cursor: pointer;
    }

    .activity-item.clickable:hover {
      background: #22222A;
      border-color: #C8A77B;
      box-shadow: inset 0 0 8px rgba(200, 167, 123, 0.1);
    }

    .activity-icon {
      flex-shrink: 0;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #22222A;
      border-radius: 6px;
    }

    .activity-icon mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    /* Icon colors by action */
    .icon-created {
      color: #22C55E;
    }

    .icon-updated {
      color: #3B82F6;
    }

    .icon-deleted {
      color: #EF4A35;
    }

    .icon-commented {
      color: #F59E0B;
    }

    .activity-content {
      flex: 1;
      min-width: 0;
    }

    .activity-text {
      font-size: 12px;
      line-height: 1.4;
      color: #E6E6EC;
      margin-bottom: 4px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .activity-user {
      font-weight: 700;
      color: #C8A77B;
    }

    .activity-action {
      color: #9D9DA7;
    }

    .activity-entity {
      color: #E6E6EC;
      font-weight: 600;
      word-break: break-word;
    }

    .activity-meta {
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 11px;
      color: #9D9DA7;
    }

    .activity-type {
      padding: 2px 6px;
      background: #22222A;
      border-radius: 3px;
      text-transform: capitalize;
      font-weight: 600;
    }

    .type-song {
      color: #E6E6EC;
    }

    .type-setlist {
      color: #E6E6EC;
    }

    .type-event {
      color: #E6E6EC;
    }

    .type-task {
      color: #E6E6EC;
    }

    .type-member {
      color: #C8A77B;
    }

    .activity-time {
      color: #9D9DA7;
    }

    /* Scrollbar styling */
    .activity-timeline::-webkit-scrollbar {
      width: 6px;
    }

    .activity-timeline::-webkit-scrollbar-track {
      background: transparent;
    }

    .activity-timeline::-webkit-scrollbar-thumb {
      background: #2A2A31;
      border-radius: 3px;
    }

    .activity-timeline::-webkit-scrollbar-thumb:hover {
      background: #3A3A41;
    }
  `],
})
export class ActivityFeedComponent {
  private readonly activityLog = inject(ActivityLogService);
  private readonly router = inject(Router);

  selectedFilter = signal<ActivityAction | 'all'>('all');
  allActivities = this.activityLog.allActivities;

  filteredActivities = computed(() => {
    const filter = this.selectedFilter();
    const activities = this.allActivities();
    if (filter === 'all') return activities;
    return activities.filter((a) => a.action === filter);
  });

  getActionIcon(action: string): string {
    const icons: Record<string, string> = {
      created: 'add_circle_outline',
      updated: 'edit',
      deleted: 'delete_outline',
      commented: 'comment',
    };
    return icons[action] || 'info';
  }

  getActionLabel(action: string): string {
    const labels: Record<string, string> = {
      created: 'created',
      updated: 'updated',
      deleted: 'deleted',
      commented: 'commented on',
    };
    return labels[action] || action;
  }

  formatTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString();
  }

  canNavigateToEntity(activity: any): boolean {
    return ['song', 'setlist', 'event', 'task'].includes(activity.entityType);
  }

  navigateToEntity(activity: any): void {
    if (!this.canNavigateToEntity(activity)) return;

    const routes: Record<string, string> = {
      song: '/app/songs',
      setlist: '/app/setlists',
      event: '/app/calendar',
      task: '/app/tasks',
    };

    const baseRoute = routes[activity.entityType];
    if (baseRoute) {
      this.router.navigate([baseRoute]);
    }
  }
}
