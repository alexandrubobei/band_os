import { Injectable, inject, computed, signal, effect } from '@angular/core';
import { collection, doc, setDoc, deleteDoc, query, where, onSnapshot, Timestamp, writeBatch } from 'firebase/firestore';
import { AuthController } from '../state/auth-controller.service';
import { getFirebase } from '../firebase/firebase-bootstrap';
import { BehaviorSubject } from 'rxjs';

export interface UserPresence {
  userId: string;
  displayName: string;
  email: string;
  viewingPage: string; // "songs", "setlists", "dashboard", "calendar", "tasks", "contacts", "releases", "band"
  viewingEntityId?: string | null; // If editing a song, this is the songId
  lastSeen: Date;
  color: string; // Hex color for avatars
}

@Injectable({ providedIn: 'root' })
export class PresenceService {
  private readonly authController = inject(AuthController);

  private presenceMap = signal<Map<string, UserPresence>>(new Map());
  private presenceSubject = new BehaviorSubject<UserPresence[]>([]);

  currentWorkspaceId: string | null = null;

  // Public observables for components
  presences$ = this.presenceSubject.asObservable();
  allPresences = computed(() => Array.from(this.presenceMap().values()));

  private presenceUnsubscribe: (() => void) | null = null;
  private publishInterval: number | null = null;

  constructor() {
    // Every 30 seconds, update our presence (heartbeat)
    effect(() => {
      const user = this.authController.user;
      if (user && this.currentWorkspaceId) {
        this.publishPresence(user.id, user.displayName, user.email, 'dashboard');
      }
    });
  }

  /**
   * Start monitoring presence for a workspace
   */
  startPresenceTracking(workspaceId: string) {
    // Don't create duplicate listeners
    if (this.currentWorkspaceId === workspaceId && this.presenceUnsubscribe) {
      return;
    }

    // Clean up old listener if switching workspaces
    this.stopPresenceTracking();

    this.currentWorkspaceId = workspaceId;

    // Subscribe to presence collection changes
    const presenceCollection = collection(
      getFirebase().firestore,
      `workspaces/${workspaceId}/presences`
    );

    this.presenceUnsubscribe = onSnapshot(presenceCollection, (snapshot) => {
      const presenceMap = new Map<string, UserPresence>();
      const now = new Date();

      snapshot.docs.forEach((doc) => {
        const data = doc.data() as any;

        // Skip expired entries (TTL check)
        const ttl = data.ttl?.toDate?.() || data.ttl;
        if (ttl && ttl < now) {
          return; // Skip expired
        }

        presenceMap.set(doc.id, {
          userId: data.userId,
          displayName: data.displayName,
          email: data.email,
          viewingPage: data.viewingPage,
          viewingEntityId: data.viewingEntityId || null,
          lastSeen: data.lastSeen?.toDate?.() || new Date(data.lastSeen),
          color: data.color,
        });
      });

      this.presenceMap.set(presenceMap);
      this.presenceSubject.next(Array.from(presenceMap.values()));
    });
  }

  /**
   * Stop monitoring presence for current workspace
   */
  stopPresenceTracking() {
    if (this.presenceUnsubscribe) {
      this.presenceUnsubscribe();
      this.presenceUnsubscribe = null;
    }
    if (this.publishInterval) {
      clearInterval(this.publishInterval);
      this.publishInterval = null;
    }
  }

  /**
   * Publish/update current user's presence
   */
  async publishPresence(
    userId: string,
    displayName: string,
    email: string,
    viewingPage: string,
    viewingEntityId?: string | null
  ): Promise<void> {
    if (!this.currentWorkspaceId) return;

    const presenceDoc = doc(
      getFirebase().firestore,
      `workspaces/${this.currentWorkspaceId}/presences/${userId}`
    );

    const ttl = new Date();
    ttl.setMinutes(ttl.getMinutes() + 5); // 5-minute TTL

    try {
      await setDoc(
        presenceDoc,
        {
          userId,
          displayName,
          email,
          viewingPage,
          viewingEntityId: viewingEntityId || null,
          lastSeen: Timestamp.now(),
          ttl: Timestamp.fromDate(ttl),
          color: this.getUserColor(userId),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error publishing presence:', error);
    }
  }

  /**
   * Update viewing page for current user
   */
  async updateViewingPage(
    userId: string,
    displayName: string,
    email: string,
    viewingPage: string,
    viewingEntityId?: string | null
  ): Promise<void> {
    await this.publishPresence(userId, displayName, email, viewingPage, viewingEntityId);
  }

  /**
   * Remove current user's presence when they leave
   */
  async clearPresence(userId: string): Promise<void> {
    if (!this.currentWorkspaceId) return;

    const presenceDoc = doc(
      getFirebase().firestore,
      `workspaces/${this.currentWorkspaceId}/presences/${userId}`
    );

    try {
      await deleteDoc(presenceDoc);
    } catch (error) {
      console.error('Error clearing presence:', error);
    }
  }

  /**
   * Get all users currently viewing a specific entity
   */
  getUsersViewingEntity(entityId: string): UserPresence[] {
    return this.allPresences().filter((p) => p.viewingEntityId === entityId);
  }

  /**
   * Get all users currently on a specific page
   */
  getUsersOnPage(page: string): UserPresence[] {
    return this.allPresences().filter((p) => p.viewingPage === page);
  }

  /**
   * Get user color - consistent hash-based assignment
   */
  private getUserColor(userId: string): string {
    const colors = [
      '#FF6B6B', // Red
      '#4ECDC4', // Teal
      '#45B7D1', // Blue
      '#FFA07A', // Light Salmon
      '#98D8C8', // Mint
      '#F7DC6F', // Yellow
      '#BB8FCE', // Purple
      '#85C1E2', // Light Blue
      '#F8B88B', // Peach
      '#C8A77B', // Gold
      '#A8D5BA', // Light Green
      '#FF8C94', // Pink
    ];

    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      hash = ((hash << 5) - hash) + userId.charCodeAt(i);
      hash = hash & hash; // Convert to 32-bit integer
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
  }

  /**
   * Clean up old presence entries (called periodically)
   */
  async cleanupExpiredPresences(): Promise<void> {
    if (!this.currentWorkspaceId) return;

    const presenceCollection = collection(
      getFirebase().firestore,
      `workspaces/${this.currentWorkspaceId}/presences`
    );
    const expiredQuery = query(
      presenceCollection,
      where('ttl', '<', Timestamp.now())
    );

    const snapshot = await new Promise((resolve) => {
      onSnapshot(expiredQuery, (snap) => {
        resolve(snap);
      });
    });

    const batch = writeBatch(getFirebase().firestore);
    (snapshot as any).docs.forEach((doc: any) => {
      batch.delete(doc.ref);
    });

    try {
      await batch.commit();
    } catch (error) {
      console.error('Error cleaning up presence:', error);
    }
  }
}
