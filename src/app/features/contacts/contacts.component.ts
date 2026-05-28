import { Component, computed, inject } from '@angular/core';
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
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { v4 as uuid } from 'uuid';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { ScreenHeaderComponent } from '../../shared/components/screen-header.component';
import { BandAvatarComponent } from '../../shared/components/band-avatar.component';
import * as M from '../../core/models/models';

@Component({
  selector: 'contact-editor-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDialogModule],
  template: `
    <h2 mat-dialog-title>{{ existing ? 'Edit contact' : 'New contact' }}</h2>
    <form mat-dialog-content [formGroup]="form" class="bandos-stack" style="min-width:420px;">
      <mat-form-field appearance="fill"><mat-label>Name</mat-label><input matInput formControlName="name" /></mat-form-field>
      <mat-form-field appearance="fill">
        <mat-label>Type</mat-label>
        <mat-select formControlName="type">
          @for (t of types; track t) { <mat-option [value]="t">{{ typeLabel(t) }}</mat-option> }
        </mat-select>
      </mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Phone</mat-label><input matInput formControlName="phone" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Email</mat-label><input matInput formControlName="email" /></mat-form-field>
      <mat-form-field appearance="fill"><mat-label>Notes</mat-label><textarea matInput rows="3" formControlName="notes"></textarea></mat-form-field>
    </form>
    <div mat-dialog-actions align="end">
      @if (existing) { <button mat-button color="warn" style="margin-right: auto;" (click)="remove()">Delete</button> }
      <button mat-button (click)="ref.close()">Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">Save</button>
    </div>
  `,
})
export class ContactEditorDialog {
  ref = inject(MatDialogRef<ContactEditorDialog>);
  private readonly fb = inject(FormBuilder);
  data: { contact?: M.BandContact } = inject<{ contact?: M.BandContact }>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  existing = !!this.data.contact;
  types = Object.values(M.BandContactType);
  typeLabel(t: M.BandContactType) { return M.BandContactTypeLabel[t]; }

  form = this.fb.nonNullable.group({
    name: [this.data.contact?.name ?? '', [Validators.required]],
    type: [this.data.contact?.type ?? M.BandContactType.venue],
    phone: [this.data.contact?.phone ?? ''],
    email: [this.data.contact?.email ?? ''],
    notes: [this.data.contact?.notes ?? ''],
  });
  save() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const v = this.form.getRawValue();
    const contact: M.BandContact = this.data.contact
      ? { ...this.data.contact, ...v }
      : { id: uuid(), ...v };
    this.ref.close({ action: 'save', contact });
  }
  remove() { this.ref.close({ action: 'delete' }); }
}

@Component({
  selector: 'contacts-screen',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatTableModule, MatTooltipModule, BandAvatarComponent, ScreenHeaderComponent, MatDialogModule],
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
                <button mat-icon-button type="button" matTooltip="Edit" (click)="edit(c); $event.stopPropagation()">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button type="button" color="warn" matTooltip="Delete" (click)="confirmDelete(c); $event.stopPropagation()">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;" class="contact-row" (click)="edit(row)"></tr>
          </table>
        </div>

        <div class="bandos-grid contacts-mobile">
          @for (c of contacts(); track c.id) {
            <mat-card (click)="edit(c)" class="contact-card">
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
    </div>
  `,
  styles: [`
    .name { font-weight: 700; }
    .meta { font-size: 12px; color: #9D9DA7; margin-top: 2px; }

    .contacts-table-wrap { background: #1D1D23; border: 1px solid #2A2A31; border-radius: 12px; overflow: hidden; }
    .contacts-table { width: 100%; background: transparent; }
    .contacts-table th.mat-mdc-header-cell { background: #16161B; color: #9D9DA7; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
    .contacts-table td.mat-mdc-cell, .contacts-table th.mat-mdc-header-cell { border-bottom-color: #2A2A31; color: #E6E6EC; }
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
  `],
})
export class ContactsComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(MatSnackBar);
  contacts = computed(() => this.wsc.workspace()?.contacts ?? []);
  displayedColumns = ['name', 'type', 'phone', 'email', 'actions'];
  typeLabel(t: M.BandContactType) { return M.BandContactTypeLabel[t]; }
  newContact() {
    const ref = this.dialog.open(ContactEditorDialog, { data: {} });
    ref.afterClosed().subscribe(async r => { if (r?.action === 'save') await this.wsc.saveContact(r.contact); });
  }
  edit(c: M.BandContact) {
    const ref = this.dialog.open(ContactEditorDialog, { data: { contact: c } });
    ref.afterClosed().subscribe(async r => {
      if (r?.action === 'save') await this.wsc.saveContact(r.contact);
      else if (r?.action === 'delete') await this.wsc.deleteContact(c.id);
    });
  }
  async confirmDelete(c: M.BandContact) {
    const ok = window.confirm(`Delete "${c.name}"? This can't be undone.`);
    if (!ok) return;
    await this.wsc.deleteContact(c.id);
    this.snack.open('Contact deleted.', 'OK', { duration: 1800 });
  }
}
