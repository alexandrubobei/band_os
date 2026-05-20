import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthController } from '../../core/state/auth-controller.service';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { JoinWorkspaceOutcome } from '../../core/models/models';
import { DEMO_BAND_NAME, DEMO_GENRE, DEMO_INVITE_CODE } from '../../core/demo/demo-workspace-seed';

@Component({
  selector: 'band-setup',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, MatButtonModule, MatButtonToggleModule,
    MatFormFieldModule, MatInputModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="wrap">
      <div class="container">
        <button mat-icon-button (click)="back()" aria-label="Back" style="margin-left:-8px;">←</button>
        <div class="title-sm">Band setup</div>
        <h1>Get the band in</h1>
        <p class="bandos-muted">Create a workspace or join with an invite code.</p>

        <mat-button-toggle-group [value]="mode()" (change)="mode.set($event.value)" hideSingleSelectionIndicator>
          <mat-button-toggle value="create">Create</mat-button-toggle>
          <mat-button-toggle value="join">Join</mat-button-toggle>
        </mat-button-toggle-group>

        <div class="bandos-card">
          @if (mode() === 'create') {
            <form [formGroup]="createForm" (ngSubmit)="submitCreate()" class="bandos-stack">
              <mat-form-field appearance="fill">
                <mat-label>Band name</mat-label>
                <input matInput formControlName="bandName" />
              </mat-form-field>
              <mat-form-field appearance="fill">
                <mat-label>Genre</mat-label>
                <input matInput formControlName="genre" />
              </mat-form-field>
              @if (error()) { <div style="color:#E8B246;font-size:14px;">{{ error() }}</div> }
              <button mat-flat-button color="primary" type="submit" [disabled]="submitting()" style="height:48px;">
                @if (submitting()) { <mat-spinner diameter="20"></mat-spinner> } @else { Create workspace }
              </button>
            </form>
          } @else {
            <form [formGroup]="joinForm" (ngSubmit)="submitJoin()" class="bandos-stack">
              <mat-form-field appearance="fill">
                <mat-label>Invite code</mat-label>
                <input matInput formControlName="inviteCode" />
                <mat-hint>Try {{ demoCode }} to join the demo band.</mat-hint>
              </mat-form-field>
              @if (error()) { <div style="color:#E8B246;font-size:14px;">{{ error() }}</div> }
              <button mat-flat-button color="primary" type="submit" [disabled]="submitting()" style="height:48px;">
                @if (submitting()) { <mat-spinner diameter="20"></mat-spinner> } @else { Request to join }
              </button>
            </form>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height: 100vh; display: flex; justify-content: center; padding: 24px; background: #0B0B0D; }
    .container { width: 100%; max-width: 460px; display: flex; flex-direction: column; gap: 14px; }
    .title-sm { font-size: 14px; color: #9D9DA7; }
    h1 { font-size: 30px; font-weight: 800; margin: 4px 0; }
    .bandos-muted { color: #B7B7BE; margin: 0; font-size: 14px; }
  `],
})
export class BandSetupComponent {
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthController);
  private readonly ws = inject(WorkspaceController);
  private readonly snack = inject(MatSnackBar);

  demoCode = DEMO_INVITE_CODE;
  mode = signal<'create' | 'join'>('create');
  submitting = signal(false);
  error = signal<string | null>(null);

  createForm = this.fb.nonNullable.group({
    bandName: [DEMO_BAND_NAME, [Validators.required, Validators.minLength(2)]],
    genre: [DEMO_GENRE, [Validators.required, Validators.minLength(2)]],
  });
  joinForm = this.fb.nonNullable.group({
    inviteCode: [DEMO_INVITE_CODE, [Validators.required, Validators.minLength(4)]],
  });

  constructor() {
    const initial = this.route.snapshot.queryParamMap.get('mode');
    if (initial === 'join') this.mode.set('join');
  }

  async submitCreate(): Promise<void> {
    if (this.createForm.invalid) { this.createForm.markAllAsTouched(); return; }
    this.submitting.set(true); this.error.set(null);
    try {
      const { bandName, genre } = this.createForm.getRawValue();
      await this.ws.createWorkspace({ bandName, genre });
      this.router.navigate(['/app/dashboard']);
    } catch (err: any) {
      this.error.set(err?.message ?? 'Could not create workspace.');
    } finally {
      this.submitting.set(false);
    }
  }

  async submitJoin(): Promise<void> {
    if (this.joinForm.invalid) { this.joinForm.markAllAsTouched(); return; }
    this.submitting.set(true); this.error.set(null);
    try {
      const inviteCode = this.joinForm.controls.inviteCode.value;
      const result = await this.ws.joinWorkspace(inviteCode);
      if (result.outcome === JoinWorkspaceOutcome.joinedWorkspace) {
        this.router.navigate(['/app/dashboard']);
      } else {
        this.snack.open('Join request sent. An admin will review it.', 'OK', { duration: 3500 });
        this.router.navigate(['/join-pending']);
      }
    } catch (err: any) {
      this.error.set(err?.message ?? 'Could not join workspace.');
    } finally {
      this.submitting.set(false);
    }
  }

  async back(): Promise<void> {
    await this.auth.signOut();
    this.router.navigate(['/sign-in']);
  }
}
