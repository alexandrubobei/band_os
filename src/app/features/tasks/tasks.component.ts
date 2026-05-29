import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { endOfWeek, isAfter, isBefore, isSameDay, startOfDay } from 'date-fns';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

interface TaskEditorData { task?: M.BandTask; songs: M.Song[]; members: M.BandMember[]; currentUserId: string }

@Component({
  selector: 'task-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit task' : 'New task' }}</h2>
    <form mat-dialog-content [formGroup]="form" class="bandos-stack" style="min-width:420px;">
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
          @for (s of data.songs; track s.id) { <mat-option [value]="s.id">{{ s.title }}</mat-option> }
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
    <div mat-dialog-actions align="end">
      @if (existing) { <button mat-button color="warn" style="margin-right: auto;" (click)="remove()">Delete</button> }
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
})
export class TaskEditorDialog {
  ref = inject(MatDialogRef<TaskEditorDialog>);
  private readonly fb = inject(FormBuilder);
  data: TaskEditorData = inject<TaskEditorData>(MAT_DIALOG_DATA, { optional: true }) ?? { songs: [], members: [], currentUserId: '' };
  existing = !!this.data.task;
  statuses = Object.values(M.BandTaskStatus);
  priorities = Object.values(M.BandTaskPriority);
  statusLabel(s: M.BandTaskStatus) { return M.BandTaskStatusLabel[s]; }
  priorityLabel(p: M.BandTaskPriority) { return M.BandTaskPriorityLabel[p]; }

  form = this.fb.group({
    title: [this.data.task?.title ?? '', [Validators.required]],
    description: [this.data.task?.description ?? ''],
    assigneeUid: [this.data.task?.assigneeUid ?? null as string | null],
    dueDate: [this.data.task?.dueDate ?? null as Date | null],
    songId: [this.data.task?.songId ?? null as string | null],
    status: [this.data.task?.status ?? M.BandTaskStatus.todo],
    priority: [this.data.task?.priority ?? M.BandTaskPriority.medium],
  });

  /** Workspace members, plus the task's current assignee if they're no longer a member (preserves old data). */
  assigneeOptions = computed<M.BandMember[]>(() => {
    const members = this.data.members;
    const t = this.data.task;
    if (t?.assigneeUid && t.assigneeDisplayName && !members.some(m => m.userId === t.assigneeUid)) {
      return [{ userId: t.assigneeUid, displayName: `${t.assigneeDisplayName} (removed)`, role: M.BandRole.member }, ...members];
    }
    return members;
  });

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    // Look up the selected member to derive the display name. For an unknown uid (e.g., a removed
    // member still on an old task) fall back to whatever name the task already had.
    const member = this.assigneeOptions().find(m => m.userId === v.assigneeUid);
    const assigneeUid = v.assigneeUid || null;
    const assigneeDisplayName = member
      ? member.displayName.replace(/ \(removed\)$/, '')
      : (assigneeUid ? this.data.task?.assigneeDisplayName ?? '' : '');
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
    const task: M.BandTask = this.data.task
      ? { ...this.data.task, ...base }
      // New task: stamp createdByUid with the current user (Firestore rules require this on create).
      : { id: uuid(), ...base, createdByUid: this.data.currentUserId || null };
    this.ref.close({ action: 'save', task });
  }
  remove() { this.ref.close({ action: 'delete' }); }
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
  imports: [CommonModule, MatButtonModule, MatButtonToggleModule, MatCardModule, MatIconModule, MatProgressSpinnerModule, ScreenHeaderComponent, MatDialogModule, DragDropModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Tasks" subtitle="Plan, assign, and track band to-dos."></screen-header>
      <div class="bandos-toolbar tasks-toolbar">
        <button mat-flat-button color="primary" (click)="newTask()">+ New task</button>
        <div class="group-toggle-wrap">
          <span class="group-label">Group by</span>
          <mat-button-toggle-group
            class="group-toggle"
            [value]="groupMode()"
            (change)="groupMode.set($event.value)"
            hideSingleSelectionIndicator>
            <mat-button-toggle value="none">None</mat-button-toggle>
            <mat-button-toggle value="assignee">Assignee</mat-button-toggle>
            <mat-button-toggle value="priority">Priority</mat-button-toggle>
            <mat-button-toggle value="date">Due date</mat-button-toggle>
          </mat-button-toggle-group>
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
                      <div class="task-title">{{ t.title }}</div>
                      <div class="task-meta">
                        {{ t.assigneeDisplayName || 'Unassigned' }}
                        @if (t.dueDate) { · due {{ t.dueDate | date:'mediumDate' }} }
                        @if (songTitleFor(t.songId); as st) { · <span class="song-tag">{{ st }}</span> }
                      </div>
                      <div class="priority" [class.high]="t.priority === 'high'" [class.medium]="t.priority === 'medium'">{{ priorityLabel(t.priority) }}</div>
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
    </div>
  `,
  styles: [`
    .tasks-toolbar { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .group-toggle-wrap { display: flex; align-items: center; gap: 8px; margin-left: auto; }
    .group-label { color: #9D9DA7; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 700; }
    .swimlane { margin-bottom: 18px; }
    .swimlane.no-header { margin-bottom: 0; }
    .swim-header {
      display: flex; align-items: center; gap: 10px;
      padding: 8px 12px; margin-bottom: 8px;
      background: #1D1D23; border: 1px solid #2A2A31; border-radius: 10px;
    }
    .swim-label { font-weight: 700; color: #E6E6EC; font-size: 14px; }
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
    .task-title { font-weight: 700; font-size: 14px; }
    .task-meta { color: #9D9DA7; font-size: 11px; margin-top: 4px; }
    .priority { display: inline-block; margin-top: 8px; padding: 2px 8px; border-radius: 999px; font-size: 11px; background: #1D1D23; color: #9D9DA7; }
    .priority.medium { color: #C8A77B; background: rgba(200,167,123,0.1); }
    .priority.high { color: #EF4A35; background: rgba(239,74,53,0.12); }

    .cdk-drag-preview { box-shadow: 0 10px 30px rgba(0,0,0,0.5); border-radius: 10px; cursor: grabbing; }
    .cdk-drag-placeholder { opacity: 0.25; }
    .cdk-drag-animating { transition: transform 200ms cubic-bezier(0,0,0.2,1); }
    .col-list.cdk-drop-list-dragging mat-card:not(.cdk-drag-placeholder) { transition: transform 200ms cubic-bezier(0,0,0.2,1); }

    @media (max-width: 760px) { .board { grid-template-columns: 1fr; } }
  `],
})
export class TasksComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  readonly groupMode = signal<GroupMode>('none');
  readonly statusColumns = STATUS_COLUMNS;

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

  onCardClick(t: M.BandTask) {
    if (this.isSaving(t.id)) return;
    this.edit(t);
  }

  /** Lock body scroll while dragging to prevent the CDK preview from triggering a spurious scrollbar. */
  onDragStarted() { document.body.classList.add('bandos-dragging'); }
  onDragEnded()   { document.body.classList.remove('bandos-dragging'); }

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

  newTask() {
    const ref = this.dialog.open(TaskEditorDialog, { data: { songs: this.songs(), members: this.members(), currentUserId: this.currentUserId() } });
    ref.afterClosed().subscribe(async r => {
      if (r?.action !== 'save') return;
      try {
        await this.wsc.saveTask(r.task);
        this.snack.open('Task created.', 'OK', { duration: 1800 });
      } catch (err: any) {
        console.error('saveTask failed', err);
        this.snack.open(err?.message ?? 'Could not save task.', 'OK', { duration: 4000 });
      }
    });
  }
  edit(t: M.BandTask) {
    const ref = this.dialog.open(TaskEditorDialog, { data: { task: t, songs: this.songs(), members: this.members(), currentUserId: this.currentUserId() } });
    ref.afterClosed().subscribe(async r => {
      try {
        if (r?.action === 'save') {
          await this.wsc.saveTask(r.task);
          this.snack.open('Task saved.', 'OK', { duration: 1800 });
        } else if (r?.action === 'delete') {
          await this.wsc.deleteTask(t.id);
          this.snack.open('Task deleted.', 'OK', { duration: 1800 });
        }
      } catch (err: any) {
        console.error('task action failed', err);
        this.snack.open(err?.message ?? 'Action failed.', 'OK', { duration: 4000 });
      }
    });
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
