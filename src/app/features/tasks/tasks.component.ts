import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'task-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit task' : 'New task' }}</h2>
    <form mat-dialog-content [formGroup]="form" class="bandos-stack" style="min-width:420px;">
      <mat-form-field appearance="fill"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Description</mat-label><textarea matInput rows="3" formControlName="description"></textarea></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Assignee</mat-label><input matInput formControlName="assigneeDisplayName" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Due date</mat-label><input matInput type="date" formControlName="dueDate" /></mat-form-field>
      <div class="bandos-row">
        <mat-form-field appearance="fill" style="flex:1;">
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (s of statuses; track s) { <mat-option [value]="s">{{ statusLabel(s) }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="fill" style="flex:1;">
          <mat-label>Priority</mat-label>
          <mat-select formControlName="priority">
            @for (p of priorities; track p) { <mat-option [value]="p">{{ priorityLabel(p) }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>
    </form>
    <div mat-dialog-actions align="end">
      @if (existing) { <button mat-button color="warn" (click)="remove()">Delete</button> }
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
})
export class TaskEditorDialog {
  ref = inject(MatDialogRef<TaskEditorDialog>);
  private readonly fb = inject(FormBuilder);
  data: { task?: M.BandTask } = inject<{ task?: M.BandTask }>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  existing = !!this.data.task;
  statuses = Object.values(M.BandTaskStatus);
  priorities = Object.values(M.BandTaskPriority);
  statusLabel(s: M.BandTaskStatus) { return M.BandTaskStatusLabel[s]; }
  priorityLabel(p: M.BandTaskPriority) { return M.BandTaskPriorityLabel[p]; }

  form = this.fb.nonNullable.group({
    title: [this.data.task?.title ?? '', [Validators.required]],
    description: [this.data.task?.description ?? ''],
    assigneeDisplayName: [this.data.task?.assigneeDisplayName ?? '', [Validators.required]],
    dueDate: [this.toInputDate(this.data.task?.dueDate ?? new Date()), [Validators.required]],
    status: [this.data.task?.status ?? M.BandTaskStatus.todo],
    priority: [this.data.task?.priority ?? M.BandTaskPriority.medium],
  });

  toInputDate(d: Date) { return d.toISOString().substring(0, 10); }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const task: M.BandTask = this.data.task
      ? { ...this.data.task, ...v, dueDate: new Date(v.dueDate), updatedAt: new Date() }
      : { id: uuid(), ...v, dueDate: new Date(v.dueDate), updatedAt: new Date() };
    this.ref.close({ action: 'save', task });
  }
  remove() { this.ref.close({ action: 'delete' }); }
}

@Component({
  selector: 'tasks-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, ScreenHeaderComponent, MatDialogModule, DragDropModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Tasks" subtitle="Plan, assign, and track band to-dos."></screen-header>
      <div class="bandos-toolbar">
        <button mat-flat-button color="primary" (click)="newTask()">+ New task</button>
      </div>

      <div class="board" cdkDropListGroup>
        @for (col of columns; track col.status) {
          <div class="col">
            <h3>{{ col.label }} <span class="count">{{ countFor(col.status) }}</span></h3>
            <div class="col-list"
                 cdkDropList
                 [cdkDropListData]="col.status"
                 (cdkDropListDropped)="onDrop($event)">
              @for (t of tasksFor(col.status); track t.id) {
                <mat-card
                  cdkDrag
                  [cdkDragData]="t"
                  (click)="edit(t)">
                  <div class="task-title">{{ t.title }}</div>
                  <div class="task-meta">{{ t.assigneeDisplayName }} · due {{ t.dueDate | date:'mediumDate' }}</div>
                  <div class="priority" [class.high]="t.priority === 'high'" [class.medium]="t.priority === 'medium'">{{ priorityLabel(t.priority) }}</div>
                </mat-card>
              }
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .board { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
    .col h3 { font-size: 13px; font-weight: 700; color: #9D9DA7; margin: 0 0 10px; display: flex; justify-content: space-between; }
    .col h3 .count { background: #1D1D23; padding: 2px 8px; border-radius: 999px; font-size: 11px; }
    .col-list { min-height: 60px; border-radius: 12px; padding: 2px; transition: background 0.15s ease; }
    .col-list.cdk-drop-list-dragging { background: rgba(200,167,123,0.05); outline: 1px dashed rgba(200,167,123,0.35); }
    .col mat-card { margin-bottom: 10px; padding: 12px !important; cursor: grab; }
    .col mat-card:active { cursor: grabbing; }
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

  columns = [
    { status: M.BandTaskStatus.todo, label: 'To do' },
    { status: M.BandTaskStatus.inProgress, label: 'In progress' },
    { status: M.BandTaskStatus.done, label: 'Done' },
  ];

  tasks = computed(() => this.wsc.workspace()?.tasks ?? []);
  tasksFor(s: M.BandTaskStatus) { return this.tasks().filter(t => t.status === s); }
  countFor(s: M.BandTaskStatus) { return this.tasksFor(s).length; }
  priorityLabel(p: M.BandTaskPriority) { return M.BandTaskPriorityLabel[p]; }

  newTask() {
    const ref = this.dialog.open(TaskEditorDialog, { data: {} });
    ref.afterClosed().subscribe(async r => { if (r?.action === 'save') await this.wsc.saveTask(r.task); });
  }
  edit(t: M.BandTask) {
    const ref = this.dialog.open(TaskEditorDialog, { data: { task: t } });
    ref.afterClosed().subscribe(async r => {
      if (r?.action === 'save') await this.wsc.saveTask(r.task);
      else if (r?.action === 'delete') await this.wsc.deleteTask(t.id);
    });
  }

  async onDrop(event: CdkDragDrop<M.BandTaskStatus>) {
    const task = event.item.data as M.BandTask;
    const targetStatus = event.container.data;
    if (task.status === targetStatus) return;
    await this.wsc.updateTaskStatus(task.id, targetStatus);
  }
}
