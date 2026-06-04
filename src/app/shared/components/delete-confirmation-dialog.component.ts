import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';

export interface DeleteConfirmationData {
  title: string; // e.g., "Delete Song?"
  item: string; // e.g., "Wish You Were Here"
  message?: string; // Optional additional context/warning
  impact?: string[]; // Optional array of impacts, e.g., ["This song is in 2 setlists"]
}

@Component({
  selector: 'delete-confirmation-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatIconModule, MatDialogModule],
  template: `
    <div class="dialog-container">
      <div class="dialog-icon">
        <mat-icon>delete_outline</mat-icon>
      </div>
      <h2 class="dialog-title">{{ data.title }}</h2>
      <div class="dialog-item">{{ data.item }}</div>
      @if (data.message) {
        <p class="dialog-message">{{ data.message }}</p>
      }
      @if (data.impact && data.impact.length > 0) {
        <div class="impact-section">
          @for (impact of data.impact; track $index) {
            <div class="impact-item">{{ impact }}</div>
          }
        </div>
      }
      <p class="dialog-warning">This action cannot be undone.</p>
      <div class="dialog-actions">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-flat-button color="warn" (click)="onConfirm()">Delete</button>
      </div>
    </div>
  `,
  styles: [`
    .dialog-container {
      padding: 24px;
      max-width: 360px;
      text-align: center;
    }
    .dialog-icon {
      display: flex;
      justify-content: center;
      margin-bottom: 16px;
    }
    .dialog-icon mat-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: #EF4A35;
    }
    .dialog-title {
      margin: 0 0 12px;
      font-size: 18px;
      font-weight: 800;
      color: #CDCDD3;
    }
    .dialog-item {
      font-size: 15px;
      font-weight: 700;
      color: #CDCDD3;
      margin-bottom: 8px;
      word-break: break-word;
    }
    .dialog-message {
      margin: 12px 0;
      font-size: 13px;
      color: #C7C7CF;
    }
    .impact-section {
      margin: 12px 0;
      padding: 12px;
      background: rgba(239, 74, 53, 0.1);
      border-radius: 8px;
      text-align: left;
    }
    .impact-item {
      font-size: 12px;
      color: #CDCDD3;
      margin: 4px 0;
      padding-left: 16px;
      position: relative;
    }
    .impact-item::before {
      content: '•';
      position: absolute;
      left: 0;
      color: #EF4A35;
    }
    .dialog-warning {
      margin: 16px 0 20px;
      font-size: 12px;
      color: #C8A77B;
      font-weight: 600;
    }
    .dialog-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }
  `],
})
export class DeleteConfirmationDialog {
  private readonly dialogRef = inject(MatDialogRef<DeleteConfirmationDialog>);
  readonly data = inject(MAT_DIALOG_DATA) as DeleteConfirmationData;

  onCancel(): void {
    this.dialogRef.close(false);
  }

  onConfirm(): void {
    this.dialogRef.close(true);
  }
}
