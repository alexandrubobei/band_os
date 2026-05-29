import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthController } from '../../core/state/auth-controller.service';
import { AuthFrameComponent } from './auth-frame.component';

@Component({
  selector: 'forgot-password',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, AuthFrameComponent,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule,
  ],
  template: `
    <auth-frame title="Reset your password" subtitle="We'll send a reset link if there is an account for that email.">
      <form [formGroup]="form" (ngSubmit)="submit()" class="bandos-stack">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>
        @if (message()) {
          <div style="color:#C8A77B;font-size:14px;">{{ message() }}</div>
        }
        <button mat-flat-button color="primary" type="submit" [disabled]="submitting()" style="height:48px;">
          @if (submitting()) { <mat-spinner diameter="20"></mat-spinner> } @else { Send reset email }
        </button>
        <button mat-button type="button" routerLink="/sign-in">Back to sign in</button>
      </form>
    </auth-frame>
  `,
})
export class ForgotPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthController);

  submitting = signal(false);
  message = signal<string | null>(null);

  form = this.fb.nonNullable.group({ email: ['', [Validators.required, Validators.email]] });

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    try {
      const result = await this.auth.sendPasswordReset(this.form.controls.email.value);
      this.message.set(result.message);
    } finally {
      this.submitting.set(false);
    }
  }
}
