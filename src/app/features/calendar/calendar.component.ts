import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'event-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit event' : 'New event' }}</h2>
    <form mat-dialog-content [formGroup]="form" class="bandos-stack" style="min-width:420px;">
      <mat-form-field appearance="fill"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <mat-form-field appearance="fill">
        <mat-label>Type</mat-label>
        <mat-select formControlName="type">
          @for (t of types; track t) { <mat-option [value]="t">{{ typeLabel(t) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Start</mat-label><input matInput type="datetime-local" formControlName="startAt" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Location</mat-label><input matInput formControlName="location" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Notes</mat-label><textarea matInput rows="3" formControlName="notes"></textarea></mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      @if (existing) { <button mat-button color="warn" (click)="remove()">Delete</button> }
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
})
export class EventEditorDialog {
  ref = inject(MatDialogRef<EventEditorDialog>);
  private readonly fb = inject(FormBuilder);
  data: { event?: M.BandEvent } = inject<{ event?: M.BandEvent }>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  existing = !!this.data.event;
  types = Object.values(M.BandEventType);
  typeLabel(t: M.BandEventType) { return M.BandEventTypeLabel[t]; }

  form = this.fb.nonNullable.group({
    title: [this.data.event?.title ?? '', [Validators.required]],
    type: [this.data.event?.type ?? M.BandEventType.rehearsal],
    startAt: [this.toInputDateTime(this.data.event?.startAt ?? new Date()), [Validators.required]],
    location: [this.data.event?.location ?? ''],
    notes: [this.data.event?.notes ?? ''],
  });
  toInputDateTime(d: Date) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const event: M.BandEvent = this.data.event
      ? { ...this.data.event, ...v, startAt: new Date(v.startAt) }
      : { id: uuid(), ...v, startAt: new Date(v.startAt), checklist: [] };
    this.ref.close({ action: 'save', event });
  }
  remove() { this.ref.close({ action: 'delete' }); }
}

@Component({
  selector: 'calendar-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, ScreenHeaderComponent, MatDialogModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Calendar" subtitle="Rehearsals, shows, recordings, and more."></screen-header>
      <div class="bandos-toolbar">
        <button mat-flat-button color="primary" (click)="newEvent()">+ New event</button>
      </div>
      @if (events().length === 0) {
        <p class="bandos-muted">No events scheduled.</p>
      } @else {
        <div class="bandos-stack">
          @for (e of events(); track e.id) {
            <mat-card (click)="edit(e)" style="cursor:pointer;">
              <div class="ev-row">
                <div class="date">
                  <div class="d">{{ e.startAt | date:'d' }}</div>
                  <div class="m">{{ e.startAt | date:'MMM' }}</div>
                </div>
                <div class="ev-info">
                  <div class="title-row">
                    <div class="ev-title">{{ e.title }}</div>
                    <span class="bandos-pill">{{ typeLabel(e.type) }}</span>
                  </div>
                  <div class="meta">{{ e.startAt | date:'EEEE, MMM d · HH:mm' }} · {{ e.location }}</div>
                  @if (e.notes) { <div class="notes">{{ e.notes }}</div> }
                </div>
              </div>
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .ev-row { display: flex; gap: 14px; align-items: flex-start; }
    .date { width: 60px; text-align: center; padding: 8px; border-radius: 10px; background: #1D1D23; }
    .date .d { font-size: 22px; font-weight: 800; line-height: 1; }
    .date .m { font-size: 11px; color: #9D9DA7; text-transform: uppercase; }
    .ev-info { flex: 1; }
    .title-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .ev-title { font-weight: 700; }
    .meta { color: #9D9DA7; font-size: 12px; margin-top: 4px; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 8px; }
  `],
})
export class CalendarComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);
  events = computed(() => [...(this.wsc.workspace()?.events ?? [])].sort((a, b) => a.startAt.getTime() - b.startAt.getTime()));
  typeLabel(t: M.BandEventType) { return M.BandEventTypeLabel[t]; }
  newEvent() {
    const ref = this.dialog.open(EventEditorDialog, { data: {} });
    ref.afterClosed().subscribe(async r => { if (r?.action === 'save') await this.wsc.saveEvent(r.event); });
  }
  edit(e: M.BandEvent) {
    const ref = this.dialog.open(EventEditorDialog, { data: { event: e } });
    ref.afterClosed().subscribe(async r => {
      if (r?.action === 'save') await this.wsc.saveEvent(r.event);
      else if (r?.action === 'delete') await this.wsc.deleteEvent(e.id);
    });
  }
}
