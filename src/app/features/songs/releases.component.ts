import { Component, computed, inject, signal, HostListener, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'release-editor-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <form [formGroup]="form" class="bandos-stack">
      <mat-form-field appearance="outline"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Type</mat-label>
        <mat-select formControlName="type">
          @for (t of types; track t) { <mat-option [value]="t">{{ typeLabel(t) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Release date</mat-label><input matInput type="date" formControlName="releaseDate" /></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Notes</mat-label><textarea matInput rows="3" formControlName="notes"></textarea></mat-form-field>
    </form>
    <div class="panel-form-actions">
      @if (item) { <button mat-button color="warn" style="margin-right: auto;" (click)="onDelete()">Delete</button> }
      <button mat-button (click)="cancel.emit()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
  styles: [`
    .panel-form-actions { display: flex; align-items: center; justify-content: flex-end; gap: 8px; margin-top: 24px; }
  `],
})
export class ReleaseEditorForm implements OnChanges {
  private readonly fb = inject(FormBuilder);

  @Input() item: M.SongRelease | null = null;
  @Output() done = new EventEmitter<{ action: string; release?: M.SongRelease }>();
  @Output() cancel = new EventEmitter<void>();
  @Output() deleteItem = new EventEmitter<void>();

  types = Object.values(M.SongReleaseType);
  typeLabel(t: M.SongReleaseType) { return M.SongReleaseTypeLabel[t]; }

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    type: [M.SongReleaseType.single],
    releaseDate: [''],
    notes: [''],
  });

  ngOnChanges() {
    this.form.patchValue({
      title: this.item?.title ?? '',
      type: this.item?.type ?? M.SongReleaseType.single,
      releaseDate: this.item?.releaseDate?.toISOString().substring(0, 10) ?? '',
      notes: this.item?.notes ?? '',
    });
  }

  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const release: M.SongRelease = this.item
      ? { ...this.item, ...v, releaseDate: v.releaseDate ? new Date(v.releaseDate) : null, updatedAt: new Date() }
      : { id: uuid(), title: v.title, type: v.type, releaseDate: v.releaseDate ? new Date(v.releaseDate) : null, notes: v.notes, updatedAt: new Date() };
    this.done.emit({ action: 'save', release });
  }

  onDelete() {
    this.deleteItem.emit();
  }
}

@Component({
  selector: 'releases-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, ScreenHeaderComponent, ReleaseEditorForm],
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
              <mat-card (click)="openPanel(r)" style="cursor:pointer;">
                <h3>{{ r.title }}</h3>
                <div class="meta">{{ typeLabel(r.type) }} @if (r.releaseDate) { · {{ r.releaseDate | date:'mediumDate' }} }</div>
                @if (r.notes) { <div class="notes">{{ r.notes }}</div> }
              </mat-card>
            }
          </div>
        }
      }

      <!-- Backdrop -->
      <div class="panel-backdrop" [class.visible]="panelOpen()" (click)="closePanel()"></div>
      <!-- Side panel -->
      <aside class="editor-panel" [class.open]="panelOpen()">
        <div class="panel-header">
          <div class="panel-header-text">
            <span class="panel-label">{{ panelItem() ? 'Edit release' : 'New release' }}</span>
            @if (panelItem()?.title) {
              <span class="panel-title">{{ panelItem()!.title }}</span>
            }
          </div>
          <button mat-icon-button (click)="closePanel()"><mat-icon>close</mat-icon></button>
        </div>
        <div class="panel-body">
          @if (panelOpen()) {
            <release-editor-form
              [item]="panelItem()"
              (done)="onDone($event)"
              (cancel)="closePanel()"
              (deleteItem)="onDelete()" />
          }
        </div>
      </aside>
    </div>
  `,
  styles: [`
    h3 { font-weight: 800; margin: 0 0 6px; }
    .meta { color: #9D9DA7; font-size: 12px; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 8px; }

    /* ── Side panel ── */
    .panel-backdrop { position: fixed; inset: 0; z-index: 200; background: transparent; pointer-events: none; transition: background 0.25s ease; }
    .panel-backdrop.visible { background: rgba(0,0,0,0.55); pointer-events: all; }
    .editor-panel { position: fixed; top: 0; right: 0; bottom: 0; width: 460px; z-index: 201; background: #17171B; border-left: 1px solid #2A2A31; display: flex; flex-direction: column; transform: translateX(100%); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow: -12px 0 40px rgba(0,0,0,0.6); }
    .editor-panel.open { transform: translateX(0); }
    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 14px; border-bottom: 1px solid #2A2A31; flex-shrink: 0; }
    .panel-header-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .panel-label { font-size: 11px; font-weight: 700; color: #9D9DA7; text-transform: uppercase; letter-spacing: 0.06em; }
    .panel-title { font-size: 17px; font-weight: 800; color: #F6F1E8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .panel-body { flex: 1; overflow-y: auto; padding: 20px; }
    @media (max-width: 760px) { .editor-panel { width: 100%; } }
  `],
})
export class ReleasesComponent {
  private readonly wsc = inject(WorkspaceController);
  releases = computed(() => this.wsc.workspace()?.releases ?? []);
  locked = computed(() => { const w = this.wsc.workspace(); return w ? !M.wsSupportsReleases(w) : false; });
  subtitle = computed(() => this.wsc.workspace()?.bandName ?? '');
  typeLabel(t: M.SongReleaseType) { return M.SongReleaseTypeLabel[t]; }

  panelOpen = signal(false);
  panelItem = signal<M.SongRelease | null>(null);

  openPanel(item: M.SongRelease | null) { this.panelItem.set(item); this.panelOpen.set(true); }
  closePanel() { this.panelOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.panelOpen()) this.closePanel(); }

  newRelease() { this.openPanel(null); }
  edit(r: M.SongRelease) { this.openPanel(r); }

  async onDone(result: { action: string; release?: M.SongRelease }) {
    if (result?.action === 'save' && result.release) {
      await this.wsc.saveRelease(result.release);
      this.closePanel();
    }
  }

  async onDelete() {
    const item = this.panelItem();
    if (item) {
      await this.wsc.deleteRelease(item.id);
      this.closePanel();
    }
  }
}
