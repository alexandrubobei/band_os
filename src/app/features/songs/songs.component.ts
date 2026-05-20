import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

const ALLOWED_AUDIO_EXTENSIONS = ['mp3', 'm4a', 'wav', 'aac'];
const AUDIO_MAX_BYTES = 25 * 1024 * 1024;

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

@Component({
  selector: 'song-editor-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatIconModule, MatProgressSpinnerModule, MatDialogModule,
  ],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit song' : 'New song' }}</h2>
    <form [formGroup]="form" (ngSubmit)="save()" mat-dialog-content class="bandos-stack" style="min-width:460px;max-height:75vh;">
      <mat-form-field appearance="fill"><mat-label>Title</mat-label><input matInput formControlName="title" /></mat-form-field>
      <div class="bandos-row">
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Tuning</mat-label><input matInput formControlName="tuning" /></mat-form-field>
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>BPM</mat-label><input matInput type="number" formControlName="bpm" /></mat-form-field>
      </div>
      <div class="bandos-row">
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Duration (m:ss)</mat-label><input matInput formControlName="duration" placeholder="3:48" /></mat-form-field>
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Time signature</mat-label><input matInput formControlName="timeSignature" /></mat-form-field>
      </div>
      <mat-form-field appearance="fill">
        <mat-label>Status</mat-label>
        <mat-select formControlName="status">
          @for (s of statuses; track s) { <mat-option [value]="s">{{ statusLabel(s) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      @if (showReleaseField()) {
        <mat-form-field appearance="fill">
          <mat-label>Release</mat-label>
          <mat-select formControlName="releaseId">
            <mat-option [value]="null">None</mat-option>
            @for (r of data.releases; track r.id) { <mat-option [value]="r.id">{{ r.title }}</mat-option> }
          </mat-select>
        </mat-form-field>
      }
      <mat-form-field appearance="fill"><mat-label>Lyrics</mat-label><textarea matInput rows="4" formControlName="lyrics"></textarea></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Notes</mat-label><textarea matInput rows="3" formControlName="notes"></textarea></mat-form-field>
      <mat-form-field appearance="fill">
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
                <div class="audio-name">{{ data.song?.audioFileName || 'Attached audio' }}</div>
                @if (data.song?.audioSizeBytes) {
                  <div class="audio-meta">{{ formatSize(data.song!.audioSizeBytes!) }}</div>
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
          <input #fileInput type="file" [accept]="acceptAudio" hidden (change)="onFilePicked($any($event.target).files)" />
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
    <div mat-dialog-actions align="end">
      @if (existing) {
        <button mat-button color="warn" (click)="remove()" [disabled]="uploading()">Delete</button>
      }
      <button mat-button (click)="ref.close()" [disabled]="uploading()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()" [disabled]="uploading()">
        @if (uploading()) { Saving… } @else { Save }
      </button>
    </div>
  `,
  styles: [`
    .audio-section { display: flex; flex-direction: column; gap: 8px; padding-top: 4px; }
    .audio-section h3 { margin: 0; font-size: 15px; font-weight: 700; }
    .audio-hint { margin: 0; color: #9D9DA7; font-size: 13px; }
    .audio-current { background: #1D1D23; border: 1px solid #2A2A31; border-radius: 10px; padding: 12px; }
    .audio-info { display: flex; gap: 12px; align-items: center; }
    .audio-info mat-icon { color: #C8A77B; }
    .audio-name { font-weight: 700; word-break: break-all; }
    .audio-meta { font-size: 12px; color: #9D9DA7; }
    .audio-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  `],
})
export class SongEditorDialog {
  ref = inject(MatDialogRef<SongEditorDialog>);
  private readonly fb = inject(FormBuilder);
  private readonly ws = inject(WorkspaceController);
  private readonly snack = inject(MatSnackBar);

  data: SongEditorData = inject<SongEditorData>(MAT_DIALOG_DATA);
  existing = !!this.data.song;
  statuses = Object.values(M.SongStatus);
  acceptAudio = ALLOWED_AUDIO_EXTENSIONS.map(e => `.${e}`).join(',') + ',audio/*';

  statusLabel(s: M.SongStatus) { return M.SongStatusLabel[s]; }
  formatSize(b: number) { return formatAudioSize(b); }
  showReleaseField = computed(() => this.data.releases.length > 0 || !!this.data.song?.releaseId);
  supportsAudioUpload = computed(() => this.ws.supportsSongAudioUpload);
  canManageAudio = computed(() => this.data.canEdit && this.supportsAudioUpload());

  existingAudioUrl = signal<string | null>(this.data.song?.audioUrl ?? null);
  pendingAudio = signal<PendingAudio | null>(null);
  audioError = signal<string | null>(null);
  uploading = signal(false);

  form = this.fb.nonNullable.group({
    title: [this.data.song?.title ?? '', [Validators.required]],
    tuning: [this.data.song?.tuning ?? 'E standard'],
    bpm: [this.data.song?.bpm ?? 120, [Validators.required, Validators.min(20)]],
    duration: [this.data.song?.duration ?? '3:00', [Validators.required]],
    timeSignature: [this.data.song?.timeSignature ?? '4/4'],
    status: [this.data.song?.status ?? M.SongStatus.idea],
    releaseId: [this.data.song?.releaseId ?? null as string | null],
    notes: [this.data.song?.notes ?? ''],
    lyrics: [this.data.song?.lyrics ?? ''],
    attachmentLabel: [this.data.song?.attachmentLabel ?? ''],
  });

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
    if (!this.data.song) return;
    this.uploading.set(true);
    try {
      await this.ws.clearSongAudio(this.data.song);
      this.existingAudioUrl.set(null);
      this.data.song = { ...this.data.song, audioUrl: null, audioStoragePath: null, audioFileName: null, audioContentType: null, audioSizeBytes: null };
      this.snack.open('Audio removed.', 'OK', { duration: 1800 });
    } catch (err: any) {
      this.snack.open(err?.message ?? 'Could not remove audio.', 'OK', { duration: 3000 });
    } finally {
      this.uploading.set(false);
    }
  }

  async save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const baseSong: M.Song = this.data.song ? {
      ...this.data.song,
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

    const pending = this.pendingAudio();
    if (!pending) {
      this.ref.close({ action: 'save', song: baseSong });
      return;
    }

    this.uploading.set(true);
    try {
      await this.ws.saveSong(baseSong);
      await this.ws.updateSongAudio(baseSong, pending.bytes, pending.file.name);
      this.snack.open('Song saved with audio.', 'OK', { duration: 1800 });
      this.ref.close({ action: 'saved-with-audio' });
    } catch (err: any) {
      this.snack.open(err?.message ?? 'Could not upload audio. Song was saved without it.', 'OK', { duration: 4000 });
      this.ref.close({ action: 'saved-with-audio' });
    } finally {
      this.uploading.set(false);
    }
  }

  remove() { this.ref.close({ action: 'delete' }); }
}

@Component({
  selector: 'songs-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatFormFieldModule, MatInputModule, MatChipsModule, ScreenHeaderComponent, MatDialogModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Songs" [subtitle]="subtitle()"></screen-header>
      <div class="bandos-toolbar">
        <mat-form-field appearance="fill" style="flex:1;max-width:360px;">
          <mat-label>Search</mat-label>
          <input matInput [value]="query()" (input)="query.set($any($event.target).value)" placeholder="Title, tuning, or notes…" />
        </mat-form-field>
        <button mat-flat-button color="primary" (click)="newSong()">+ New song</button>
      </div>

      @if (filtered().length === 0) {
        <p class="bandos-muted">No songs yet. Click "+ New song" to add the first one.</p>
      } @else {
        <div class="bandos-grid">
          @for (song of filtered(); track song.id) {
            <mat-card (click)="edit(song)" class="song-card">
              <div class="title-row">
                <div class="song-title">{{ song.title }}</div>
                <div class="badges">
                  @if (song.audioUrl) {
                    <span class="bandos-pill secondary" title="Has audio">
                      <mat-icon style="font-size:14px;width:14px;height:14px;">music_note</mat-icon>
                    </span>
                  }
                  <span class="bandos-pill">{{ statusLabel(song.status) }}</span>
                </div>
              </div>
              <div class="meta">
                <span>{{ song.tuning }}</span>
                <span>·</span>
                <span>{{ song.bpm }} BPM</span>
                <span>·</span>
                <span>{{ song.duration }}</span>
              </div>
              @if (song.attachmentLabel) { <div class="attachment-label">{{ song.attachmentLabel }}</div> }
              @if (song.notes) { <div class="notes">{{ song.notes }}</div> }
            </mat-card>
          }
        </div>
      }
    </div>
  `,
  styles: [`
    .song-card { cursor: pointer; }
    .song-card:hover { border-color: #EF4A35; }
    .title-row { display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; }
    .badges { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
    .song-title { font-size: 16px; font-weight: 800; }
    .meta { color: #9D9DA7; font-size: 12px; margin-top: 6px; display: flex; gap: 6px; }
    .attachment-label { color: #C8A77B; font-size: 12px; margin-top: 8px; font-weight: 600; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 10px; line-height: 1.4; }
  `],
})
export class SongsComponent {
  private readonly ws = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);

  query = signal('');
  songs = computed(() => this.ws.workspace()?.songs ?? []);
  filtered = computed(() => this.songs().filter(s => M.songMatchesQuery(s, this.query())));
  subtitle = computed(() => {
    const w = this.ws.workspace(); if (!w) return '';
    if (M.wsIsFree(w)) return `Free plan · ${w.songs.length} of ${M.wsMaxSongs(w)} songs`;
    return `${w.songs.length} songs in library`;
  });
  statusLabel(s: M.SongStatus) { return M.SongStatusLabel[s]; }

  newSong() {
    const w = this.ws.workspace();
    if (!w) return;
    if (M.wsIsFree(w) && M.wsHasReachedSongLimit(w)) {
      this.snack.open('Free plan song limit reached. Upgrade to Premium.', 'OK', { duration: 3000 });
      return;
    }
    const ref = this.dialog.open(SongEditorDialog, { data: { releases: w.releases, canEdit: M.wsCanEditContent(w) } });
    ref.afterClosed().subscribe(async result => {
      if (result?.action === 'save') {
        await this.ws.saveSong(result.song);
        this.snack.open('Song saved.', 'OK', { duration: 1800 });
      }
    });
  }
  edit(song: M.Song) {
    const w = this.ws.workspace(); if (!w) return;
    const ref = this.dialog.open(SongEditorDialog, { data: { song, releases: w.releases, canEdit: M.wsCanEditContent(w) } });
    ref.afterClosed().subscribe(async result => {
      if (result?.action === 'save') await this.ws.saveSong(result.song);
      else if (result?.action === 'delete') await this.ws.deleteSong(song.id);
    });
  }
}
