import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

/**
 * Reusable setlist editor form. Used inline in the desktop table (expanded row) and
 * wrapped by SetlistEditorDialog for the mobile popup.
 */
@Component({
  selector: 'setlist-editor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule],
  template: `
    <form [formGroup]="form" class="bandos-stack">
      <mat-form-field appearance="outline"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Notes</mat-label><textarea matInput rows="2" formControlName="notes"></textarea></mat-form-field>

      <div class="bandos-stack">
        <div class="bandos-row" style="justify-content:space-between;align-items:center;">
          <h3 class="bandos-section-title">Songs in order</h3>
          <button mat-stroked-button (click)="addItem()" type="button">+ Add</button>
        </div>
        @for (it of items(); track it.id; let i = $index) {
          <div class="item">
            <span class="ord">{{ i + 1 }}</span>
            <mat-form-field appearance="outline" style="flex:1;">
              <mat-label>Song</mat-label>
              <mat-select [value]="it.songId" (selectionChange)="updateItem(i, { songId: $event.value, songTitle: songTitleFor($event.value), songDuration: songDurationFor($event.value) })">
                @for (s of songs(); track s.id) { <mat-option [value]="s.id">{{ s.title }} ({{ s.duration }})</mat-option> }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline" style="width:120px;">
              <mat-label>Break (sec)</mat-label>
              <input matInput type="number" [value]="it.breakAfterSeconds" (input)="updateItem(i, { breakAfterSeconds: +$any($event.target).value })" />
            </mat-form-field>
            <button mat-icon-button (click)="removeItem(i)" type="button"><mat-icon>delete</mat-icon></button>
          </div>
        }
      </div>
      <div class="totals">Total: {{ totalsLabel() }} (break {{ breakLabel() }})</div>
    </form>
    <div class="form-actions">
      @if (existing()) { <button mat-button color="warn" style="margin-right: auto;" (click)="delete.emit()">Delete</button> }
      <button mat-button (click)="cancel.emit()">Cancel</button>
      <button mat-flat-button color="primary" (click)="trySave()">Save</button>
    </div>
  `,
  styles: [`
    .item { display: flex; gap: 8px; align-items: center; }
    .ord { width: 24px; text-align: center; color: #9D9DA7; font-weight: 700; }
    .totals { color: #C8A77B; font-weight: 700; }
    .form-actions { display: flex; gap: 8px; padding-top: 12px; align-items: center; }
  `],
})
export class SetlistEditorForm {
  setlist = input<M.BandSetlist | null>(null);
  songs = input<M.Song[]>([]);

  save = output<M.BandSetlist>();
  cancel = output<void>();
  delete = output<void>();

  existing = computed(() => !!this.setlist());

  private readonly fb = inject(FormBuilder);

  form = this.fb.nonNullable.group({
    title: ['New setlist', [Validators.required]],
    notes: [''],
  });

  items = signal<M.BandSetlistItem[]>([]);

  constructor() {
    // Reset form + items whenever the setlist input changes (e.g., when the same component
    // is reused for a different row, or when switching from "new" to "edit").
    effect(() => {
      const sl = this.setlist();
      this.form.reset({
        title: sl?.title ?? 'New setlist',
        notes: sl?.notes ?? '',
      });
      this.items.set(sl?.items.map(i => ({ ...i })) ?? []);
    }, { allowSignalWrites: true });
  }

  songTitleFor(id: string) { return this.songs().find(s => s.id === id)?.title ?? ''; }
  songDurationFor(id: string) { return this.songs().find(s => s.id === id)?.duration ?? '0:00'; }

  totals = computed(() => M.setlistTotals({
    id: 'tmp', title: '', notes: '', updatedAt: new Date(), items: this.items(),
  }));
  totalsLabel = computed(() => this.totals().totalLabel);
  breakLabel = computed(() => this.totals().breakLabel);

  addItem() {
    const first = this.songs()[0];
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
  trySave() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const sl = this.setlist();
    const next: M.BandSetlist = sl
      ? { ...sl, ...v, items: this.items(), updatedAt: new Date() }
      : { id: uuid(), ...v, items: this.items(), updatedAt: new Date() };
    this.save.emit(next);
  }
}

/**
 * Mobile popup wrapper around SetlistEditorForm.
 */
@Component({
  selector: 'setlist-editor-dialog',
  standalone: true,
  imports: [MatDialogModule, SetlistEditorForm],
  template: `
    <h2 mat-dialog-title>{{ data.setlist ? 'Edit setlist' : 'New setlist' }}</h2>
    <div mat-dialog-content style="min-width:500px;">
      <setlist-editor-form
        [setlist]="data.setlist ?? null"
        [songs]="data.songs"
        (save)="onSave($event)"
        (cancel)="ref.close()"
        (delete)="onDelete()" />
    </div>
  `,
})
export class SetlistEditorDialog {
  ref = inject(MatDialogRef<SetlistEditorDialog>);
  data: { setlist?: M.BandSetlist; songs: M.Song[] } = inject(MAT_DIALOG_DATA);

  onSave(setlist: M.BandSetlist) { this.ref.close({ action: 'save', setlist }); }
  onDelete() { this.ref.close({ action: 'delete' }); }
}

@Component({
  selector: 'setlists-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatTableModule, MatTooltipModule, ScreenHeaderComponent, MatDialogModule, SetlistEditorForm],
  template: `
    <div class="bandos-page">
      <screen-header title="Setlists" [subtitle]="subtitle()"></screen-header>
      <div class="bandos-toolbar">
        <button mat-flat-button color="primary" (click)="newSetlist()">+ New setlist</button>
        @if (ws()) { <span class="bandos-pill">{{ ws()!.setlists.length }} saved</span> }
      </div>

      <!-- Desktop: inline "create" form when isCreating -->
      @if (isCreating()) {
        <div class="inline-create setlists-desktop">
          <div class="inline-create-header">New setlist</div>
          <setlist-editor-form
            [songs]="ws()?.songs ?? []"
            (save)="onInlineSave($event)"
            (cancel)="cancelCreate()" />
        </div>
      }

      @if (setlists().length === 0 && !isCreating()) {
        <p class="bandos-muted">No setlists yet.</p>
      } @else if (setlists().length > 0) {
        <!-- Desktop: expandable table -->
        <div class="setlists-table-wrap setlists-desktop">
          <table mat-table [dataSource]="setlists()" multiTemplateDataRows class="setlists-table">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Title</th>
              <td mat-cell *matCellDef="let sl"><span class="setlist-title">{{ sl.title }}</span></td>
            </ng-container>

            <ng-container matColumnDef="count">
              <th mat-header-cell *matHeaderCellDef>Songs</th>
              <td mat-cell *matCellDef="let sl">{{ sl.items.length }}</td>
            </ng-container>

            <ng-container matColumnDef="total">
              <th mat-header-cell *matHeaderCellDef>Duration</th>
              <td mat-cell *matCellDef="let sl">{{ totalLabel(sl) }}</td>
            </ng-container>

            <ng-container matColumnDef="notes">
              <th mat-header-cell *matHeaderCellDef>Notes</th>
              <td mat-cell *matCellDef="let sl" class="notes-cell">{{ sl.notes || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-col">Actions</th>
              <td mat-cell *matCellDef="let sl" class="actions-col">
                <button mat-icon-button type="button" [matTooltip]="expandedId() === sl.id ? 'Collapse' : 'Edit'" (click)="toggleExpand(sl.id); $event.stopPropagation()">
                  <mat-icon>{{ expandedId() === sl.id ? 'expand_less' : 'edit' }}</mat-icon>
                </button>
                <button mat-icon-button type="button" color="warn" matTooltip="Delete" (click)="confirmDelete(sl); $event.stopPropagation()">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <ng-container matColumnDef="expanded">
              <td mat-cell *matCellDef="let sl" [attr.colspan]="displayedColumns.length" class="expanded-cell">
                @if (expandedId() === sl.id) {
                  <div class="expanded-form">
                    <setlist-editor-form
                      [setlist]="sl"
                      [songs]="ws()?.songs ?? []"
                      (save)="onInlineSave($event)"
                      (cancel)="collapseExpand()"
                      (delete)="onInlineDelete(sl)" />
                  </div>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="setlist-row" [class.is-expanded]="expandedId() === row.id"></tr>
            <tr mat-row *matRowDef="let row; columns: ['expanded']" class="expanded-row"></tr>
          </table>
        </div>

        <!-- Mobile: cards (clicks open dialog) -->
        <div class="bandos-grid setlists-mobile">
          @for (sl of setlists(); track sl.id) {
            <mat-card (click)="edit(sl)" class="setlist-card">
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
    .setlist-card { cursor: pointer; }

    .setlists-table-wrap { background: #1D1D23; border: 1px solid #2A2A31; border-radius: 12px; overflow: hidden; }
    .setlists-table { width: 100%; background: transparent; }
    .setlists-table th.mat-mdc-header-cell { background: #16161B; color: #9D9DA7; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .setlists-table td.mat-mdc-cell, .setlists-table th.mat-mdc-header-cell { border-bottom-color: #2A2A31; color: #E6E6EC; }
    .setlist-title { font-weight: 700; }
    .actions-col { width: 110px; text-align: right; white-space: nowrap; }
    .notes-cell { max-width: 360px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #9D9DA7; }
    .setlist-row.is-expanded td.mat-mdc-cell { background: #22222A; border-bottom-color: transparent; }
    .expanded-row td { padding: 0 !important; border-bottom-color: #2A2A31; }
    .expanded-cell { padding: 0 !important; }
    .expanded-form { padding: 16px 20px; background: #16161B; border-top: 1px solid #2A2A31; }

    .inline-create { background: #1D1D23; border: 1px solid #C8A77B; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; }
    .inline-create-header { color: #C8A77B; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 12px; }

    .setlists-mobile { display: none; }

    @media (max-width: 760px) {
      .setlists-desktop { display: none; }
      .setlists-mobile { display: grid; }
    }
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

  displayedColumns = ['title', 'count', 'total', 'notes', 'actions'];
  expandedId = signal<string | null>(null);
  isCreating = signal(false);

  totalLabel(sl: M.BandSetlist) { return M.setlistTotals(sl).totalLabel; }

  toggleExpand(id: string) {
    this.expandedId.update(curr => curr === id ? null : id);
  }
  collapseExpand() { this.expandedId.set(null); }
  cancelCreate() { this.isCreating.set(false); }

  newSetlist() {
    const w = this.ws(); if (!w) return;
    if (!M.wsCanSaveSetlist(w)) {
      this.snack.open('Free plan setlist limit reached. Upgrade to Premium.', 'OK', { duration: 3000 });
      return;
    }
    // On mobile use the popup; on desktop expand a new-row form inline.
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
    if (isMobile) {
      const ref = this.dialog.open(SetlistEditorDialog, { data: { songs: w.songs } });
      ref.afterClosed().subscribe(async r => {
        if (r?.action === 'save') await this.saveSetlistSafe(r.setlist, 'Setlist created.');
      });
    } else {
      this.expandedId.set(null);
      this.isCreating.set(true);
    }
  }

  /** Mobile-only: open dialog to edit. */
  edit(sl: M.BandSetlist) {
    const w = this.ws()!;
    const ref = this.dialog.open(SetlistEditorDialog, { data: { setlist: sl, songs: w.songs } });
    ref.afterClosed().subscribe(async r => {
      if (r?.action === 'save') await this.saveSetlistSafe(r.setlist, 'Setlist saved.');
      else if (r?.action === 'delete') await this.deleteSetlistSafe(sl.id, sl.title);
    });
  }

  /** Desktop inline save (from "+ New" inline form or expanded-row edit form). */
  async onInlineSave(setlist: M.BandSetlist) {
    const wasCreating = this.isCreating();
    this.isCreating.set(false);
    this.expandedId.set(null);
    await this.saveSetlistSafe(setlist, wasCreating ? 'Setlist created.' : 'Setlist saved.');
  }

  async onInlineDelete(sl: M.BandSetlist) {
    const ok = window.confirm(`Delete "${sl.title}"? This can't be undone.`);
    if (!ok) return;
    this.expandedId.set(null);
    await this.deleteSetlistSafe(sl.id, sl.title);
  }

  async confirmDelete(sl: M.BandSetlist) {
    const ok = window.confirm(`Delete "${sl.title}"? This can't be undone.`);
    if (!ok) return;
    if (this.expandedId() === sl.id) this.expandedId.set(null);
    await this.deleteSetlistSafe(sl.id, sl.title);
  }

  private async saveSetlistSafe(setlist: M.BandSetlist, successMsg: string) {
    try {
      await this.wsc.saveSetlist(setlist);
      this.snack.open(successMsg, 'OK', { duration: 1800 });
    } catch (err: any) {
      console.error('saveSetlist failed', err);
      this.snack.open(err?.message ?? 'Could not save setlist.', 'OK', { duration: 4000 });
    }
  }
  private async deleteSetlistSafe(id: string, _title: string) {
    try {
      await this.wsc.deleteSetlist(id);
      this.snack.open('Setlist deleted.', 'OK', { duration: 1800 });
    } catch (err: any) {
      console.error('deleteSetlist failed', err);
      this.snack.open(err?.message ?? 'Could not delete setlist.', 'OK', { duration: 4000 });
    }
  }
}
