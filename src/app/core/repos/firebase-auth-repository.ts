import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  createUserWithEmailAndPassword, deleteUser, EmailAuthProvider, onAuthStateChanged,
  reauthenticateWithCredential, sendEmailVerification, sendPasswordResetEmail,
  signInWithEmailAndPassword, signOut as fbSignOut, updateProfile, User,
} from 'firebase/auth';
import * as M from '../models/models';
import { getFirebase } from '../firebase/firebase-bootstrap';
import { AuthRepository, AuthRepositoryException } from './auth-repository';

function fromFirebaseUser(u: User): M.AuthUser {
  return {
    id: u.uid,
    email: u.email ?? '',
    displayName: u.displayName ?? '',
    emailVerified: u.emailVerified,
    createdAt: u.metadata.creationTime ? new Date(u.metadata.creationTime) : new Date(),
    lastVerificationEmailAt: null,
  };
}

@Injectable({ providedIn: 'root' })
export class FirebaseAuthRepository implements AuthRepository {
  readonly supportsRemoteEmailActions = true;
  readonly supportsAccountDeletion = true;
  readonly backendLabel = 'Firebase';

  private readonly authSubject = new BehaviorSubject<M.AuthUser | null>(null);

  constructor() {
    const { auth } = getFirebase();
    onAuthStateChanged(auth, (u) => this.authSubject.next(u ? fromFirebaseUser(u) : null));
  }

  authState$(): Observable<M.AuthUser | null> { return this.authSubject.asObservable(); }

  async restoreSession(): Promise<M.AuthUser | null> {
    const { auth } = getFirebase();
    await auth.authStateReady();
    const u = auth.currentUser;
    return u ? fromFirebaseUser(u) : null;
  }

  async signIn({ email, password, rememberEmail }: { email: string; password: string; rememberEmail: boolean }): Promise<M.AuthUser> {
    const { auth } = getFirebase();
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      if (rememberEmail) localStorage.setItem('bandos.firebase.rememberedEmail', email.trim().toLowerCase());
      else localStorage.removeItem('bandos.firebase.rememberedEmail');
      localStorage.setItem('bandos.firebase.rememberEmail', rememberEmail ? '1' : '0');
      return fromFirebaseUser(cred.user);
    } catch (err: any) {
      throw new AuthRepositoryException(humanizeAuthError(err) ?? 'Email or password is incorrect.');
    }
  }

  async signUp({ displayName, email, password }: { displayName: string; email: string; password: string }): Promise<M.AuthUser> {
    const { auth } = getFirebase();
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
      await updateProfile(cred.user, { displayName: displayName.trim() });
      await sendEmailVerification(cred.user);
      return fromFirebaseUser(cred.user);
    } catch (err: any) {
      throw new AuthRepositoryException(humanizeAuthError(err) ?? 'Could not create your account.');
    }
  }

  async loadPendingSignUpDraft(): Promise<M.SignUpDraft | null> { return null; }
  async finalizePendingSignUp(): Promise<void> { /* */ }

  async loadRememberedEmail(): Promise<string | null> { return localStorage.getItem('bandos.firebase.rememberedEmail'); }
  async loadRememberedEmailPreference(): Promise<boolean> { return localStorage.getItem('bandos.firebase.rememberEmail') === '1'; }

  async signOut(): Promise<void> {
    const { auth } = getFirebase();
    await fbSignOut(auth);
  }

  async sendPasswordReset({ email }: { email: string }): Promise<M.ActionResult> {
    const { auth } = getFirebase();
    try {
      await sendPasswordResetEmail(auth, email.trim().toLowerCase());
      return M.ActionResult.success('Reset email sent if an account exists for that address.');
    } catch (err: any) {
      return M.ActionResult.failure(humanizeAuthError(err) ?? 'Could not send a reset email.');
    }
  }

  async sendVerificationEmail(): Promise<M.ActionResult> {
    const { auth } = getFirebase();
    const u = auth.currentUser;
    if (!u) return M.ActionResult.failure('You need to be signed in first.');
    try {
      await sendEmailVerification(u);
      return M.ActionResult.success('Verification email sent.');
    } catch (err: any) {
      return M.ActionResult.failure(humanizeAuthError(err) ?? 'Could not send the verification email.');
    }
  }

  async refreshCurrentUser(): Promise<M.AuthUser | null> {
    const { auth } = getFirebase();
    if (auth.currentUser) await auth.currentUser.reload();
    const u = auth.currentUser;
    const next = u ? fromFirebaseUser(u) : null;
    this.authSubject.next(next);
    return next;
  }

  async deleteAccount({ currentPassword }: { currentPassword: string }): Promise<M.ActionResult> {
    const { auth } = getFirebase();
    const u = auth.currentUser;
    if (!u || !u.email) return M.ActionResult.failure('You need to be signed in first.');
    try {
      const credential = EmailAuthProvider.credential(u.email, currentPassword);
      await reauthenticateWithCredential(u, credential);
      await deleteUser(u);
      return M.ActionResult.success('Account deleted.');
    } catch (err: any) {
      return M.ActionResult.failure(humanizeAuthError(err) ?? 'Could not delete account.');
    }
  }
}

function humanizeAuthError(err: any): string | null {
  const code: string | undefined = err?.code;
  if (!code) return null;
  switch (code) {
    case 'auth/invalid-email': return 'That email is not valid.';
    case 'auth/user-disabled': return 'That account has been disabled.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential': return 'Email or password is incorrect.';
    case 'auth/email-already-in-use': return 'An account already exists for that email.';
    case 'auth/weak-password': return 'Password is too weak. Try at least 8 characters.';
    case 'auth/requires-recent-login': return 'Please sign in again before doing that.';
    case 'auth/network-request-failed': return 'Network unavailable. Try again.';
  }
  return null;
}
