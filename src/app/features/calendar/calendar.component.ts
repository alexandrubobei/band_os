import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import {
  addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format,
  isSameDay, isSameMonth, startOfMonth, startOfWeek, subMonths,
} from 'date-fns';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

const EVENT_TYPE_COLORS: Record<M.BandEventType, string> = {
  rehearsal: '#4A6BB8',
  show:      '#B08F5E',
  recording: '#7C5FB5',
  meeting:   '#5A5D6B',
  release:   '#3FA476',
  other:     '#6B6D7A',
};

interface CalendarDay {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  events: M.BandEvent[];
}

interface EventEditorData { event?: M.BandEvent; seedStartAt?: Date }

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
  data: EventEditorData = inject<EventEditorData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  existing = !!this.data.event;
  types = Object.values(M.BandEventType);
  typeLabel(t: M.BandEventType) { return M.BandEventTypeLabel[t]; }

  form = this.fb.nonNullable.group({
    title: [this.data.event?.title ?? '', [Validators.required]],
    type: [this.data.event?.type ?? M.BandEventType.rehearsal],
    startAt: [this.toInputDateTime(this.data.event?.startAt ?? this.data.seedStartAt ?? new Date()), [Validators.required]],
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
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, ScreenHeaderComponent, MatDialogModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Calendar" subtitle="Rehearsals, shows, recordings, and more."></screen-header>
      <div class="bandos-toolbar">
        <button mat-flat-button color="primary" (click)="newEvent()">+ New event</button>
      </div>

      <div class="cal-card">
        <div class="cal-header">
          <button mat-icon-button (click)="prevMonth()" aria-label="Previous month"><mat-icon>chevron_left</mat-icon></button>
          <div class="cal-title">{{ monthLabel() }}</div>
          <button mat-icon-button (click)="nextMonth()" aria-label="Next month"><mat-icon>chevron_right</mat-icon></button>
          <button mat-stroked-button (click)="goToday()" class="today-btn">Today</button>
        </div>
        <div class="cal-weekdays">
          @for (w of weekdayLabels; track w) { <div class="cal-weekday">{{ w }}</div> }
        </div>
        <div class="cal-grid">
          @for (day of monthGrid(); track day.date.getTime()) {
            <div class="cal-cell"
                 [class.out-of-month]="!day.inMonth"
                 [class.is-today]="day.isToday"
                 (click)="newEventOn(day.date)">
              <div class="cal-day-num">{{ day.date.getDate() }}</div>
              @for (e of day.events.slice(0, 3); track e.id) {
                <div class="cal-chip"
                     [style.background]="colorFor(e.type)"
                     (click)="edit(e); $event.stopPropagation()">
                  <span class="cal-chip-time">{{ e.startAt | date:'HH:mm' }}</span>
                  <span class="cal-chip-title">{{ e.title }}</span>
                </div>
              }
              @if (day.events.length > 3) {
                <div class="cal-more">+{{ day.events.length - 3 }} more</div>
              }
            </div>
          }
        </div>
      </div>

      @if (events().length === 0) {
        <p class="bandos-muted">No events scheduled.</p>
      } @else {
        <div class="bandos-stack">
          @for (e of events(); track e.id) {
            <mat-card (click)="edit(e)" style="cursor:pointer;">
              <div class="ev-row">
                <div class="date" [style.borderLeft]="'4px solid ' + colorFor(e.type)">
                  <div class="d">{{ e.startAt | date:'d' }}</div>
                  <div class="m">{{ e.startAt | date:'MMM' }}</div>
                </div>
                <div class="ev-info">
                  <div class="title-row">
                    <div class="ev-title">{{ e.title }}</div>
                    <span class="ev-pill" [style.background]="colorFor(e.type)">{{ typeLabel(e.type) }}</span>
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
    .ev-pill { font-size: 11px; font-weight: 700; color: #fff; padding: 3px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em; white-space: nowrap; }
    .meta { color: #9D9DA7; font-size: 12px; margin-top: 4px; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 8px; }

    .cal-card { background: #1D1D23; border: 1px solid #2A2A31; border-radius: 12px; padding: 14px; margin-bottom: 16px; }
    .cal-header { display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
    .cal-title { flex: 1; text-align: center; font-weight: 700; font-size: 16px; color: #E6E6EC; }
    .today-btn { margin-left: 8px; }
    .cal-weekdays { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 4px; }
    .cal-weekday { text-align: center; font-size: 11px; color: #9D9DA7; text-transform: uppercase; padding: 4px; font-weight: 700; letter-spacing: 0.04em; }
    .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; }
    .cal-cell { background: #16161B; border: 1px solid #2A2A31; border-radius: 8px; min-height: 96px; padding: 6px; cursor: pointer; display: flex; flex-direction: column; gap: 3px; overflow: hidden; }
    .cal-cell:hover { background: #1A1A20; }
    .cal-cell.out-of-month { opacity: 0.35; }
    .cal-cell.is-today { border-color: #C8A77B; border-width: 2px; padding: 5px; }
    .cal-cell.is-today .cal-day-num { color: #C8A77B; }
    .cal-day-num { font-size: 12px; font-weight: 700; color: #E6E6EC; margin-bottom: 2px; }
    .cal-chip { background: #6B6D7A; border-radius: 4px; padding: 2px 5px; font-size: 11px; line-height: 1.3; color: #fff; font-weight: 600; cursor: pointer; display: flex; gap: 4px; align-items: center; overflow: hidden; white-space: nowrap; }
    .cal-chip:hover { filter: brightness(1.15); }
    .cal-chip-time { font-weight: 700; flex-shrink: 0; opacity: 0.85; }
    .cal-chip-title { overflow: hidden; text-overflow: ellipsis; }
    .cal-more { font-size: 10px; color: #9D9DA7; padding: 0 4px; }

    @media (max-width: 760px) {
      .cal-card { padding: 8px; }
      .cal-cell { min-height: 56px; padding: 3px; gap: 2px; }
      .cal-cell.is-today { padding: 2px; }
      .cal-day-num { font-size: 11px; }
      .cal-chip { padding: 1px 3px; font-size: 9px; border-radius: 3px; }
      .cal-chip-time { display: none; }
      .cal-weekday { font-size: 9px; padding: 2px; }
      .cal-more { font-size: 9px; padding: 0 2px; }
      .today-btn { display: none; }
    }
  `],
})
export class CalendarComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);

  currentMonth = signal(new Date());
  weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  events = computed(() => [...(this.wsc.workspace()?.events ?? [])].sort((a, b) => a.startAt.getTime() - b.startAt.getTime()));

  monthGrid = computed<CalendarDay[]>(() => {
    const month = this.currentMonth();
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const today = new Date();
    const all = this.events();
    return eachDayOfInterval({ start, end }).map(date => ({
      date,
      inMonth: isSameMonth(date, month),
      isToday: isSameDay(date, today),
      events: all.filter(e => isSameDay(e.startAt, date)),
    }));
  });

  monthLabel = computed(() => format(this.currentMonth(), 'MMMM yyyy'));

  typeLabel(t: M.BandEventType) { return M.BandEventTypeLabel[t]; }
  colorFor(t: M.BandEventType): string { return EVENT_TYPE_COLORS[t]; }

  prevMonth() { this.currentMonth.set(subMonths(this.currentMonth(), 1)); }
  nextMonth() { this.currentMonth.set(addMonths(this.currentMonth(), 1)); }
  goToday() { this.currentMonth.set(new Date()); }

  newEvent() {
    const ref = this.dialog.open(EventEditorDialog, { data: {} });
    ref.afterClosed().subscribe(async r => { if (r?.action === 'save') await this.wsc.saveEvent(r.event); });
  }

  newEventOn(date: Date) {
    const seed = new Date(date);
    seed.setHours(19, 0, 0, 0);
    const ref = this.dialog.open(EventEditorDialog, { data: { seedStartAt: seed } });
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
