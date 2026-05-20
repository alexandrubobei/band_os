import { Injectable, inject, signal } from '@angular/core';
import * as M from '../models/models';
import { AUTH_REPOSITORY, AuthRepository } from '../repos/auth-repository';
import { AsyncState } from './async-state';

@Injectable({ providedIn: 'root' })
export class AuthController {
  private readonly repo = inject(AUTH_REPOSITORY) as AuthRepository;

  readonly state = signal<AsyncState<M.AuthUser | null>>(AsyncState.loading());
  readonly rememberedEmail = signal<string | null>(null);
  readonly rememberEmailPreference = signal<boolean>(false);

  constructor() {
    void this.bootstrap();
    this.repo.authState$().subscribe(u => this.state.set(AsyncState.data(u)));
  }

  get user(): M.AuthUser | null { return AsyncState.valueOrNull(this.state()); }
  get backendLabel(): string { return this.repo.backendLabel; }
  get supportsRemoteEmailActions(): boolean { return this.repo.supportsRemoteEmailActions; }
  get supportsAccountDeletion(): boolean { return this.repo.supportsAccountDeletion; }

  private async bootstrap(): Promise<void> {
    try {
      const [email, pref, user] = await Promise.all([
        this.repo.loadRememberedEmail(),
        this.repo.loadRememberedEmailPreference(),
        this.repo.restoreSession(),
      ]);
      this.rememberedEmail.set(email);
      this.rememberEmailPreference.set(pref);
      this.state.set(AsyncState.data(user));
    } catch (err: any) {
      this.state.set(AsyncState.error(err?.message ?? 'Failed to load auth state'));
    }
  }

  async signIn(input: { email: string; password: string; rememberEmail: boolean }): Promise<M.AuthUser> {
    const user = await this.repo.signIn(input);
    this.rememberEmailPreference.set(input.rememberEmail);
    this.rememberedEmail.set(input.rememberEmail ? input.email.trim().toLowerCase() : null);
    this.state.set(AsyncState.data(user));
    return user;
  }

  async signUp(input: { displayName: string; email: string; password: string }): Promise<M.AuthUser> {
    const user = await this.repo.signUp(input);
    this.state.set(AsyncState.data(user));
    return user;
  }

  async signOut(): Promise<void> {
    await this.repo.signOut();
    this.state.set(AsyncState.data(null));
  }

  loadPendingSignUpDraft(): Promise<M.SignUpDraft | null> { return this.repo.loadPendingSignUpDraft(); }
  finalizePendingSignUp(): Promise<void> { return this.repo.finalizePendingSignUp(); }
  sendPasswordReset(email: string): Promise<M.ActionResult> { return this.repo.sendPasswordReset({ email }); }
  sendVerificationEmail(): Promise<M.ActionResult> { return this.repo.sendVerificationEmail(); }
  refresh(): Promise<M.AuthUser | null> { return this.repo.refreshCurrentUser(); }
  deleteAccount(currentPassword: string): Promise<M.ActionResult> { return this.repo.deleteAccount({ currentPassword }); }
}
