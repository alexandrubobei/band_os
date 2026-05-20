import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthController } from './auth-controller.service';
import { WorkspaceController } from './workspace-controller.service';
import { AsyncState } from './async-state';

/**
 * Mirrors the Flutter GoRouter redirect:
 *  - if auth or workspace are loading -> /loading
 *  - if not authenticated -> /sign-in
 *  - if user has a current workspace -> /app
 *  - if pending join request -> /join-pending
 *  - else -> /band-setup
 */
export const bandosRedirectGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthController);
  const ws = inject(WorkspaceController);
  const router = inject(Router);

  const location = state.url.split('?')[0];
  const onLoading = location === '/loading';
  const onSignIn = location === '/sign-in';
  const onRegister = location.startsWith('/register');
  const onForgot = location.startsWith('/forgot-password');
  const onAuth = onSignIn || onRegister || onForgot;
  const onBandSetup = location.startsWith('/band-setup');
  const onPending = location.startsWith('/join-pending');
  const onApp = location.startsWith('/app');

  const authState = auth.state();
  const wsState = ws.state();
  const pendingState = ws.pendingAccess();

  if (authState.kind === 'loading' || wsState.kind === 'loading') {
    return onLoading ? true : router.parseUrl('/loading');
  }

  const user = AsyncState.valueOrNull(authState);
  if (!user) {
    return onAuth ? true : router.parseUrl('/sign-in');
  }

  const workspace = AsyncState.valueOrNull(wsState);
  if (workspace) {
    if (onLoading || onAuth || onBandSetup || onPending) return router.parseUrl('/app/dashboard');
    return true;
  }

  if (pendingState.kind === 'loading') {
    return onLoading ? true : router.parseUrl('/loading');
  }

  const pending = AsyncState.valueOrNull(pendingState);
  if (pending) {
    return onPending ? true : router.parseUrl('/join-pending');
  }

  if (onApp) return router.parseUrl('/band-setup');
  return true;
};
