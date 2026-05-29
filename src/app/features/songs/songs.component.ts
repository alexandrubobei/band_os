import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'aac'];
const AUDIO_MAX_BYTES = 25 * 1024 * 1024;

const COMMON_TIME_SIGNATURES = [
  '4/4', '3/4', '2/4', '2/2',
  '6/8', '9/8', '12/8',
  '5/4', '7/4', '5/8', '7/8', '6/4',
];

const COMMON_TUNINGS = [
  'E standard',
  'Eb standard',
  'D standard',
  'C# standard',
  'C standard',
  'B standard (7-string)',
  'Drop D',
  'Drop C#',
  'Drop C',
  'Drop B',
  'Drop A',
  'DADGAD',
  'Open G',
  'Open D',
  'Open E',
];

interface SongEditorData {
  song?: M.Song;
  releases: M.SongRelease[];
  canEdit: boolean;
}

interface PendingAudio {
  file: File;
  bytes: ArrayBuffer;
  sizeBytes: number;
}

function formatAudioSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  return idx >= 0 ? name.substring(idx + 1).toLowerCase() : '';
}

/**
 * Reusable song editor form. Used inline in the desktop table (expanded row) and
 * wrapped by SongEditorDialog for the mobile popup.
 */
@Component({
  selector: 'song-editor-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatIconModule, MatProgressSpinnerModule, DecimalPipe,
  ],
  template: `
    <form [formGroup]="form" class="bandos-stack">
      <mat-form-field appearance="outline"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <div class="bandos-row">
        <mat-form-field appearance="outline" style="flex:1;">
          <mat-label>Tuning</mat-label>
          <mat-select formControlName="tuning">
            @for (t of tuningOptions(); track t) { <mat-option [value]="t">{{ t }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline" style="flex:1;"><mat-label>BPM</mat-label><input matInput type="number" formControlName="bpm" /></mat-form-field>
      </div>
      <div class="bandos-row">
        <div class="duration-picker" style="flex:1;">
          <mat-form-field appearance="outline" style="flex:1;">
            <mat-label>Min</mat-label>
            <mat-select [value]="durationMins()" (selectionChange)="setDurationMins($event.value)">
              @for (m of minuteOptions; track m) { <mat-option [value]="m">{{ m }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <span class="duration-colon">:</span>
          <mat-form-field appearance="outline" style="flex:1;">
            <mat-label>Sec</mat-label>
            <mat-select [value]="durationSecs()" (selectionChange)="setDurationSecs($event.value)">
              @for (s of secondOptions; track s) { <mat-option [value]="s">{{ s | number:'2.0' }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline" style="flex:1;">
          <mat-label>Time signature</mat-label>
          <mat-select formControlName="timeSignature">
            @for (t of timeSigOptions(); track t) { <mat-option [value]="t">{{ t }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>
      <mat-form-field appearance="outline">
        <mat-label>Status</mat-label>
        <mat-select formControlName="status">
          @for (s of statuses; track s) { <mat-option [value]="s">{{ statusLabel(s) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      @if (showReleaseField()) {
        <mat-form-field appearance="outline">
          <mat-label>Release</mat-label>
          <mat-select formControlName="releaseId">
            <mat-option [value]="null">None</mat-option>
            @for (r of releases(); track r.id) { <mat-option [value]="r.id">{{ r.title }}</mat-option> }
          </mat-select>
        </mat-form-field>
      }
      <mat-form-field appearance="outline"><mat-label>Lyrics</mat-label><textarea matInput rows="4" formControlName="lyrics"></textarea></mat-form-field>
      <mat-form-field appearance="outline"><mat-label>Notes</mat-label><textarea matInput rows="3" formControlName="notes"></textarea></mat-form-field>
      <mat-form-field appearance="outline">
        <mat-label>Attachment label</mat-label>
        <input matInput formControlName="attachmentLabel" />
        <mat-hint>Free-text label that shows up on the song card (e.g. "Demo mix").</mat-hint>
      </mat-form-field>

      <div class="audio-section">
        <h3>Audio</h3>
        @if (existingAudioUrl()) {
          <div class="audio-current">
            <div class="audio-info">
              <mat-icon>music_note</mat-icon>
              <div>
                <div class="audio-name">{{ song()?.audioFileName || 'Attached audio' }}</div>
                @if (song()?.audioSizeBytes) {
                  <div class="audio-meta">{{ formatSize(song()!.audioSizeBytes!) }}</div>
                }
              </div>
            </div>
            <audio controls [src]="existingAudioUrl()!" preload="metadata" style="width:100%;margin-top:8px;"></audio>
          </div>
        } @else if (!pendingAudio()) {
          <p class="audio-hint">Optional. Attach one MP3, M4A, WAV, or AAC file (max 25 MB).</p>
        }
        @if (pendingAudio(); as p) {
          <div class="audio-current">
            <div class="audio-info">
              <mat-icon>music_note</mat-icon>
              <div>
                <div class="audio-name">{{ p.file.name }}</div>
                <div class="audio-meta">{{ formatSize(p.sizeBytes) }} · ready to upload on save</div>
              </div>
            </div>
          </div>
        }
        @if (audioError()) { <div style="color:#E8B246;font-size:13px;">{{ audioError() }}</div> }
        <div class="audio-actions">
          <input #fileInput type="file" [accept]="acceptAudio" hidden (change)="onFilePicked($any($event.target).files)" (cancel)="$event.stopPropagation()" />
          @if (canManageAudio()) {
            <button type="button" mat-stroked-button (click)="fileInput.click()" [disabled]="uploading()">
              <mat-icon>{{ existingAudioUrl() || pendingAudio() ? 'swap_horiz' : 'audio_file' }}</mat-icon>
              {{ existingAudioUrl() || pendingAudio() ? 'Change audio' : 'Attach audio' }}
            </button>
            @if (existingAudioUrl()) {
              <button type="button" mat-stroked-button color="warn" (click)="clearExistingAudio()" [disabled]="uploading()">
                <mat-icon>delete_outline</mat-icon> Remove audio
              </button>
            } @else if (pendingAudio()) {
              <button type="button" mat-stroked-button (click)="clearPendingAudio()" [disabled]="uploading()">
                <mat-icon>close</mat-icon> Clear selection
              </button>
            }
          }
          @if (uploading()) { <mat-spinner diameter="20"></mat-spinner> }
        </div>
        @if (!supportsAudioUpload()) {
          <p class="audio-hint">Audio upload requires Firebase mode. Local mode stores songs without audio files.</p>
        }
      </div>
    </form>
    <div class="form-actions">
      @if (existing()) {
        <button mat-button color="warn" style="margin-right: auto;" (click)="tryDelete()" [disabled]="uploading()">Delete</button>
      }
      <button mat-button (click)="cancel.emit()" [disabled]="uploading()">Cancel</button>
      <button mat-flat-button color="primary" (click)="trySave()" [disabled]="uploading()">
        @if (uploading()) { Saving… } @else { Save }
      </button>
    </div>
  `,
  styles: [`
    .duration-picker { display: flex; align-items: center; gap: 4px; }
    .duration-colon { color: #9D9DA7; font-size: 18px; font-weight: 700; padding-bottom: 18px; flex-shrink: 0; }
    .audio-section { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
    .audio-section h3 { margin: 0; font-size: 15px; font-weight: 700; }
    .audio-hint { margin: 0; color: #9D9DA7; font-size: 13px; }
    .audio-current { background: #1D1D23; border: 1px solid #2A2A31; border-radius: 10px; padding: 12px; }
    .audio-info { display: flex; gap: 12px; align-items: center; }
    .audio-info mat-icon { color: #C8A77B; }
    .audio-name { font-weight: 700; word-break: break-all; }
    .audio-meta { font-size: 12px; color: #9D9DA7; }
    .audio-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .form-actions { display: flex; gap: 8px; padding-top: 12px; align-items: center; }
  `],
})
export class SongEditorForm {
  song = input<M.Song | null>(null);
  releases = input<M.SongRelease[]>([]);
  canEdit = input<boolean>(true);

  done = output<void>();
  cancel = output<void>();

  private readonly fb = inject(FormBuilder);
  private readonly ws = inject(WorkspaceController);
  private readonly snack = inject(MatSnackBar);

  statuses = Object.values(M.SongStatus);
  acceptAudio = ALLOWED_AUDIO_EXTENSIONS.map(e => `.${e}`).join(',') + ',audio/*';

  existing = computed(() => !!this.song());
  showReleaseField = computed(() => this.releases().length > 0 || !!this.song()?.releaseId);
  supportsAudioUpload = computed(() => this.ws.supportsSongAudioUpload);
  canManageAudio = computed(() => this.canEdit() && this.supportsAudioUpload());
  /** Common presets, plus the song's current value if it's something custom (preserves old data). */
  tuningOptions = computed(() => {
    const current = this.song()?.tuning?.trim();
    if (current && !COMMON_TUNINGS.includes(current)) return [current, ...COMMON_TUNINGS];
    return COMMON_TUNINGS;
  });
  timeSigOptions = computed(() => {
    const current = this.song()?.timeSignature?.trim();
    if (current && !COMMON_TIME_SIGNATURES.includes(current)) return [current, ...COMMON_TIME_SIGNATURES];
    return COMMON_TIME_SIGNATURES;
  });

  readonly minuteOptions = Array.from({ length: 31 }, (_, i) => i);   // 0–30
  readonly secondOptions = Array.from({ length: 60 }, (_, i) => i);   // 0–59

  private _parseDuration(d: string): { m: number; s: number } {
    const match = d?.match(/^(\d+):(\d{2})$/);
    return match ? { m: +match[1], s: +match[2] } : { m: 3, s: 0 };
  }
  private readonly _initDur = this._parseDuration(this.song()?.duration ?? '3:00');
  durationMins = signal(this._initDur.m);
  durationSecs = signal(this._initDur.s);

  setDurationMins(m: number) {
    this.durationMins.set(m);
    this.form.patchValue({ duration: `${m}:${String(this.durationSecs()).padStart(2, '0')}` });
  }
  setDurationSecs(s: number) {
    this.durationSecs.set(s);
    this.form.patchValue({ duration: `${this.durationMins()}:${String(s).padStart(2, '0')}` });
  }

  existingAudioUrl = signal<string | null>(null);
  pendingAudio = signal<PendingAudio | null>(null);
  audioError = signal<string | null>(null);
  uploading = signal(false);

  form = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    tuning: ['E standard'],
    bpm: [120, [Validators.required, Validators.min(20)]],
    duration: ['3:00', [Validators.required]],
    timeSignature: ['4/4'],
    status: [M.SongStatus.idea],
    releaseId: [null as string | null],
    notes: [''],
    lyrics: [''],
    attachmentLabel: [''],
  });

  constructor() {
    // Reset form + audio state when the song input changes (e.g., reused for a
    // different row, or switching from "new" to "edit").
    effect(() => {
      const s = this.song();
      this.form.reset({
        title: s?.title ?? '',
        tuning: s?.tuning ?? 'E standard',
        bpm: s?.bpm ?? 120,
        duration: s?.duration ?? '3:00',
        timeSignature: s?.timeSignature ?? '4/4',
        status: s?.status ?? M.SongStatus.idea,
        releaseId: s?.releaseId ?? null,
        notes: s?.notes ?? '',
        lyrics: s?.lyrics ?? '',
        attachmentLabel: s?.attachmentLabel ?? '',
      });
      this.existingAudioUrl.set(s?.audioUrl ?? null);
      this.pendingAudio.set(null);
      this.audioError.set(null);
    }, { allowSignalWrites: true });
  }

  statusLabel(s: M.SongStatus) { return M.SongStatusLabel[s]; }
  formatSize(b: number) { return formatAudioSize(b); }

  async onFilePicked(files: FileList | null) {
    this.audioError.set(null);
    if (!files || files.length === 0) return;
    const file = files[0];
    const ext = fileExtension(file.name);
    if (!ALLOWED_AUDIO_EXTENSIONS.includes(ext)) {
      this.audioError.set('Unsupported audio format. Use MP3, M4A, WAV, or AAC.');
      return;
    }
    if (file.size >= AUDIO_MAX_BYTES) {
      this.audioError.set('Audio file must be under 25 MB.');
      return;
    }
    const bytes = await file.arrayBuffer();
    this.pendingAudio.set({ file, bytes, sizeBytes: file.size });
  }

  clearPendingAudio() {
    this.pendingAudio.set(null);
    this.audioError.set(null);
  }

  async clearExistingAudio() {
    const s = this.song();
    if (!s) return;
    this.uploading.set(true);
    try {
      await this.ws.clearSongAudio(s);
      this.existingAudioUrl.set(null);
      this.snack.open('Audio removed.', 'OK', { duration: 1800 });
    } catch (err: any) {
      this.snack.open(err?.message ?? 'Could not remove audio.', 'OK', { duration: 3000 });
    } finally {
      this.uploading.set(false);
    }
  }

  async trySave() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const s = this.song();
    const baseSong: M.Song = s ? {
      ...s,
      title: v.title, tuning: v.tuning, bpm: Number(v.bpm), duration: v.duration,
      timeSignature: v.timeSignature, status: v.status, releaseId: v.releaseId,
      lyrics: v.lyrics, notes: v.notes,
      attachmentLabel: v.attachmentLabel.trim() ? v.attachmentLabel.trim() : null,
      updatedAt: new Date(),
    } : {
      id: uuid(), title: v.title, tuning: v.tuning, bpm: Number(v.bpm), duration: v.duration,
      timeSignature: v.timeSignature, sortOrder: 0, status: v.status, releaseId: v.releaseId,
      lyrics: v.lyrics, notes: v.notes,
      attachmentLabel: v.attachmentLabel.trim() ? v.attachmentLabel.trim() : null,
      updatedAt: new Date(),
    };

    this.uploading.set(true);
    try {
      await this.ws.saveSong(baseSong);
      const pending = this.pendingAudio();
      if (pending) {
        try {
          await this.ws.updateSongAudio(baseSong, pending.bytes, pending.file.name);
          this.snack.open('Song saved with audio.', 'OK', { duration: 1800 });
        } catch (audioErr: any) {
          this.snack.open(audioErr?.message ?? 'Saved, but audio upload failed.', 'OK', { duration: 4000 });
        }
      } else {
        this.snack.open('Song saved.', 'OK', { duration: 1800 });
      }
      this.done.emit();
    } catch (err: any) {
      this.snack.open(err?.message ?? 'Could not save song.', 'OK', { duration: 4000 });
    } finally {
      this.uploading.set(false);
    }
  }

  async tryDelete() {
    const s = this.song();
    if (!s) return;
    const ok = window.confirm(`Delete "${s.title}"? This can't be undone.`);
    if (!ok) return;
    try {
      await this.ws.deleteSong(s.id);
      this.snack.open('Song deleted.', 'OK', { duration: 1800 });
      this.done.emit();
    } catch (err: any) {
      this.snack.open(err?.message ?? 'Could not delete song.', 'OK', { duration: 4000 });
    }
  }
}

/**
 * Mobile popup wrapper around SongEditorForm.
 */
@Component({
  selector: 'song-editor-dialog',
  standalone: true,
  imports: [MatDialogModule, SongEditorForm],
  template: `
    <h2 mat-dialog-title>{{ data.song ? 'Edit song' : 'New song' }}</h2>
    <div mat-dialog-content style="min-width:460px;max-height:75vh;">
      <song-editor-form
        [song]="data.song ?? null"
        [releases]="data.releases"
        [canEdit]="data.canEdit"
        (done)="ref.close({ action: 'done' })"
        (cancel)="ref.close()" />
    </div>
  `,
})
export class SongEditorDialog {
  ref = inject(MatDialogRef<SongEditorDialog>);
  data: SongEditorData = inject<SongEditorData>(MAT_DIALOG_DATA);
}

@Component({
  selector: 'songs-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatFormFieldModule, MatInputModule, MatChipsModule, MatTableModule, MatTooltipModule, ScreenHeaderComponent, MatDialogModule, SongEditorForm],
  template: `
    <div class="bandos-page">
      <screen-header title="Songs" [subtitle]="subtitle()"></screen-header>
      <div class="bandos-toolbar">
        <mat-form-field appearance="outline" style="flex:1;max-width:360px;">
          <mat-label>Search</mat-label>
          <input matInput [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Title, tuning, or notes…" />
        </mat-form-field>
      </div>
      <div class="new-song-row">
        <button mat-flat-button color="primary" (click)="newSong()">+ New song</button>
      </div>

      <!-- Desktop: inline "create" form when isCreating -->
      @if (isCreating()) {
        <div class="inline-create songs-desktop">
          <div class="inline-create-header">New song</div>
          <song-editor-form
            [releases]="releases()"
            [canEdit]="canEdit()"
            (done)="cancelCreate()"
            (cancel)="cancelCreate()" />
        </div>
      }

      @if (filtered().length === 0 && !isCreating()) {
        <p class="bandos-muted">No songs yet. Click "+ New song" to add the first one.</p>
      } @else if (filtered().length > 0) {
        <div class="songs-table-wrap songs-desktop">
          <table mat-table [dataSource]="filtered()" multiTemplateDataRows class="songs-table">
            <ng-container matColumnDef="title">
              <th mat-header-cell *matHeaderCellDef>Title</th>
              <td mat-cell *matCellDef="let song">
                <div class="title-cell">
                  <span class="song-title">{{ song.title }}</span>
                  @if (song.audioUrl) {
                    <mat-icon class="audio-icon" matTooltip="Has audio">music_note</mat-icon>
                  }
                </div>
                @if (song.attachmentLabel) {
                  <div class="attachment-label">{{ song.attachmentLabel }}</div>
                }
              </td>
            </ng-container>

            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let song">
                <span class="bandos-pill">{{ statusLabel(song.status) }}</span>
              </td>
            </ng-container>

            <ng-container matColumnDef="tuning">
              <th mat-header-cell *matHeaderCellDef>Tuning</th>
              <td mat-cell *matCellDef="let song">{{ song.tuning }}</td>
            </ng-container>

            <ng-container matColumnDef="bpm">
              <th mat-header-cell *matHeaderCellDef>BPM</th>
              <td mat-cell *matCellDef="let song">{{ song.bpm }}</td>
            </ng-container>

            <ng-container matColumnDef="duration">
              <th mat-header-cell *matHeaderCellDef>Duration</th>
              <td mat-cell *matCellDef="let song">{{ song.duration }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-col">Actions</th>
              <td mat-cell *matCellDef="let song" class="actions-col">
                <button
                  mat-icon-button
                  type="button"
                  [matTooltip]="expandedId() === song.id ? 'Collapse' : 'Edit'"
                  [disabled]="!canEdit()"
                  (click)="toggleExpand(song.id); $event.stopPropagation()">
                  <mat-icon>{{ expandedId() === song.id ? 'expand_less' : 'edit' }}</mat-icon>
                </button>
                <button
                  mat-icon-button
                  type="button"
                  color="warn"
                  matTooltip="Delete"
                  [disabled]="!canEdit()"
                  (click)="confirmDelete(song); $event.stopPropagation()">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <ng-container matColumnDef="expanded">
              <td mat-cell *matCellDef="let song" [attr.colspan]="displayedColumns.length" class="expanded-cell">
                @if (expandedId() === song.id) {
                  <div class="expanded-form">
                    <song-editor-form
                      [song]="song"
                      [releases]="releases()"
                      [canEdit]="canEdit()"
                      (done)="collapseExpand()"
                      (cancel)="collapseExpand()" />
                  </div>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="song-row" [class.is-expanded]="expandedId() === row.id" [attr.data-status]="row.status" (click)="toggleExpand(row.id)"></tr>
            <tr mat-row *matRowDef="let row; columns: ['expanded']" class="expanded-row" [class.is-collapsed]="expandedId() !== row.id" [attr.data-status]="row.status"></tr>
          </table>
        </div>

        <div class="songs-mobile">
          @for (song of filtered(); track song.id) {
            <div class="song-card" [attr.data-status]="song.status" (click)="editInDialog(song)">
              <div class="song-card-header">
                <div class="title-cell">
                  <span class="song-title">{{ song.title }}</span>
                  @if (song.audioUrl) {
                    <mat-icon class="audio-icon" matTooltip="Has audio">music_note</mat-icon>
                  }
                </div>
                <div class="song-card-actions">
                  <button
                    mat-icon-button
                    type="button"
                    matTooltip="Edit"
                    [disabled]="!canEdit()"
                    (click)="editInDialog(song); $event.stopPropagation()">
                    <mat-icon>edit</mat-icon>
                  </button>
                  <button
                    mat-icon-button
                    type="button"
                    color="warn"
                    matTooltip="Delete"
                    [disabled]="!canEdit()"
                    (click)="confirmDelete(song); $event.stopPropagation()">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              </div>
              @if (song.attachmentLabel) {
                <div class="attachment-label">{{ song.attachmentLabel }}</div>
              }
              <div class="song-card-meta">
                <span class="bandos-pill">{{ statusLabel(song.status) }}</span>
                <span class="meta-sep">·</span>
                <span>{{ song.tuning }}</span>
                <span class="meta-sep">·</span>
                <span>{{ song.bpm }} BPM</span>
                <span class="meta-sep">·</span>
                <span>{{ song.duration }}</span>
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .new-song-row { display: flex; justify-content: flex-start; margin-bottom: 12px; }
    .songs-table-wrap { background: #1D1D23; border: 1px solid #2A2A31; border-radius: 12px; overflow: hidden; }
    .songs-table { width: 100%; background: transparent; }
    .songs-table th.mat-mdc-header-cell { background: #16161B; color: #9D9DA7; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .songs-table td.mat-mdc-cell, .songs-table th.mat-mdc-header-cell { border-bottom-color: #2A2A31; color: #E6E6EC; }
    .song-row { cursor: pointer; }
    .song-row:hover td.mat-mdc-cell { background: #22222A; }
    .song-row.is-expanded td.mat-mdc-cell { background: #22222A; border-bottom-color: transparent; }
    .expanded-row td { padding: 0 !important; border-bottom-color: #2A2A31; }
    .expanded-row.is-collapsed { display: none; }
    .expanded-cell { padding: 0 !important; }
    .expanded-form { padding: 16px 20px; background: #16161B; border-top: 1px solid #2A2A31; }
    .title-cell { display: flex; align-items: center; gap: 8px; }
    .song-title { font-weight: 700; }
    .audio-icon { font-size: 16px; width: 16px; height: 16px; color: #C8A77B; }
    .attachment-label { color: #C8A77B; font-size: 12px; margin-top: 4px; font-weight: 600; }
    .actions-col { width: 110px; text-align: right; white-space: nowrap; }

    .inline-create { background: #1D1D23; border: 1px solid #C8A77B; border-radius: 12px; padding: 16px 20px; margin-bottom: 16px; }
    .inline-create-header { color: #C8A77B; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 12px; }

    .songs-mobile { display: none; flex-direction: column; gap: 10px; }
    .song-card { background: #1D1D23; border: 1px solid #2A2A31; border-radius: 12px; padding: 12px 14px; cursor: pointer; display: flex; flex-direction: column; gap: 8px; }
    .song-card:hover { background: #22222A; }
    .song-card-header { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .song-card-actions { display: flex; gap: 4px; flex-shrink: 0; }
    .song-card-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; color: #9D9DA7; font-size: 13px; }
    .meta-sep { color: #4A4A55; }

    /* ── Status accent colours ──────────────────────────────────────── */
    /* Left-border stripe on desktop data rows + expanded form rows */
    .song-row[data-status="idea"]           td.mat-mdc-cell:first-child,
    .expanded-row[data-status="idea"]       td.mat-mdc-cell { box-shadow: inset 3px 0 0 #A78BFA; }
    .song-row[data-status="demo"]           td.mat-mdc-cell:first-child,
    .expanded-row[data-status="demo"]       td.mat-mdc-cell { box-shadow: inset 3px 0 0 #60A5FA; }
    .song-row[data-status="mixMaster"]      td.mat-mdc-cell:first-child,
    .expanded-row[data-status="mixMaster"]  td.mat-mdc-cell { box-shadow: inset 3px 0 0 #FB923C; }
    .song-row[data-status="releaseReady"]   td.mat-mdc-cell:first-child,
    .expanded-row[data-status="releaseReady"] td.mat-mdc-cell { box-shadow: inset 3px 0 0 #FBBF24; }
    .song-row[data-status="rehearsalReady"] td.mat-mdc-cell:first-child,
    .expanded-row[data-status="rehearsalReady"] td.mat-mdc-cell { box-shadow: inset 3px 0 0 #34D399; }
    .song-row[data-status="liveReady"]      td.mat-mdc-cell:first-child,
    .expanded-row[data-status="liveReady"]  td.mat-mdc-cell { box-shadow: inset 3px 0 0 #4ADE80; }
    .song-row[data-status="released"]       td.mat-mdc-cell:first-child,
    .expanded-row[data-status="released"]   td.mat-mdc-cell { box-shadow: inset 3px 0 0 #22C55E; }

    /* Status pill — desktop table + mobile card */
    .song-row[data-status="idea"] .bandos-pill,           .song-card[data-status="idea"] .bandos-pill           { color:#A78BFA; border-color:rgba(167,139,250,.3); background:rgba(167,139,250,.1); }
    .song-row[data-status="demo"] .bandos-pill,           .song-card[data-status="demo"] .bandos-pill           { color:#60A5FA; border-color:rgba(96,165,250,.3);   background:rgba(96,165,250,.1); }
    .song-row[data-status="mixMaster"] .bandos-pill,      .song-card[data-status="mixMaster"] .bandos-pill      { color:#FB923C; border-color:rgba(251,146,60,.3);   background:rgba(251,146,60,.1); }
    .song-row[data-status="releaseReady"] .bandos-pill,   .song-card[data-status="releaseReady"] .bandos-pill   { color:#FBBF24; border-color:rgba(251,191,36,.3);   background:rgba(251,191,36,.1); }
    .song-row[data-status="rehearsalReady"] .bandos-pill, .song-card[data-status="rehearsalReady"] .bandos-pill { color:#34D399; border-color:rgba(52,211,153,.3);    background:rgba(52,211,153,.1); }
    .song-row[data-status="liveReady"] .bandos-pill,      .song-card[data-status="liveReady"] .bandos-pill      { color:#4ADE80; border-color:rgba(74,222,128,.3);    background:rgba(74,222,128,.1); }
    .song-row[data-status="released"] .bandos-pill,       .song-card[data-status="released"] .bandos-pill       { color:#22C55E; border-color:rgba(34,197,94,.3);      background:rgba(34,197,94,.1); }

    /* Mobile card left border */
    .song-card[data-status="idea"]           { border-left: 3px solid #A78BFA; }
    .song-card[data-status="demo"]           { border-left: 3px solid #60A5FA; }
    .song-card[data-status="mixMaster"]      { border-left: 3px solid #FB923C; }
    .song-card[data-status="releaseReady"]   { border-left: 3px solid #FBBF24; }
    .song-card[data-status="rehearsalReady"] { border-left: 3px solid #34D399; }
    .song-card[data-status="liveReady"]      { border-left: 3px solid #4ADE80; }
    .song-card[data-status="released"]       { border-left: 3px solid #22C55E; }

    @media (max-width: 760px) {
      .songs-desktop { display: none; }
      .songs-mobile { display: flex; }
    }
  `],
})
export class SongsComponent {
  private readonly ws = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  query = signal('');
  workspace = computed(() => this.ws.workspace());
  songs = computed(() => this.workspace()?.songs ?? []);
  releases = computed(() => this.workspace()?.releases ?? []);
  filtered = computed(() => this.songs().filter(s => M.songMatchesQuery(s, this.query())));
  subtitle = computed(() => {
    const w = this.workspace(); if (!w) return '';
    if (M.wsIsFree(w)) return `Free plan · ${w.songs.length} of ${M.wsMaxSongs(w)} songs`;
    return `${w.songs.length} songs in library`;
  });
  canEdit = computed(() => {
    const w = this.workspace();
    return !!w && M.wsCanEditContent(w);
  });
  displayedColumns = ['title', 'status', 'tuning', 'bpm', 'duration', 'actions'];

  expandedId = signal<string | null>(null);
  isCreating = signal(false);

  statusLabel(s: M.SongStatus) { return M.SongStatusLabel[s]; }

  toggleExpand(id: string) {
    if (!this.canEdit()) return;
    if (this.isCreating()) this.isCreating.set(false);
    this.expandedId.update(curr => curr === id ? null : id);
  }
  collapseExpand() { this.expandedId.set(null); }
  cancelCreate() { this.isCreating.set(false); }

  newSong() {
    const w = this.workspace();
    if (!w) return;
    if (M.wsIsFree(w) && M.wsHasReachedSongLimit(w)) {
      this.snack.open('Free plan song limit reached. Upgrade to Premium.', 'OK', { duration: 3000 });
      return;
    }
    // On mobile use the popup; on desktop expand a new-row form inline.
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
    if (isMobile) {
      this.dialog.open(SongEditorDialog, { data: { releases: w.releases, canEdit: M.wsCanEditContent(w) } });
    } else {
      this.expandedId.set(null);
      this.isCreating.set(true);
    }
  }

  /** Mobile-only: open dialog to edit. */
  editInDialog(song: M.Song) {
    const w = this.workspace(); if (!w) return;
    this.dialog.open(SongEditorDialog, { data: { song, releases: w.releases, canEdit: M.wsCanEditContent(w) } });
  }

  async confirmDelete(song: M.Song) {
    if (!this.canEdit()) return;
    const ok = window.confirm(`Delete "${song.title}"? This can't be undone.`);
    if (!ok) return;
    if (this.expandedId() === song.id) this.expandedId.set(null);
    try {
      await this.ws.deleteSong(song.id);
      this.snack.open('Song deleted.', 'OK', { duration: 1800 });
    } catch (err: any) {
      this.snack.open(err?.message ?? 'Could not delete song.', 'OK', { duration: 4000 });
    }
  }
}
