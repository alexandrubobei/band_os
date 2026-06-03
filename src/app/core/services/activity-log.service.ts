import { Injectable, signal, computed } from '@angular/core';
import { collection, addDoc, Timestamp, query, orderBy, limit, onSnapshot, Query } from 'firebase/firestore';
import { getFirebase } from '../firebase/firebase-bootstrap';
import { BehaviorSubject, Observable, map } from 'rxjs';

export type ActivityAction = 'created' | 'updated' | 'deleted' | 'commented';
export type ActivityEntityType = 'song' | 'setlist' | 'event' | 'task' | 'member' | 'contact' | 'release';

export interface ActivityLogEntry {
  id: string;
  userId: string;
  displayName: string;
  action: ActivityAction;
  entityType: ActivityEntityType;
  entityId: string;
  entityName: string;
  timestamp: Date;
  details?: Record<string, any>; // Changed fields, diff info, etc.
}

@Injectable({ providedIn: 'root' })
export class ActivityLogService {

  private activities = signal<ActivityLogEntry[]>([]);
  private activitiesSubject = new BehaviorSubject<ActivityLogEntry[]>([]);

  currentWorkspaceId: string | null = null;
  private activityUnsubscribe: (() => void) | null = null;

  // Public API
  activities$ = this.activitiesSubject.asObservable();
  allActivities = computed(() => this.activities());

  /**
   * Start monitoring activities for a workspace
   */
  startActivityTracking(workspaceId: string) {
    // Don't create duplicate listeners
    if (this.currentWorkspaceId === workspaceId && this.activityUnsubscribe) {
      return;
    }

    // Clean up old listener if switching workspaces
    this.stopActivityTracking();

    this.currentWorkspaceId = workspaceId;
    console.log(`[ActivityLog] Starting activity tracking for workspace: ${workspaceId}`);

    const activitiesCollection = collection(
      getFirebase().firestore,
      `workspaces/${workspaceId}/activities`
    );

    // Query last 100 activities, ordered by timestamp descending
    const activitiesQuery = query(
      activitiesCollection,
      orderBy('timestamp', 'desc'),
      limit(100)
    ) as Query;

    this.activityUnsubscribe = onSnapshot(activitiesQuery, (snapshot) => {
      const activities: ActivityLogEntry[] = [];

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as any;
        activities.push({
          id: doc.id,
          userId: data.userId,
          displayName: data.displayName,
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          entityName: data.entityName,
          timestamp: data.timestamp?.toDate?.() || new Date(data.timestamp),
          details: data.details,
        });
      });

      console.log(`[ActivityLog] Loaded ${activities.length} activities from Firestore`);
      this.activities.set(activities);
      this.activitiesSubject.next(activities);
    }, (error) => {
      console.error('[ActivityLog] Error querying activities:', error);
    });
  }

  /**
   * Stop monitoring activities
   */
  stopActivityTracking() {
    if (this.activityUnsubscribe) {
      this.activityUnsubscribe();
      this.activityUnsubscribe = null;
    }
  }

  /**
   * Log an activity entry
   */
  async logActivity(
    userId: string,
    displayName: string,
    action: ActivityAction,
    entityType: ActivityEntityType,
    entityId: string,
    entityName: string,
    details?: Record<string, any>
  ): Promise<void> {
    if (!this.currentWorkspaceId) {
      console.warn('[ActivityLog] No workspace ID set, skipping activity log');
      return;
    }

    console.log(`[ActivityLog] Logging: ${displayName} ${action} ${entityType} "${entityName}"`);

    const activitiesCollection = collection(
      getFirebase().firestore,
      `workspaces/${this.currentWorkspaceId}/activities`
    );

    try {
      const docRef = await addDoc(activitiesCollection, {
        userId,
        displayName,
        action,
        entityType,
        entityId,
        entityName,
        timestamp: Timestamp.now(),
        details: details || {},
      });
      console.log(`[ActivityLog] ✓ Activity logged successfully (ID: ${docRef.id})`);
    } catch (error) {
      console.error('[ActivityLog] ✗ Error logging activity:', error);
    }
  }

  /**
   * Get recent activities for a specific entity
   */
  getActivitiesForEntity(
    entityType: ActivityEntityType,
    entityId: string
  ): Observable<ActivityLogEntry[]> {
    return this.activities$.pipe(
      map((activities: ActivityLogEntry[]) =>
        activities.filter(
          (a) => a.entityType === entityType && a.entityId === entityId
        )
      )
    );
  }

  /**
   * Get activities by user
   */
  getActivitiesByUser(userId: string): ActivityLogEntry[] {
    return this.activities().filter((a) => a.userId === userId);
  }

  /**
   * Get activities by action type
   */
  getActivitiesByAction(action: ActivityAction): ActivityLogEntry[] {
    return this.activities().filter((a) => a.action === action);
  }

  /**
   * Get activities by entity type
   */
  getActivitiesByEntityType(entityType: ActivityEntityType): ActivityLogEntry[] {
    return this.activities().filter((a) => a.entityType === entityType);
  }

  /**
   * Format activity for display
   */
  formatActivity(activity: ActivityLogEntry): string {
    const actionLabel = this.getActionLabel(activity.action);
    return `${activity.displayName} ${actionLabel} "${activity.entityName}"`;
  }

  /**
   * Get human-readable action label
   */
  private getActionLabel(action: ActivityAction): string {
    const labels: Record<ActivityAction, string> = {
      created: 'created',
      updated: 'updated',
      deleted: 'deleted',
      commented: 'commented on',
    };
    return labels[action];
  }
}
