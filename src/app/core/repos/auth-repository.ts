import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';
import * as M from '../models/models';

export class AuthRepositoryException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthRepositoryException';
  }
}

export interface AuthRepository {
  readonly supportsRemoteEmailActions: boolean;
  readonly supportsAccountDeletion: boolean;
  readonly backendLabel: string;

  restoreSession(): Promise<M.AuthUser | null>;
  signIn(input: { email: string; password: string; rememberEmail: boolean }): Promise<M.AuthUser>;
  signUp(input: { displayName: string; email: string; password: string }): Promise<M.AuthUser>;
  loadPendingSignUpDraft(): Promise<M.SignUpDraft | null>;
  finalizePendingSignUp(): Promise<void>;
  loadRememberedEmail(): Promise<string | null>;
  loadRememberedEmailPreference(): Promise<boolean>;
  signOut(): Promise<void>;
  sendPasswordReset(input: { email: string }): Promise<M.ActionResult>;
  sendVerificationEmail(): Promise<M.ActionResult>;
  refreshCurrentUser(): Promise<M.AuthUser | null>;
  deleteAccount(input: { currentPassword: string }): Promise<M.ActionResult>;
  authState$(): Observable<M.AuthUser | null>;
}

export const AUTH_REPOSITORY = new InjectionToken<AuthRepository>('bandos.AuthRepository');
