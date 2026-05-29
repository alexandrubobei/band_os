import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthController } from '../../core/state/auth-controller.service';
import { AuthFrameComponent } from './auth-frame.component';

@Component({
  selector: 'sign-in',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink, AuthFrameComponent,
    MatFormFieldModule, MatInputModule, MatCheckboxModule, MatButtonModule, MatProgressSpinnerModule,
  ],
  template: `
    <auth-frame subtitle="Rehearsals, shows, songs, tasks, and releases in one place.">
      <form [formGroup]="form" (ngSubmit)="submit()" class="bandos-stack">
        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" autocomplete="email" />
          @if (form.controls.email.invalid && form.controls.email.touched) {
            <mat-error>Enter a valid email address.</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Password</mat-label>
          <input matInput type="password" formControlName="password" autocomplete="current-password" />
          @if (form.controls.password.invalid && form.controls.password.touched) {
            <mat-error>Enter your password.</mat-error>
          }
        </mat-form-field>

        <mat-checkbox formControlName="rememberMe">Remember me</mat-checkbox>

        @if (errorMessage()) {
          <div style="color:#E8B246;font-size:14px;">{{ errorMessage() }}</div>
        }

        <button mat-flat-button color="primary" type="submit" [disabled]="submitting()" style="height:48px;">
          @if (submitting()) { <mat-spinner diameter="20"></mat-spinner> } @else { Sign in }
        </button>

        <button mat-button type="button" [disabled]="submitting()" routerLink="/forgot-password">Forgot password?</button>
        <button mat-stroked-button type="button" [disabled]="submitting()" routerLink="/register" style="height:48px;">Create a new account</button>
      </form>
    </auth-frame>
  `,
})
export class SignInComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthController);
  private readonly router = inject(Router);

  readonly submitting = signal(false);
  readonly errorMessage = signal<string | null>(null);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  constructor() {
    void this.restore();
    // Sign out any stale session per Flutter behavior.
    if (this.auth.user) void this.auth.signOut();
  }

  private async restore(): Promise<void> {
    const rememberMe = await (this.auth as any).repo?.loadRememberedEmailPreference?.() ?? this.auth.rememberEmailPreference();
    const rememberedEmail = await (this.auth as any).repo?.loadRememberedEmail?.() ?? this.auth.rememberedEmail();
    this.form.patchValue({ rememberMe: !!rememberMe, email: rememberMe ? (rememberedEmail ?? '') : '' });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.errorMessage.set(null);
    try {
      const { email, password, rememberMe } = this.form.getRawValue();
      await this.auth.signIn({ email, password, rememberEmail: rememberMe });
      await this.router.navigate(['/loading']);
    } catch (err: any) {
      this.errorMessage.set(err?.message ?? 'Could not sign in.');
    } finally {
      this.submitting.set(false);
    }
  }
}
