import { Component, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'riders-screen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatIconModule, MatCheckboxModule, ScreenHeaderComponent],
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
          <button mat-flat-button color="primary" (click)="openPanel(null)">+ New rider</button>
        </div>
        @if (riders().length === 0) {
          <p class="bandos-muted">No riders saved yet.</p>
        } @else {
          <div class="bandos-grid">
            @for (r of riders(); track r.id) {
              <mat-card (click)="openPanel(r)" style="cursor:pointer;">
                <h3>{{ r.riderName }}</h3>
                <div class="meta">{{ r.bandName }} · updated {{ r.updatedAt | date:'mediumDate' }}</div>
                @if (r.shortNote) { <div class="notes">{{ r.shortNote }}</div> }
                <div class="meta">{{ r.inputList.length }} inputs</div>
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
            <span class="panel-label">{{ panelItem() ? 'Edit rider' : 'New rider' }}</span>
            @if (panelItem()?.riderName) {
              <span class="panel-title">{{ panelItem()!.riderName }}</span>
            }
          </div>
          <button mat-icon-button (click)="closePanel()"><mat-icon>close</mat-icon></button>
        </div>
        <div class="panel-body">
          @if (panelOpen()) {
            <form [formGroup]="form" class="bandos-stack">
              <div class="bandos-row">
                <mat-form-field appearance="outline" style="flex:1;"><mat-label>Rider name</mat-label><input matInput formControlName="riderName" /></mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;"><mat-label>Band name</mat-label><input matInput formControlName="bandName" /></mat-form-field>
              </div>
              <mat-form-field appearance="outline"><mat-label>Lineup</mat-label><input matInput formControlName="lineup" /></mat-form-field>
              <div class="bandos-row">
                <mat-form-field appearance="outline" style="flex:1;"><mat-label>Contact person</mat-label><input matInput formControlName="contactPerson" /></mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;"><mat-label>Phone</mat-label><input matInput formControlName="phone" /></mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;"><mat-label>Email</mat-label><input matInput formControlName="email" /></mat-form-field>
              </div>
              <mat-form-field appearance="outline"><mat-label>Short note</mat-label><input matInput formControlName="shortNote" /></mat-form-field>

              <h3 class="bandos-section-title">Stage plot</h3>
              <div class="bandos-row">
                <mat-form-field appearance="outline" style="flex:1;"><mat-label>Stage width</mat-label><input matInput formControlName="stageWidth" /></mat-form-field>
                <mat-form-field appearance="outline" style="flex:1;"><mat-label>Stage depth</mat-label><input matInput formControlName="stageDepth" /></mat-form-field>
              </div>
              <mat-form-field appearance="outline"><mat-label>Member positions</mat-label><textarea matInput rows="2" formControlName="memberPositions"></textarea></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Instrument positions</mat-label><textarea matInput rows="2" formControlName="instrumentPositions"></textarea></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Monitor positions</mat-label><textarea matInput rows="2" formControlName="monitorPositions"></textarea></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Power drop notes</mat-label><textarea matInput rows="2" formControlName="powerDropNotes"></textarea></mat-form-field>

              <h3 class="bandos-section-title">Inputs</h3>
              @for (i of inputs(); track i.id; let idx = $index) {
                <div class="bandos-row">
                  <mat-form-field appearance="outline" style="flex:2;"><mat-label>Source</mat-label><input matInput [value]="i.sourceName" (input)="updateInput(idx, { sourceName: $any($event.target).value })" /></mat-form-field>
                  <mat-form-field appearance="outline" style="width:80px;"><mat-label>Ch</mat-label><input matInput [value]="i.channelNumber" (input)="updateInput(idx, { channelNumber: $any($event.target).value })" /></mat-form-field>
                  <mat-form-field appearance="outline" style="flex:1;"><mat-label>Mic/DI</mat-label><input matInput [value]="i.micDiPreference" (input)="updateInput(idx, { micDiPreference: $any($event.target).value })" /></mat-form-field>
                  <button mat-icon-button (click)="removeInput(idx)" type="button"><mat-icon>delete</mat-icon></button>
                </div>
              }
              <button mat-stroked-button (click)="addInput()" type="button">+ Add input</button>

              <h3 class="bandos-section-title">Backline</h3>
              <mat-form-field appearance="outline"><mat-label>Band backline</mat-label><textarea matInput rows="2" formControlName="bandBackline"></textarea></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Venue backline</mat-label><textarea matInput rows="2" formControlName="venueBackline"></textarea></mat-form-field>

              <h3 class="bandos-section-title">Monitoring</h3>
              <div class="bandos-row">
                <mat-checkbox formControlName="usesIem">In-ear monitors</mat-checkbox>
                <mat-checkbox formControlName="wedgesNeeded">Wedges needed</mat-checkbox>
              </div>
              <mat-form-field appearance="outline"><mat-label>Monitor mix count</mat-label><input matInput formControlName="monitorMixCount" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Playback / click notes</mat-label><textarea matInput rows="2" formControlName="playbackClickNotes"></textarea></mat-form-field>

              <h3 class="bandos-section-title">Power</h3>
              <mat-form-field appearance="outline"><mat-label>Power requirements</mat-label><textarea matInput rows="2" formControlName="powerRequirements"></textarea></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Outlet locations</mat-label><textarea matInput rows="2" formControlName="outletLocationNotes"></textarea></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Additional notes</mat-label><textarea matInput rows="3" formControlName="additionalNotes"></textarea></mat-form-field>

              <div class="panel-actions">
                @if (panelItem()) { <button mat-button color="warn" style="margin-right: auto;" (click)="deleteRider()">Delete</button> }
                <button mat-button (click)="closePanel()">Cancel</button>
                <button mat-flat-button color="primary" (click)="save()">Save</button>
              </div>
            </form>
          }
        </div>
      </aside>
    </div>
  `,
  styles: [`
    h3 { font-weight: 800; margin: 0 0 6px; }
    .meta { color: #9D9DA7; font-size: 12px; margin-top: 4px; }
    .notes { color: #C7C7CF; font-size: 13px; margin-top: 8px; }
    .panel-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 12px; }

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
export class RidersComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly fb = inject(FormBuilder);

  riders = computed(() => this.wsc.workspace()?.technicalRiders ?? []);
  locked = computed(() => { const w = this.wsc.workspace(); return w ? !M.wsSupportsRiders(w) : false; });
  subtitle = computed(() => this.wsc.workspace()?.bandName ?? '');

  panelOpen = signal(false);
  panelItem = signal<M.TechnicalRider | null>(null);

  inputs = signal<M.TechnicalRiderInput[]>([]);

  form = this.fb.nonNullable.group({
    riderName: ['Main rider', [Validators.required]],
    bandName: [''],
    contactPerson: [''],
    phone: [''],
    email: [''],
    lineup: [''],
    shortNote: [''],
    stageWidth: [''],
    stageDepth: [''],
    memberPositions: [''],
    instrumentPositions: [''],
    ampPositions: [''],
    monitorPositions: [''],
    powerDropNotes: [''],
    bandBackline: [''],
    venueBackline: [''],
    usesIem: [false],
    wedgesNeeded: [false],
    monitorMixCount: [''],
    playbackClickNotes: [''],
    powerRequirements: [''],
    outletLocationNotes: [''],
    additionalNotes: [''],
  });

  openPanel(item: M.TechnicalRider | null) {
    this.panelItem.set(item);
    const w = this.wsc.workspace();
    const defaultBandName = w?.bandName ?? '';
    this.inputs.set(item?.inputList.map(i => ({ ...i })) ?? []);
    this.form.reset({
      riderName: item?.riderName ?? 'Main rider',
      bandName: item?.bandName ?? defaultBandName,
      contactPerson: item?.contactPerson ?? '',
      phone: item?.phone ?? '',
      email: item?.email ?? '',
      lineup: item?.lineup ?? '',
      shortNote: item?.shortNote ?? '',
      stageWidth: item?.stageWidth ?? '',
      stageDepth: item?.stageDepth ?? '',
      memberPositions: item?.memberPositions ?? '',
      instrumentPositions: item?.instrumentPositions ?? '',
      ampPositions: item?.ampPositions ?? '',
      monitorPositions: item?.monitorPositions ?? '',
      powerDropNotes: item?.powerDropNotes ?? '',
      bandBackline: item?.bandBackline ?? '',
      venueBackline: item?.venueBackline ?? '',
      usesIem: !!item?.usesIem,
      wedgesNeeded: !!item?.wedgesNeeded,
      monitorMixCount: item?.monitorMixCount ?? '',
      playbackClickNotes: item?.playbackClickNotes ?? '',
      powerRequirements: item?.powerRequirements ?? '',
      outletLocationNotes: item?.outletLocationNotes ?? '',
      additionalNotes: item?.additionalNotes ?? '',
    });
    this.panelOpen.set(true);
  }

  closePanel() { this.panelOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.panelOpen()) this.closePanel(); }

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

  async save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const existing = this.panelItem();
    const rider: M.TechnicalRider = existing
      ? { ...existing, ...v, inputList: this.inputs(), updatedAt: new Date() }
      : { id: uuid(), ...v, inputList: this.inputs(), updatedAt: new Date() };
    await this.wsc.saveRider(rider);
    this.closePanel();
  }

  async deleteRider() {
    const item = this.panelItem();
    if (!item) return;
    await this.wsc.deleteRider(item.id);
    this.closePanel();
  }
}
