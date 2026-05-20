import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthController } from '../../core/state/auth-controller.service';
import { AuthFrameComponent } from './auth-frame.component';

@Component({
  selector: 'register-screen',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, AuthFrameComponent,
    MatFormFieldModule, MatInputModule, MatButtonModule, MatProgressSpinnerModule,
  ],
  template: `
    <auth-frame title="Create your BandOS account" subtitle="One workspace per band, free to start.">
      <form [formGroup]="form" (ngSubmit)="submit()" class="bandos-stack">
        <mat-form-field appearance="fill">
          <mat-label>Display name</mat-label>
          <input matInput formControlName="displayName" autocomplete="name" />
        </mat-form-field>

        <mat-form-field appearance="fill">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
        </mat-form-field>

        <mat-form-field appearance="fill">
          <mat-label>Password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="new-password" />
          <mat-hint>At least 8 characters.</mat-hint>
        </mat-form-field>

        @if (errorMessage()) {
          <div style="color:#E8B246;font-size:14px;">{{ errorMessage() }}</div>
        }

        <button mat-flat-button color="primary" type="submit" [disabled]="submitting()" style="height:48px;">
          @if (submitting()) { <mat-spinner diameter="20"></mat-spinner> } @else { Create account }
        </button>
        <button mat-button type="button" routerLink="/sign-in">I already have an account</button>
      </form>
    </auth-frame>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthController);
  private readonly router = inject(Router);

  submitting = signal(false);
  errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
  });

  async submit(): Promise<void> {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      await this.auth.signUp(this.form.getRawValue());
      await this.router.navigate(['/band-setup'], { queryParams: { mode: 'create' } });
    } catch (err: any) {
      this.errorMessage.set(err?.message ?? 'Could not create your account.');
    } finally {
      this.submitting.set(false);
    }
  }
}
