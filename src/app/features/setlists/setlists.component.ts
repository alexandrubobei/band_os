import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'setlist-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit setlist' : 'New setlist' }}</h2>
    <form mat-dialog-content [formGroup]="form" class="bandos-stack" style="min-width:500px;">
      <mat-form-field appearance="fill"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>

      <div class="bandos-stack">
        <div class="bandos-row" style="justify-content:space-between;align-items:center;">
          <h3 class="bandos-section-title">Songs in order</h3>
          <button mat-stroked-button (click)="addItem()" type="button">+ Add</button>
        </div>
        @for (it of items(); track it.id; let i = $index) {
          <div class="item">
            <span class="ord">{{ i + 1 }}</span>
            <mat-form-field appearance="fill" style="flex:1;">
              <mat-label>Song</mat-label>
              <mat-select [value]="it.songId" (selectionChange)="updateItem(i, { songId: $event.value, songTitle: songTitle($event.value), songDuration: songDuration($event.value) })">
                @for (s of songs; track s.id) { <mat-option [value]="s.id">{{ s.title }} ({{ s.duration }})</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="fill" style="width:120px;">
              <mat-label>Break (sec)</mat-label>
              <input matInput type="number" [value]="it.breakAfterSeconds" (input)="updateItem(i, { breakAfterSeconds: +$any($event.target).value })" />
            </mat-form-field>
            <button mat-icon-button (click)="removeItem(i)" type="button"><mat-icon>delete</mat-icon></button>
          </div>
        }
      </div>
      <div class="totals">Total: {{ totalsLabel() }} (break {{ breakLabel() }})</div>
    </form>
    <div mat-dialog-actions align="end">
      @if (existing) { <button mat-button color="warn" (click)="remove()">Delete</button> }
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
  styles: [`
    .item { display: flex; gap: 8px; align-items: center; }
    .ord { width: 24px; text-align: center; color: #9D9DA7; font-weight: 700; }
    .totals { color: #C8A77B; font-weight: 700; }
  `],
})
export class SetlistEditorDialog {
  ref = inject(MatDialogRef<SetlistEditorDialog>);
  private readonly fb = inject(FormBuilder);
  data: { setlist?: M.BandSetlist; songs: M.Song[] } = inject(MAT_DIALOG_DATA);
  existing = !!this.data.setlist;
  songs = this.data.songs;

  form = this.fb.nonNullable.group({
    title: [this.data.setlist?.title ?? 'New setlist', [Validators.required]],
    notes: [this.data.setlist?.notes ?? ''],
  });

  items = signal<M.BandSetlistItem[]>(this.data.setlist?.items.map(i => ({ ...i })) ?? []);

  songTitle(id: string) { return this.songs.find(s => s.id === id)?.title ?? ''; }
  songDuration(id: string) { return this.songs.find(s => s.id === id)?.duration ?? '0:00'; }

  totals = computed(() => M.setlistTotals({
    id: 'tmp', title: '', notes: '', updatedAt: new Date(), items: this.items(),
  }));
  totalsLabel = computed(() => this.totals().totalLabel);
  breakLabel = computed(() => this.totals().breakLabel);

  addItem() {
    const first = this.songs[0];
    this.items.update(arr => [...arr, {
      id: uuid(), songId: first?.id ?? '', songTitle: first?.title ?? '',
      songDuration: first?.duration ?? '0:00', order: arr.length, breakAfterSeconds: 0, breakAfterNotes: '',
    }]);
  }
  updateItem(idx: number, patch: Partial<M.BandSetlistItem>) {
    this.items.update(arr => arr.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  removeItem(idx: number) {
    this.items.update(arr => arr.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order: i })));
  }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const setlist: M.BandSetlist = this.data.setlist
      ? { ...this.data.setlist, ...this.form.getRawValue(), items: this.items(), updatedAt: new Date() }
      : { id: uuid(), ...this.form.getRawValue(), items: this.items(), updatedAt: new Date() };
    this.ref.close({ action: 'save', setlist });
  }
  remove() { this.ref.close({ action: 'delete' }); }
}

@Component({
  selector: 'setlists-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, ScreenHeaderComponent, MatDialogModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Setlists" [subtitle]="subtitle()"></screen-header>
      <div class="bandos-toolbar">
        <button mat-flat-button color="primary" (click)="newSetlist()">+ New setlist</button>
        @if (ws()) { <span class="bandos-pill">{{ ws()!.setlists.length }} saved</span> }
      </div>
      @if (setlists().length === 0) {
        <p class="bandos-muted">No setlists yet.</p>
      } @else {
        <div class="bandos-grid">
          @for (sl of setlists(); track sl.id) {
            <mat-card (click)="edit(sl)" style="cursor:pointer;">
              <h3>{{ sl.title }}</h3>
              <div class="meta">{{ sl.items.length }} songs · {{ totalLabel(sl) }}</div>
              @if (sl.notes) { <div class="notes">{{ sl.notes }}</div> }
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    h3 { margin: 0 0 6px; font-weight: 800; font-size: 16px; }
    .meta { color: #9D9DA7; font-size: 12px; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 8px; }
  `],
})
export class SetlistsComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  ws = computed(() => this.wsc.workspace());
  setlists = computed(() => this.ws()?.setlists ?? []);
  subtitle = computed(() => {
    const w = this.ws(); if (!w) return '';
    return M.wsIsFree(w) ? `Free plan · ${w.setlists.length} of ${M.wsMaxSetlists(w)} setlists` : `${w.setlists.length} setlists`;
  });

  totalLabel(sl: M.BandSetlist) { return M.setlistTotals(sl).totalLabel; }

  newSetlist() {
    const w = this.ws(); if (!w) return;
    if (!M.wsCanSaveSetlist(w)) { this.snack.open('Free plan setlist limit reached. Upgrade to Premium.', 'OK', { duration: 3000 }); return; }
    const ref = this.dialog.open(SetlistEditorDialog, { data: { songs: w.songs } });
    ref.afterClosed().subscribe(async r => { if (r?.action === 'save') await this.wsc.saveSetlist(r.setlist); });
  }
  edit(sl: M.BandSetlist) {
    const w = this.ws()!;
    const ref = this.dialog.open(SetlistEditorDialog, { data: { setlist: sl, songs: w.songs } });
    ref.afterClosed().subscribe(async r => {
      if (r?.action === 'save') await this.wsc.saveSetlist(r.setlist);
      else if (r?.action === 'delete') await this.wsc.deleteSetlist(sl.id);
    });
  }
}
