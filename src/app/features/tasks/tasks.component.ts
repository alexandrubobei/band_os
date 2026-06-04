import { Component, computed, inject, signal, Input, Output, EventEmitter, OnChanges, SimpleChanges, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { endOfWeek, isAfter, isBefore, isSameDay, startOfDay, differenceInDays } from 'date-fns';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { PresenceService, UserPresence } from '../../core/services/presence.service';
import { PresenceAvatarComponent } from '../../shared/components/presence-avatar.component';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'task-editor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatIconModule],
  template: `
    <form [formGroup]="form" class="bandos-stack">
      <mat-form-field appearance="outline"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Description</mat-label><textarea matInput rows="3" formControlName="description"></textarea></mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Assignee</mat-label>
        <mat-select formControlName="assigneeUid">
          <mat-option [value]="null">Unassigned</mat-option>
          @for (m of assigneeOptions(); track m.userId) {
            <mat-option [value]="m.userId">{{ m.displayName }}</mat-option>
          }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline" (click)="duePicker.open()">
        <mat-label>Due date</mat-label>
        <input matInput [matDatepicker]="duePicker" formControlName="dueDate" readonly />
        <mat-hint>Optional</mat-hint>
        <mat-datepicker-toggle matIconSuffix [for]="duePicker"></mat-datepicker-toggle>
        <mat-datepicker #duePicker></mat-datepicker>
      </mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Song</mat-label>
        <mat-select formControlName="songId">
          <mat-option [value]="null">None</mat-option>
          @for (s of songs; track s.id) { <mat-option [value]="s.id">{{ s.title }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <div class="bandos-row">
        <mat-form-field appearance="outline" style="flex:1;">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) { <mat-option [value]="s">{{ statusLabel(s) }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="flex:1;">
          <mat-label>Priority</mat-label>
          <mat-select formControlName="priority">
            @for (p of priorities; track p) { <mat-option [value]="p">{{ priorityLabel(p) }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>
    </form>
    <div class="form-actions">
      @if (task) { <button mat-button color="warn" style="margin-right: auto;" (click)="remove()">Delete</button> }
      <button mat-button (click)="cancel.emit()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
  styles: [`
    .form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; padding-top: 12px; }
  `],
})
export class TaskEditorForm implements OnChanges {
  @Input() task: M.BandTask | null = null;
  @Input() songs: M.Song[] = [];
  @Input() members: M.BandMember[] = [];
  @Input() currentUserId: string = '';
  @Output() done = new EventEmitter<{ action: 'save'; task: M.BandTask } | { action: 'delete'; taskId: string }>();
  @Output() cancel = new EventEmitter<void>();

  private readonly fb = inject(FormBuilder);

  statuses = Object.values(M.BandTaskStatus);
  priorities = Object.values(M.BandTaskPriority);
  statusLabel(s: M.BandTaskStatus) { return M.BandTaskStatusLabel[s]; }
  priorityLabel(p: M.BandTaskPriority) { return M.BandTaskPriorityLabel[p]; }

  form = this.fb.group({
    title: ['' as string, [Validators.required]],
    description: ['' as string],
    assigneeUid: [null as string | null],
    dueDate: [null as Date | null],
    songId: [null as string | null],
    status: [M.BandTaskStatus.todo as M.BandTaskStatus],
    priority: [M.BandTaskPriority.medium as M.BandTaskPriority],
  });

  /** Workspace members, plus the task's current assignee if they're no longer a member (preserves old data). */
  assigneeOptions = computed<M.BandMember[]>(() => {
    const members = this.members;
    const t = this.task;
    if (t?.assigneeUid && t.assigneeDisplayName && !members.some(m => m.userId === t.assigneeUid)) {
      return [{ userId: t.assigneeUid, displayName: `${t.assigneeDisplayName} (removed)`, role: M.BandRole.member }, ...members];
    }
    return members;
  });

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['task']) {
      const t = this.task;
      this.form.reset({
        title: t?.title ?? '',
        description: t?.description ?? '',
        assigneeUid: t?.assigneeUid ?? null,
        dueDate: t?.dueDate ?? null,
        songId: t?.songId ?? null,
        status: t?.status ?? M.BandTaskStatus.todo,
        priority: t?.priority ?? M.BandTaskPriority.medium,
      });
    }
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    // Look up the selected member to derive the display name. For an unknown uid (e.g., a removed
    // member still on an old task) fall back to whatever name the task already had.
    const member = this.assigneeOptions().find(m => m.userId === v.assigneeUid);
    const assigneeUid = v.assigneeUid || null;
    const assigneeDisplayName = member
      ? member.displayName.replace(/ \(removed\)$/, '')
      : (assigneeUid ? this.task?.assigneeDisplayName ?? '' : '');
    const base = {
      title: (v.title ?? '').trim(),
      description: v.description ?? '',
      assigneeUid,
      assigneeDisplayName,
      status: v.status ?? M.BandTaskStatus.todo,
      priority: v.priority ?? M.BandTaskPriority.medium,
      dueDate: v.dueDate ?? null,
      songId: v.songId ?? null,
      updatedAt: new Date(),
    };
    const task: M.BandTask = this.task
      ? { ...this.task, ...base }
      // New task: stamp createdByUid with the current user (Firestore rules require this on create).
      : { id: uuid(), ...base, createdByUid: this.currentUserId || null };
    this.done.emit({ action: 'save', task });
  }

  remove() { this.done.emit({ action: 'delete', taskId: this.task!.id }); }
}

type GroupMode = 'none' | 'assignee' | 'priority' | 'date';
interface TaskGroup { key: string; label: string }

const STATUS_COLUMNS: { status: M.BandTaskStatus; label: string }[] = [
  { status: M.BandTaskStatus.todo,       label: 'To do' },
  { status: M.BandTaskStatus.inProgress, label: 'In progress' },
  { status: M.BandTaskStatus.done,       label: 'Done' },
];

const DATE_BUCKETS: TaskGroup[] = [
  { key: 'overdue',  label: 'Overdue' },
  { key: 'today',    label: 'Today' },
  { key: 'thisWeek', label: 'This week' },
  { key: 'later',    label: 'Later' },
  { key: 'noDue',    label: 'No due' },
];

const PRIORITY_LANES: TaskGroup[] = [
  { key: M.BandTaskPriority.high,   label: 'High' },
  { key: M.BandTaskPriority.medium, label: 'Medium' },
  { key: M.BandTaskPriority.low,    label: 'Low' },
];

@Component({
  selector: 'tasks-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, MatTooltipModule, MatDialogModule, ScreenHeaderComponent, DragDropModule, TaskEditorForm, PresenceAvatarComponent],
  template: `
    <div class="bandos-page">
      <screen-header title="Tasks" subtitle="Plan, assign, and track band to-dos."></screen-header>
      <div class="bandos-toolbar tasks-toolbar">
        <button mat-flat-button color="primary" (click)="openPanel(null)">+ New task</button>
        <div class="group-toggle-wrap">
          <span class="group-label">Group by</span>
          <div class="segment-control">
            @for (opt of groupOptions; track opt.value) {
              <button
                class="segment-btn"
                [class.active]="groupMode() === opt.value"
                [style.--seg-color]="opt.color"
                [style.background]="groupMode() === opt.value ? opt.activeBg : null"
                [style.box-shadow]="groupMode() === opt.value ? ('0 0 0 1px ' + opt.ring + ', 0 2px 8px rgba(0,0,0,.4)') : null"
                [style.color]="groupMode() === opt.value ? opt.color : null"
                [matTooltip]="opt.label"
                matTooltipPosition="below"
                (click)="groupMode.set(opt.value)">
                <mat-icon>{{ opt.icon }}</mat-icon><span>{{ opt.label }}</span>
              </button>
            }
          </div>
        </div>
      </div>

      @for (swim of swimlanes(); track swim.key) {
        <div class="swimlane" [class.no-header]="groupMode() === 'none'">
          @if (groupMode() !== 'none') {
            <div class="swim-header">
              <span class="swim-label">{{ swim.label }}</span>
              <span class="swim-count">{{ swimCount(swim.key) }}</span>
            </div>
          }
          <div class="board" cdkDropListGroup>
            @for (col of statusColumns; track col.status) {
              <div class="col">
                <h3>{{ col.label }} <span class="count">{{ countFor(swim.key, col.status) }}</span></h3>
                <div class="col-list"
                     cdkDropList
                     [cdkDropListData]="col.status"
                     (cdkDropListDropped)="onDrop($event)">
                  @for (t of tasksFor(swim.key, col.status); track t.id) {
                    <mat-card
                      cdkDrag
                      [cdkDragData]="t"
                      [cdkDragDisabled]="isSaving(t.id)"
                      (cdkDragStarted)="onDragStarted()"
                      (cdkDragEnded)="onDragEnded()"
                      class="task-card"
                      (click)="onCardClick(t)">
                      <div class="task-header">
                        <div class="task-title">{{ t.title }}</div>
                        <div class="presence-avatars">
                          @for (user of usersViewingEntity(t.id); track user.userId) {
                            <presence-avatar [presence]="user"></presence-avatar>
                          }
                        </div>
                        <div class="priority-indicator" [class.high]="t.priority === 'high'" [class.medium]="t.priority === 'medium'" [title]="priorityLabel(t.priority)"></div>
                      </div>
                      <div class="task-meta">
                        <span>{{ t.assigneeDisplayName || 'Unassigned' }}</span>
                        @if (t.dueDate) {
                          <span class="meta-sep">·</span>
                          <span class="due-date" [class.due-soon]="dueDateDaysLeft(t.dueDate) <= 1" [class.due-warning]="dueDateDaysLeft(t.dueDate) > 1 && dueDateDaysLeft(t.dueDate) <= 6">
                            @if (dueDateDaysLeft(t.dueDate) <= 6) { Due in {{ dueDateDaysLeft(t.dueDate) + 1 }}d } @else { Due {{ t.dueDate | date:'short' }} }
                          </span>
                        }
                        @if (songTitleFor(t.songId); as st) {
                          <span class="meta-sep">·</span>
                          <span class="song-tag">{{ st }}</span>
                        }
                      </div>
                      @if (isSaving(t.id)) {
                        <div class="saving-overlay">
                          <mat-spinner diameter="22" strokeWidth="3"></mat-spinner>
                        </div>
                      }
                    </mat-card>
                  }
                </div>
              </div>
            }
          </div>
        </div>
      }

      <!-- Backdrop -->
      <div class="panel-backdrop" [class.visible]="panelOpen()" (click)="closePanel()"></div>
      <!-- Side panel -->
      <aside class="editor-panel" [class.open]="panelOpen()">
        <div class="panel-header">
          <div class="panel-header-text">
            <span class="panel-label">{{ panelItem() ? 'Edit task' : 'New task' }}</span>
            @if (panelItem()?.title) {
              <span class="panel-title">{{ panelItem()!.title }}</span>
            }
          </div>
          <button mat-icon-button (click)="closePanel()"><mat-icon>close</mat-icon></button>
        </div>
        <div class="panel-body">
          @if (panelOpen()) {
            <task-editor-form
              [task]="panelItem()"
              [songs]="songs()"
              [members]="members()"
              [currentUserId]="currentUserId()"
              (done)="onFormDone($event)"
              (cancel)="closePanel()" />
          }
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .tasks-toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .group-toggle-wrap { display: flex; align-items: center; gap: 10px; margin-left: auto; }
    .group-label { color: #9D9DA7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
    @media (max-width: 760px) { .group-label { display: none; } }
    .segment-control {
      display: flex; align-items: center;
      background: #20202A; border: 1px solid #383842; border-radius: 10px;
      padding: 3px; gap: 2px;
    }
    .segment-btn {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 12px; border-radius: 7px; border: none; cursor: pointer;
      background: transparent; color: #9D9DA7;
      font-size: 13px; font-weight: 600; font-family: inherit;
      transition: color 0.15s, background 0.15s, box-shadow 0.15s;
    }
    .segment-btn mat-icon {
      font-size: 15px; width: 15px; height: 15px;
      color: var(--seg-color); opacity: 0.45;
      transition: opacity 0.15s;
    }
    .segment-btn span { white-space: nowrap; }
    .segment-btn:hover:not(.active) { background: #22222A; color: #CDCDD3; }
    .segment-btn:hover:not(.active) mat-icon { opacity: 0.75; }
    .segment-btn.active mat-icon { opacity: 1; }

    @media (max-width: 760px) {
      .segment-btn { padding: 6px 8px; gap: 0; }
      .segment-btn span { display: none; }
      .segment-control { padding: 2px; gap: 1px; }
    }
    .swimlane { margin-bottom: 18px; }
    .swimlane.no-header { margin-bottom: 0; }
    .swim-header {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; margin-bottom: 8px;
      background: #1D1D23; border: 1px solid #383842; border-radius: 10px;
    }
    .swim-label { font-weight: 700; color: #CDCDD3; font-size: 14px; }
    .swim-count { background: #16161B; padding: 2px 8px; border-radius: 999px; font-size: 11px; color: #9D9DA7; }
    .board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .col { min-width: 0; }
    .col h3 { font-size: 13px; font-weight: 700; color: #9D9DA7; margin: 0 0 10px; display: flex; justify-content: space-between; gap: 8px; }
    .col h3 .count { background: #1D1D23; padding: 2px 8px; border-radius: 999px; font-size: 11px; flex-shrink: 0; }
    .col-list { min-height: 60px; border-radius: 12px; padding: 2px; transition: background 0.15s ease; }
    .col-list.cdk-drop-list-dragging { background: rgba(200,167,123,0.05); outline: 1px dashed rgba(200,167,123,0.35); }
    .col mat-card { margin-bottom: 10px; padding: 12px !important; cursor: grab; position: relative; }
    .col mat-card:active { cursor: grabbing; }
    .song-tag { color: #C8A77B; }
    .saving-overlay {
      position: absolute; inset: 0;
      background: rgba(22,22,27,0.65);
      display: flex; align-items: center; justify-content: center;
      border-radius: inherit;
      cursor: wait;
      z-index: 2;
    }
    .task-header { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
    .task-title { font-weight: 700; font-size: 14px; flex: 1; min-width: 0; }
    .presence-avatars { display: flex; align-items: center; gap: -8px; flex-shrink: 0; }
    .presence-avatars presence-avatar { margin-left: -8px; }
    .presence-avatars presence-avatar:first-child { margin-left: 0; }
    .priority-indicator { width: 8px; height: 8px; border-radius: 50%; background: #9D9DA7; flex-shrink: 0; }
    .priority-indicator.medium { background: #C8A77B; }
    .priority-indicator.high { background: #EF4A35; }
    .task-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 4px; color: #9D9DA7; font-size: 10px; margin-top: 4px; }
    .meta-sep { color: #4A4A55; }
    .due-date { padding: 2px 6px; border-radius: 4px; background: #1D1D23; color: #9D9DA7; }
    .due-date.due-warning { background: rgba(251, 191, 36, 0.15); color: #FBBF24; }
    .due-date.due-soon { background: rgba(239, 74, 53, 0.15); color: #EF4A35; }
    .song-tag { color: #C8A77B; }

    .cdk-drag-preview { box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 10px; cursor: grabbing; }
    .cdk-drag-placeholder { opacity: 0.25; }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0,0,0.2,1); }
    .col-list.cdk-drop-list-dragging mat-card:not(.cdk-drag-placeholder) { transition: transform 200ms cubic-bezier(0,0,0.2,1); }

    @media (max-width: 760px) { .board { grid-template-columns: 1fr; } }

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
export class TasksComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly snack = inject(MatSnackBar);
  private readonly presence = inject(PresenceService);

  readonly panelOpen = signal(false);
  private _keepPanelOpen = false;
  readonly panelItem = signal<M.BandTask | null>(null);

  readonly groupOptions: { value: GroupMode; label: string; icon: string; color: string; activeBg: string; ring: string }[] = [
    { value: 'none',     label: 'None',     icon: 'table_rows',     color: '#60A5FA', activeBg: 'rgba(96,165,250,0.13)',  ring: 'rgba(96,165,250,0.30)'  },
    { value: 'assignee', label: 'Assignee', icon: 'person',         color: '#F472B6', activeBg: 'rgba(244,114,182,0.13)', ring: 'rgba(244,114,182,0.30)' },
    { value: 'priority', label: 'Priority', icon: 'flag',           color: '#FB923C', activeBg: 'rgba(251,146,60,0.13)',  ring: 'rgba(251,146,60,0.30)'  },
    { value: 'date',     label: 'Due date', icon: 'calendar_today', color: '#FBBF24', activeBg: 'rgba(251,191,36,0.13)',  ring: 'rgba(251,191,36,0.30)'  },
  ];
  readonly groupMode = signal<GroupMode>('none');
  readonly statusColumns = STATUS_COLUMNS;

  // Presence tracking: Map entity IDs to users viewing them
  usersViewingByEntityId = computed(() => {
    const map = new Map<string, UserPresence[]>();
    this.presence.allPresences().forEach(p => {
      if (p.viewingEntityId) {
        if (!map.has(p.viewingEntityId)) {
          map.set(p.viewingEntityId, []);
        }
        map.get(p.viewingEntityId)!.push(p);
      }
    });
    return map;
  });

  // Get users viewing a specific entity
  usersViewingEntity = (entityId: string) => this.usersViewingByEntityId().get(entityId) ?? [];

  /** Tasks whose status update is in flight. Drag and edit-click are disabled while present. */
  private readonly savingTaskIds = signal(new Set<string>());
  /** Optimistic status overrides for tasks currently being moved (id -> new status). */
  private readonly pendingMoves = signal(new Map<string, M.BandTaskStatus>());

  tasks = computed<M.BandTask[]>(() => {
    const raw = this.wsc.workspace()?.tasks ?? [];
    const overrides = this.pendingMoves();
    if (overrides.size === 0) return raw;
    return raw.map(t => {
      const next = overrides.get(t.id);
      return next ? { ...t, status: next } : t;
    });
  });

  songs = computed<M.Song[]>(() => this.wsc.workspace()?.songs ?? []);
  members = computed<M.BandMember[]>(() => this.wsc.workspace()?.members ?? []);
  currentUserId = computed<string>(() => this.wsc.workspace()?.currentUserId ?? '');
  private songsById = computed(() => new Map(this.songs().map(s => [s.id, s])));

  swimlanes = computed<TaskGroup[]>(() => {
    const mode = this.groupMode();
    if (mode === 'none') return [{ key: '', label: '' }];
    return this.buildSwimlanes(mode, this.tasks());
  });

  openPanel(item: M.BandTask | null) { this.panelItem.set(item); this.panelOpen.set(true); this._keepPanelOpen = true; setTimeout(() => (this._keepPanelOpen = false)); }
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

  tasksFor(swimlaneKey: string, status: M.BandTaskStatus): M.BandTask[] {
    const mode = this.groupMode();
    return this.tasks().filter(t => {
      if (t.status !== status) return false;
      if (mode === 'none') return true;
      return this.taskSwimlaneKey(t, mode) === swimlaneKey;
    });
  }
  countFor(swimlaneKey: string, status: M.BandTaskStatus) { return this.tasksFor(swimlaneKey, status).length; }
  swimCount(swimlaneKey: string): number {
    const mode = this.groupMode();
    if (mode === 'none') return this.tasks().length;
    return this.tasks().filter(t => this.taskSwimlaneKey(t, mode) === swimlaneKey).length;
  }
  priorityLabel(p: M.BandTaskPriority) { return M.BandTaskPriorityLabel[p]; }
  isSaving(id: string): boolean { return this.savingTaskIds().has(id); }
  songTitleFor(songId: string | null): string | null {
    if (!songId) return null;
    return this.songsById().get(songId)?.title ?? null;
  }

  dueDateDaysLeft(dueDate: Date): number {
    const today = startOfDay(new Date());
    const due = startOfDay(dueDate);
    return differenceInDays(due, today);
  }

  onCardClick(t: M.BandTask) {
    if (this.isSaving(t.id)) return;
    this.openPanel(t);
  }

  /** Lock body scroll while dragging to prevent the CDK preview from triggering a spurious scrollbar. */
  onDragStarted() { document.body.classList.add('bandos-dragging'); }
  onDragEnded()   { document.body.classList.remove('bandos-dragging'); }

  async onFormDone(event: { action: 'save'; task: M.BandTask } | { action: 'delete'; taskId: string }) {
    if (event.action === 'save') {
      const isNew = !this.panelItem();
      this.closePanel();
      try {
        await this.wsc.saveTask(event.task);
        this.snack.open(isNew ? 'Task created.' : 'Task saved.', 'OK', { duration: 1800 });
      } catch (err: any) {
        console.error('saveTask failed', err);
        this.snack.open(err?.message ?? 'Could not save task.', 'OK', { duration: 4000 });
      }
    } else if (event.action === 'delete') {
      const taskId = event.taskId;
      this.closePanel();
      try {
        await this.wsc.deleteTask(taskId);
        this.snack.open('Task deleted.', 'OK', { duration: 1800 });
      } catch (err: any) {
        console.error('task action failed', err);
        this.snack.open(err?.message ?? 'Action failed.', 'OK', { duration: 4000 });
      }
    }
  }

  // ----- Swimlane helpers -----

  private buildSwimlanes(mode: Exclude<GroupMode, 'none'>, tasks: M.BandTask[]): TaskGroup[] {
    switch (mode) {
      case 'priority': return PRIORITY_LANES;
      case 'date':     return DATE_BUCKETS;
      case 'assignee': {
        // Only include assignees that have tasks; "Unassigned" first.
        const names = new Set<string>();
        tasks.forEach(t => names.add((t.assigneeDisplayName ?? '').trim()));
        return Array.from(names)
          .sort((a, b) => {
            if (a === '' && b !== '') return -1;
            if (b === '' && a !== '') return 1;
            return a.localeCompare(b);
          })
          .map(name => ({ key: name, label: name || 'Unassigned' }));
      }
    }
  }

  private taskSwimlaneKey(t: M.BandTask, mode: Exclude<GroupMode, 'none'>): string {
    switch (mode) {
      case 'priority': return t.priority;
      case 'assignee': return (t.assigneeDisplayName ?? '').trim();
      case 'date':     return this.dateBucket(t.dueDate);
    }
  }

  private dateBucket(d: Date | null): string {
    if (!d) return 'noDue';
    const today = startOfDay(new Date());
    const due = startOfDay(d);
    if (isBefore(due, today)) return 'overdue';
    if (isSameDay(due, today)) return 'today';
    const weekEnd = endOfWeek(today, { weekStartsOn: 1 });
    return isAfter(due, weekEnd) ? 'later' : 'thisWeek';
  }

  async onDrop(event: CdkDragDrop<M.BandTaskStatus>) {
    const task = event.item.data as M.BandTask;
    const targetStatus = event.container.data;
    if (task.status === targetStatus) return;

    // Optimistically set the new status so the card stays in the target column during save.
    const moves = new Map(this.pendingMoves());
    moves.set(task.id, targetStatus);
    this.pendingMoves.set(moves);

    const saving = new Set(this.savingTaskIds());
    saving.add(task.id);
    this.savingTaskIds.set(saving);

    try {
      await this.wsc.updateTaskStatus(task.id, targetStatus);
    } catch (err: any) {
      this.snack.open(err?.message ?? 'Could not update task status.', 'OK', { duration: 3000 });
    } finally {
      const afterMoves = new Map(this.pendingMoves());
      afterMoves.delete(task.id);
      this.pendingMoves.set(afterMoves);

      const afterSaving = new Set(this.savingTaskIds());
      afterSaving.delete(task.id);
      this.savingTaskIds.set(afterSaving);
    }
  }
}
