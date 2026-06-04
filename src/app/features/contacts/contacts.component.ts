import { Component, computed, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar } from '@angular/material/snack-bar';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import { BandAvatarComponent } from '../../shared/components/band-avatar.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'contacts-screen',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule, MatTableModule, MatTooltipModule, BandAvatarComponent, ScreenHeaderComponent],
  template: `
    <div class="bandos-page">
      <screen-header title="Contacts" subtitle="Venues, promoters, photographers, and more."></screen-header>
      <div class="bandos-toolbar">
        <button mat-flat-button color="primary" (click)="newContact()">+ New contact</button>
      </div>
      @if (contacts().length === 0) {
        <p class="bandos-muted">No contacts yet.</p>
      } @else {
        <div class="contacts-table-wrap contacts-desktop">
          <table mat-table [dataSource]="contacts()" class="contacts-table">
            <ng-container matColumnDef="name">
              <th mat-header-cell *matHeaderCellDef>Name</th>
              <td mat-cell *matCellDef="let c">
                <div class="name-cell">
                  <band-avatar [displayName]="c.name" [size]="32"></band-avatar>
                  <span class="contact-name">{{ c.name }}</span>
                </div>
              </td>
            </ng-container>

            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let c"><span class="bandos-pill">{{ typeLabel(c.type) }}</span></td>
            </ng-container>

            <ng-container matColumnDef="phone">
              <th mat-header-cell *matHeaderCellDef>Phone</th>
              <td mat-cell *matCellDef="let c">{{ c.phone || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="email">
              <th mat-header-cell *matHeaderCellDef>Email</th>
              <td mat-cell *matCellDef="let c">{{ c.email || '—' }}</td>
            </ng-container>

            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-col">Actions</th>
              <td mat-cell *matCellDef="let c" class="actions-col">
                <button mat-icon-button type="button" matTooltip="Edit" (click)="openPanel(c); $event.stopPropagation()">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" color="warn" matTooltip="Delete" (click)="confirmDelete(c); $event.stopPropagation()">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="contact-row" (click)="openPanel(row)"></tr>
          </table>
        </div>

        <div class="bandos-grid contacts-mobile">
          @for (c of contacts(); track c.id) {
            <mat-card (click)="openPanel(c)" class="contact-card">
              <band-avatar [displayName]="c.name" [size]="44"></band-avatar>
              <div class="contact-card-info">
                <div class="name">{{ c.name }}</div>
                <div class="meta">{{ typeLabel(c.type) }}</div>
                @if (c.phone) { <div class="meta">{{ c.phone }}</div> }
                @if (c.email) { <div class="meta">{{ c.email }}</div> }
              </div>
            </mat-card>
          }
        </div>
      }

      <!-- Backdrop -->
      <div class="panel-backdrop" [class.visible]="panelOpen()" (click)="closePanel()"></div>
      <!-- Side panel -->
      <aside class="editor-panel" [class.open]="panelOpen()">
        <div class="panel-header">
          <div class="panel-header-text">
            <span class="panel-label">{{ panelItem() ? 'Edit contact' : 'New contact' }}</span>
            @if (panelItem()?.name) {
              <span class="panel-title">{{ panelItem()!.name }}</span>
            }
          </div>
          <button mat-icon-button (click)="closePanel()"><mat-icon>close</mat-icon></button>
        </div>
        <div class="panel-body">
          @if (panelOpen()) {
            <form [formGroup]="form" class="bandos-stack">
              <mat-form-field appearance="outline"><mat-label>Name</mat-label><input matInput formControlName="name" /></mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Type</mat-label>
                <mat-select formControlName="type">
                  @for (t of types; track t) { <mat-option [value]="t">{{ typeLabel(t) }}</mat-option> }
                </mat-select>
              </mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Phone</mat-label><input matInput formControlName="phone" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Email</mat-label><input matInput formControlName="email" /></mat-form-field>
              <mat-form-field appearance="outline"><mat-label>Notes</mat-label><textarea matInput rows="3" formControlName="notes"></textarea></mat-form-field>
              <div class="panel-actions">
                @if (panelItem()) { <button mat-button color="warn" style="margin-right: auto;" (click)="panelDelete()">Delete</button> }
                <button mat-button (click)="closePanel()">Cancel</button>
                <button mat-flat-button color="primary" (click)="panelSave()">Save</button>
              </div>
            </form>
          }
        </div>
      </aside>
    </div>
  `,
  styles: [`
    .name { font-weight: 700; }
    .meta { font-size: 12px; color: #9D9DA7; margin-top: 2px; }

    .contacts-table-wrap { background: #1D1D23; border: 1px solid #383842; border-radius: 12px; overflow: hidden; }
    .contacts-table { width: 100%; background: transparent; }
    .contacts-table th.mat-mdc-header-cell { background: #16161B; color: #9D9DA7; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .contacts-table td.mat-mdc-cell, .contacts-table th.mat-mdc-header-cell { border-bottom-color: #383842; color: #CDCDD3; }
    .contact-row { cursor: pointer; }
    .contact-row:hover td.mat-mdc-cell { background: #22222A; }
    .name-cell { display: flex; align-items: center; gap: 10px; }
    .contact-name { font-weight: 700; }
    .actions-col { width: 110px; text-align: right; white-space: nowrap; }

    .contacts-mobile { display: none; }
    .contact-card { cursor: pointer; display: flex; gap: 12px; align-items: flex-start; }
    .contact-card-info { flex: 1; min-width: 0; }

    @media (max-width: 760px) {
      .contacts-desktop { display: none; }
      .contacts-mobile { display: grid; }
    }

    .panel-actions { display: flex; justify-content: flex-end; gap: 8px; padding-top: 8px; }

    /* ── Side panel ── */
    .panel-backdrop { position: fixed; inset: 0; z-index: 200; background: transparent; pointer-events: none; transition: background 0.25s ease; }
    .panel-backdrop.visible { background: rgba(0,0,0,0.35); }
    .editor-panel { position: fixed; top: 16px; right: 16px; bottom: 16px; width: 460px; z-index: 201; background: #20202A; border: 1px solid #383842; border-radius: 16px; overflow: hidden; display: flex; flex-direction: column; transform: translateX(calc(100% + 32px)); transition: transform 0.3s cubic-bezier(0.4,0,0.2,1); box-shadow: 0 12px 48px rgba(0,0,0,0.55); }
    .editor-panel.open { transform: translateX(0); }
    .panel-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 14px; border-bottom: 1px solid #383842; flex-shrink: 0; }
    .panel-header-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
    .panel-label { font-size: 11px; font-weight: 700; color: #9D9DA7; text-transform: uppercase; letter-spacing: 0.06em; }
    .panel-title { font-size: 17px; font-weight: 800; color: #CDCDD3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .panel-body { flex: 1; overflow-y: auto; padding: 20px; }
    @media (max-width: 760px) { .editor-panel { inset: 0; width: 100%; border-radius: 0; border: none; } }
  `],
})
export class ContactsComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly snack = inject(MatSnackBar);
  private readonly fb = inject(FormBuilder);

  contacts = computed(() => this.wsc.workspace()?.contacts ?? []);
  displayedColumns = ['name', 'type', 'phone', 'email', 'actions'];
  types = Object.values(M.BandContactType);
  typeLabel(t: M.BandContactType) { return M.BandContactTypeLabel[t]; }

  panelOpen = signal(false);
  private _keepPanelOpen = false;
  panelItem = signal<M.BandContact | null>(null);

  form = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    type: [M.BandContactType.venue],
    phone: [''],
    email: [''],
    notes: [''],
  });

  openPanel(item: M.BandContact | null) {
    this.panelItem.set(item);
    this.panelOpen.set(true); this._keepPanelOpen = true; setTimeout(() => (this._keepPanelOpen = false));
    this.form.reset({
      name: item?.name ?? '',
      type: item?.type ?? M.BandContactType.venue,
      phone: item?.phone ?? '',
      email: item?.email ?? '',
      notes: item?.notes ?? '',
    });
  }

  closePanel() { this.panelOpen.set(false); }

  @HostListener('document:keydown.escape')
  onEscape() { if (this.panelOpen()) this.closePanel(); }

  @HostListener("document:click", ["$event"])
  onDocumentClick(ev: MouseEvent) {
    if (!this.panelOpen()) return;
    if (this._keepPanelOpen) { this._keepPanelOpen = false; return; }
    const target = ev.target as HTMLElement | null;
    if (target && target.closest(".editor-panel, .songs-panel, .cdk-overlay-container")) return;
    this.closePanel();
  }

  newContact() { this.openPanel(null); }

  edit(c: M.BandContact) { this.openPanel(c); }

  async panelSave() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const existing = this.panelItem();
    const contact: M.BandContact = existing
      ? { ...existing, ...v }
      : { id: uuid(), ...v };
    await this.wsc.saveContact(contact);
    this.closePanel();
  }

  async panelDelete() {
    const item = this.panelItem();
    if (!item) return;
    const ok = window.confirm(`Delete "${item.name}"? This can't be undone.`);
    if (!ok) return;
    await this.wsc.deleteContact(item.id);
    this.snack.open('Contact deleted.', 'OK', { duration: 1800 });
    this.closePanel();
  }

  async confirmDelete(c: M.BandContact) {
    const ok = window.confirm(`Delete "${c.name}"? This can't be undone.`);
    if (!ok) return;
    await this.wsc.deleteContact(c.id);
    this.snack.open('Contact deleted.', 'OK', { duration: 1800 });
    if (this.panelItem()?.id === c.id) this.closePanel();
  }
}
