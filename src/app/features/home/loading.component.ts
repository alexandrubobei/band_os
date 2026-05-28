import { Component, effect, inject } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthController } from '../../core/state/auth-controller.service';
import { WorkspaceController } from '../../core/state/workspace-controller.service';
import { AsyncState } from '../../core/state/async-state';
import { BandosFullLogoComponent } from '../../shared/components/bandos-full-logo.component';

@Component({
  selector: 'loading-screen',
  standalone: true,
  imports: [BandosFullLogoComponent],
  template: `
    <div class="wrap">
      <div class="pulse">
        <bandos-full-logo [width]="280" [height]="116"></bandos-full-logo>
      </div>
      <div class="dots">
        <span></span><span></span><span></span>
      </div>
    </div>
  `,
  styles: [`
    .wrap {
      min-height: 100vh; display: flex; flex-direction: column; gap: 22px;
      align-items: center; justify-content: center; background: #050506;
    }
    .pulse { animation: pulse 1.6s ease-in-out infinite alternate; }
    @keyframes pulse {
      0% { opacity: 0.85; transform: scale(0.988); filter: drop-shadow(0 0 20px rgba(239,74,53,0.18)); }
      100% { opacity: 1.0; transform: scale(1.008); filter: drop-shadow(0 0 36px rgba(239,74,53,0.32)); }
    }
    .dots { display: flex; gap: 10px; }
    .dots span {
      width: 7px; height: 7px; border-radius: 50%; background: #F3B56C;
      animation: bounce 1.4s ease-in-out infinite;
    }
    .dots span:nth-child(2) { animation-delay: 0.2s; }
    .dots span:nth-child(3) { animation-delay: 0.4s; }
    @keyframes bounce {
      0%, 100% { transform: scale(0.8); opacity: 0.3; }
      50% { transform: scale(1.1); opacity: 1.0; }
    }
  `],
})
export class LoadingScreenComponent {
  private readonly auth = inject(AuthController);
  private readonly ws = inject(WorkspaceController);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  constructor() {
    effect(() => {
      const authState = this.auth.state();
      const wsState = this.ws.state();
      const pendingState = this.ws.pendingAccess();

      if (authState.kind === 'loading') return;

      const user = AsyncState.valueOrNull(authState);
      if (!user) {
        this.router.navigateByUrl('/sign-in');
        return;
      }

      if (wsState.kind === 'loading') return;
      const workspace = AsyncState.valueOrNull(wsState);
      if (workspace) {
        this.router.navigateByUrl(this.resolveNext('/app/dashboard'));
        return;
      }

      if (pendingState.kind === 'loading') return;
      const pending = AsyncState.valueOrNull(pendingState);
      if (pending) {
        this.router.navigateByUrl('/join-pending');
        return;
      }

      this.router.navigateByUrl('/band-setup');
    });
  }

  /** Returns the `next` query param if it points at an /app route, else the fallback. */
  private resolveNext(fallback: string): string {
    const next = this.route.snapshot.queryParamMap.get('next');
    if (next && next.startsWith('/app')) return next;
    return fallback;
  }
}
