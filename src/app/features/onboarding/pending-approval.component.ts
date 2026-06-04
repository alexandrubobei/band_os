import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { AuthController } from '../../core/state/auth-controller.service';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { AsyncState } from '../../core/state/async-state';

@Component({
  selector: 'pending-approval',
  standalone: true,
  imports: [CommonModule, MatButtonModule],
  template: `
    <div class="wrap">
      <div class="card">
        <h1>Waiting for approval</h1>
        @if (pending()) {
          <p>Your request to join <b>{{ pending()!.bandName }}</b> ({{ pending()!.genre }}) was sent.</p>
          <p class="bandos-muted">An admin needs to accept the request before you can enter the workspace. This page refreshes when something changes.</p>
        } @else {
          <p class="bandos-muted">No pending request. You can try joining another workspace.</p>
        }
        <div style="display:flex;gap:12px;margin-top:14px;flex-wrap:wrap;">
          <button mat-flat-button color="primary" (click)="refresh()">Check again</button>
          <button mat-stroked-button (click)="cancel()">Withdraw and choose another</button>
          <button mat-button (click)="signOut()">Sign out</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; background: #14141A; }
    .card { max-width: 480px; width: 100%; background: #20202A; border: 1px solid #383842; border-radius: 16px; padding: 28px; }
    h1 { margin: 0 0 8px; font-size: 22px; font-weight: 800; }
    .bandos-muted { color: #9D9DA7; }
  `],
})
export class PendingApprovalComponent {
  private readonly ws = inject(WorkspaceController);
  private readonly auth = inject(AuthController);
  private readonly router = inject(Router);

  pending = computed(() => AsyncState.valueOrNull(this.ws.pendingAccess()));

  async refresh() { await this.ws.resolvePendingForStartup(); }

  async cancel() {
    await this.ws.clearDeclinedPendingAccess();
    this.router.navigate(['/band-setup']);
  }

  async signOut() {
    await this.auth.signOut();
    this.router.navigate(['/sign-in']);
  }
}
