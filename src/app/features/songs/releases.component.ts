import { Component, computed, inject } from '@angular/core';
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
  selector: 'release-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit release' : 'New release' }}</h2>
    <form mat-dialog-content [formGroup]="form" class="bandos-stack" style="min-width:420px;">
      <mat-form-field appearance="fill"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <mat-form-field appearance="fill">
        <mat-label>Type</mat-label>
        <mat-select formControlName="type">
          @for (t of types; track t) { <mat-option [value]="t">{{ typeLabel(t) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Release date</mat-label><input matInput type="date" formControlName="releaseDate" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Notes</mat-label><textarea matInput rows="3" formControlName="notes"></textarea></mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      @if (existing) { <button mat-button color="warn" (click)="ref.close({ action: 'delete' })">Delete</button> }
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
})
export class ReleaseEditorDialog {
  ref = inject(MatDialogRef<ReleaseEditorDialog>);
  private readonly fb = inject(FormBuilder);
  data: { release?: M.SongRelease } = inject<{ release?: M.SongRelease }>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  existing = !!this.data.release;
  types = Object.values(M.SongReleaseType);
  typeLabel(t: M.SongReleaseType) { return M.SongReleaseTypeLabel[t]; }

  form = this.fb.nonNullable.group({
    title: [this.data.release?.title ?? '', [Validators.required]],
    type: [this.data.release?.type ?? M.SongReleaseType.single],
    releaseDate: [this.data.release?.releaseDate?.toISOString().substring(0, 10) ?? ''],
    notes: [this.data.release?.notes ?? ''],
  });
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const release: M.SongRelease = this.data.release
      ? { ...this.data.release, ...v, releaseDate: v.releaseDate ? new Date(v.releaseDate) : null, updatedAt: new Date() }
      : { id: uuid(), title: v.title, type: v.type, releaseDate: v.releaseDate ? new Date(v.releaseDate) : null, notes: v.notes, updatedAt: new Date() };
    this.ref.close({ action: 'save', release });
  }
}

@Component({
  selector: 'releases-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, ScreenHeaderComponent, MatDialogModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Releases" [subtitle]="subtitle()"></screen-header>
      @if (locked()) {
        <div class="bandos-card" style="border-color:#C8A77B;">
          <h3 style="margin:0 0 6px;">Premium feature</h3>
          <p class="bandos-muted">Releases are available on the Premium plan.</p>
        </div>
      } @else {
        <div class="bandos-toolbar"><button mat-flat-button color="primary" (click)="newRelease()">+ New release</button></div>
        @if (releases().length === 0) {
          <p class="bandos-muted">No releases planned yet.</p>
        } @else {
          <div class="bandos-grid">
            @for (r of releases(); track r.id) {
              <mat-card (click)="edit(r)" style="cursor:pointer;">
                <h3>{{ r.title }}</h3>
                <div class="meta">{{ typeLabel(r.type) }} @if (r.releaseDate) { · {{ r.releaseDate | date:'mediumDate' }} }</div>
                @if (r.notes) { <div class="notes">{{ r.notes }}</div> }
              </mat-card>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    h3 { font-weight: 800; margin: 0 0 6px; }
    .meta { color: #9D9DA7; font-size: 12px; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 8px; }
  `],
})
export class ReleasesComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);
  releases = computed(() => this.wsc.workspace()?.releases ?? []);
  locked = computed(() => { const w = this.wsc.workspace(); return w ? !M.wsSupportsReleases(w) : false; });
  subtitle = computed(() => this.wsc.workspace()?.bandName ?? '');
  typeLabel(t: M.SongReleaseType) { return M.SongReleaseTypeLabel[t]; }
  newRelease() {
    const ref = this.dialog.open(ReleaseEditorDialog, { data: {} });
    ref.afterClosed().subscribe(async r => { if (r?.action === 'save') await this.wsc.saveRelease(r.release); });
  }
  edit(r: M.SongRelease) {
    const ref = this.dialog.open(ReleaseEditorDialog, { data: { release: r } });
    ref.afterClosed().subscribe(async result => {
      if (result?.action === 'save') await this.wsc.saveRelease(result.release);
      else if (result?.action === 'delete') await this.wsc.deleteRelease(r.id);
    });
  }
}
