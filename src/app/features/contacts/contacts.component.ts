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
      @if (existing) { <button mat-button color="warn" (click)="remove()">Delete</button> }
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
  imports: [CommonModule, MatButtonModule, MatCardModule, BandAvatarComponent, ScreenHeaderComponent, MatDialogModule],
  template: `
    <div class="bandos-page">
      <screen-header title="Contacts" subtitle="Venues, promoters, photographers, and more."></screen-header>
      <div class="bandos-toolbar">
        <button mat-flat-button color="primary" (click)="newContact()">+ New contact</button>
      </div>
      @if (contacts().length === 0) {
        <p class="bandos-muted">No contacts yet.</p>
      } @else {
        <div class="bandos-grid">
          @for (c of contacts(); track c.id) {
            <mat-card (click)="edit(c)" style="cursor:pointer;display:flex;gap:12px;align-items:flex-start;">
              <band-avatar [displayName]="c.name" [size]="44"></band-avatar>
              <div style="flex:1;">
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
  `],
})
export class ContactsComponent {
  private readonly wsc = inject(WorkspaceController);
  private readonly dialog = inject(MatDialog);
  contacts = computed(() => this.wsc.workspace()?.contacts ?? []);
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
}
