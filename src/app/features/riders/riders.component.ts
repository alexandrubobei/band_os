import { Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'rider-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatCheckboxModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit rider' : 'New technical rider' }}</h2>
    <form mat-dialog-content [formGroup]="form" class="bandos-stack" style="min-width:560px;max-height:70vh;">
      <div class="bandos-row">
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Rider name</mat-label><input matInput formControlName="riderName" /></mat-form-field>
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Band name</mat-label><input matInput formControlName="bandName" /></mat-form-field>
      </div>
      <mat-form-field appearance="fill"><mat-label>Lineup</mat-label><input matInput formControlName="lineup" /></mat-form-field>
      <div class="bandos-row">
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Contact person</mat-label><input matInput formControlName="contactPerson" /></mat-form-field>
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Phone</mat-label><input matInput formControlName="phone" /></mat-form-field>
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Email</mat-label><input matInput formControlName="email" /></mat-form-field>
      </div>
      <mat-form-field appearance="fill"><mat-label>Short note</mat-label><input matInput formControlName="shortNote" /></mat-form-field>

      <h3 class="bandos-section-title">Stage plot</h3>
      <div class="bandos-row">
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Stage width</mat-label><input matInput formControlName="stageWidth" /></mat-form-field>
        <mat-form-field appearance="fill" style="flex:1;"><mat-label>Stage depth</mat-label><input matInput formControlName="stageDepth" /></mat-form-field>
      </div>
      <mat-form-field appearance="fill"><mat-label>Member positions</mat-label><textarea matInput rows="2" formControlName="memberPositions"></textarea></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Instrument positions</mat-label><textarea matInput rows="2" formControlName="instrumentPositions"></textarea></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Monitor positions</mat-label><textarea matInput rows="2" formControlName="monitorPositions"></textarea></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Power drop notes</mat-label><textarea matInput rows="2" formControlName="powerDropNotes"></textarea></mat-form-field>

      <h3 class="bandos-section-title">Inputs</h3>
      @for (i of inputs(); track i.id; let idx = $index) {
        <div class="bandos-row">
          <mat-form-field appearance="fill" style="flex:2;"><mat-label>Source</mat-label><input matInput [value]="i.sourceName" (input)="updateInput(idx, { sourceName: $any($event.target).value })" /></mat-form-field>
          <mat-form-field appearance="fill" style="width:80px;"><mat-label>Ch</mat-label><input matInput [value]="i.channelNumber" (input)="updateInput(idx, { channelNumber: $any($event.target).value })" /></mat-form-field>
          <mat-form-field appearance="fill" style="flex:1;"><mat-label>Mic/DI</mat-label><input matInput [value]="i.micDiPreference" (input)="updateInput(idx, { micDiPreference: $any($event.target).value })" /></mat-form-field>
          <button mat-icon-button (click)="removeInput(idx)" type="button"><mat-icon>delete</mat-icon></button>
        </div>
      }
      <button mat-stroked-button (click)="addInput()" type="button">+ Add input</button>

      <h3 class="bandos-section-title">Backline</h3>
      <mat-form-field appearance="fill"><mat-label>Band backline</mat-label><textarea matInput rows="2" formControlName="bandBackline"></textarea></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Venue backline</mat-label><textarea matInput rows="2" formControlName="venueBackline"></textarea></mat-form-field>

      <h3 class="bandos-section-title">Monitoring</h3>
      <div class="bandos-row">
        <mat-checkbox formControlName="usesIem">In-ear monitors</mat-checkbox>
        <mat-checkbox formControlName="wedgesNeeded">Wedges needed</mat-checkbox>
      </div>
      <mat-form-field appearance="fill"><mat-label>Monitor mix count</mat-label><input matInput formControlName="monitorMixCount" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Playback / click notes</mat-label><textarea matInput rows="2" formControlName="playbackClickNotes"></textarea></mat-form-field>

      <h3 class="bandos-section-title">Power</h3>
      <mat-form-field appearance="fill"><mat-label>Power requirements</mat-label><textarea matInput rows="2" formControlName="powerRequirements"></textarea></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Outlet locations</mat-label><textarea matInput rows="2" formControlName="outletLocationNotes"></textarea></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Additional notes</mat-label><textarea matInput rows="3" formControlName="additionalNotes"></textarea></mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      @if (existing) { <button mat-button color="warn" style="margin-right: auto;" (click)="remove()">Delete</button> }
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
})
export class RiderEditorDialog {
  ref = inject(MatDialogRef<RiderEditorDialog>);
  private readonly fb = inject(FormBuilder);
  data: { rider?: M.TechnicalRider; defaultBandName: string } = inject(MAT_DIALOG_DATA);
  existing = !!this.data.rider;

  inputs = signal<M.TechnicalRiderInput[]>(this.data.rider?.inputList.map(i => ({ ...i })) ?? []);

  form = this.fb.nonNullable.group({
    riderName: [this.data.rider?.riderName ?? 'Main rider', [Validators.required]],
    bandName: [this.data.rider?.bandName ?? this.data.defaultBandName],
    contactPerson: [this.data.rider?.contactPerson ?? ''],
    phone: [this.data.rider?.phone ?? ''],
    email: [this.data.rider?.email ?? ''],
    lineup: [this.data.rider?.lineup ?? ''],
    shortNote: [this.data.rider?.shortNote ?? ''],
    stageWidth: [this.data.rider?.stageWidth ?? ''],
    stageDepth: [this.data.rider?.stageDepth ?? ''],
    memberPositions: [this.data.rider?.memberPositions ?? ''],
    instrumentPositions: [this.data.rider?.instrumentPositions ?? ''],
    ampPositions: [this.data.rider?.ampPositions ?? ''],
    monitorPositions: [this.data.rider?.monitorPositions ?? ''],
    powerDropNotes: [this.data.rider?.powerDropNotes ?? ''],
    bandBackline: [this.data.rider?.bandBackline ?? ''],
    venueBackline: [this.data.rider?.venueBackline ?? ''],
    usesIem: [!!this.data.rider?.usesIem],
    wedgesNeeded: [!!this.data.rider?.wedgesNeeded],
    monitorMixCount: [this.data.rider?.monitorMixCount ?? ''],
    playbackClickNotes: [this.data.rider?.playbackClickNotes ?? ''],
    powerRequirements: [this.data.rider?.powerRequirements ?? ''],
    outletLocationNotes: [this.data.rider?.outletLocationNotes ?? ''],
    additionalNotes: [this.data.rider?.additionalNotes ?? ''],
  });

  addInput() {
    this.inputs.update(arr => [...arr, {
      id: uuid(), sourceName: '', channelNumber: '', micDiPreference: '', standType: '',
      phantomPower: null, stagePosition: '', notes: '',
    }]);
  }
  updateInput(idx: number, patch: Partial<M.TechnicalRiderInput>) {
    this.inputs.update(arr => arr.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }
  removeInput(idx: number) {
    this.inputs.update(arr => arr.filter((_, i) => i !== idx));
  }
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const rider: M.TechnicalRider = this.data.rider
      ? { ...this.data.rider, ...v, inputList: this.inputs(), updatedAt: new Date() }
      : { id: uuid(), ...v, inputList: this.inputs(), updatedAt: new Date() };
    this.ref.close({ action: 'save', rider });
  }
  remove() { this.ref.close({ action: 'delete' }); }
}

@Component({
  selector: 'riders-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, ScreenHeaderComponent, MatDialogModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Technical riders" [subtitle]="subtitle()"></screen-header>
      @if (locked()) {
        <div class="bandos-card" style="border-color:#C8A77B;">
          <h3 style="margin:0 0 6px;">Premium feature</h3>
          <p class="bandos-muted">Technical riders are available on the Premium plan. Upgrade in Band settings.</p>
        </div>
      } @else {
        <div class="bandos-toolbar">
          <button mat-flat-button color="primary" (click)="newRider()">+ New rider</button>
        </div>
        @if (riders().length === 0) {
          <p class="bandos-muted">No riders saved yet.</p>
        } @else {
          <div class="bandos-grid">
            @for (r of riders(); track r.id) {
              <mat-card (click)="edit(r)" style="cursor:pointer;">
                <h3>{{ r.riderName }}</h3>
                <div class="meta">{{ r.bandName }} · updated {{ r.updatedAt | date:'mediumDate' }}</div>
                @if (r.shortNote) { <div class="notes">{{ r.shortNote }}</div> }
                <div class="meta">{{ r.inputList.length }} inputs</div>
              </mat-card>
            }
          </div>
        }
      }
    </div>
  `,
  styles: [`
    h3 { font-weight: 800; margin: 0 0 6px; }
    .meta { color: #9D9DA7; font-size: 12px; margin-top: 4px; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 8px; }
  `],
})
export class RidersComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);
  riders = computed(() => this.wsc.workspace()?.technicalRiders ?? []);
  locked = computed(() => { const w = this.wsc.workspace(); return w ? !M.wsSupportsRiders(w) : false; });
  subtitle = computed(() => this.wsc.workspace()?.bandName ?? '');

  newRider() {
    const w = this.wsc.workspace(); if (!w) return;
    const ref = this.dialog.open(RiderEditorDialog, { data: { defaultBandName: w.bandName } });
    ref.afterClosed().subscribe(async r => { if (r?.action === 'save') await this.wsc.saveRider(r.rider); });
  }
  edit(r: M.TechnicalRider) {
    const w = this.wsc.workspace(); if (!w) return;
    const ref = this.dialog.open(RiderEditorDialog, { data: { rider: r, defaultBandName: w.bandName } });
    ref.afterClosed().subscribe(async result => {
      if (result?.action === 'save') await this.wsc.saveRider(result.rider);
      else if (result?.action === 'delete') await this.wsc.deleteRider(r.id);
    });
  }
}
