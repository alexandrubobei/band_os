import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { v4 as uuid } from 'uuid';
import * as M from '../models/models';
import { AuthUserJson } from '../models/json';
import { AuthRepository, AuthRepositoryException } from './auth-repository';

const USERS_KEY = 'bandos.local.users';
const SESSION_USER_ID_KEY = 'bandos.local.sessionUserId';
const REMEMBER_EMAIL_KEY = 'bandos.local.rememberEmail';
const REMEMBERED_EMAIL_KEY = 'bandos.local.rememberedEmail';

interface StoredAccount {
  user: M.AuthUser;
  password: string;
  onboardingCompleted: boolean;
}

function loadAccounts(): StoredAccount[] {
  const raw = localStorage.getItem(USERS_KEY);
  if (!raw) return [];
  try {
    const decoded = JSON.parse(raw) as any[];
    return decoded.map(entry => ({
      user: AuthUserJson.fromJson(entry.user),
      password: entry.password,
      onboardingCompleted: !!entry.onboardingCompleted,
    }));
  } catch {
    return [];
  }
}

function saveAccounts(accounts: StoredAccount[]): void {
  const encoded = accounts.map(a => ({
    user: AuthUserJson.toJson(a.user),
    password: a.password,
    onboardingCompleted: a.onboardingCompleted,
  }));
  localStorage.setItem(USERS_KEY, JSON.stringify(encoded));
}

function ensureSeeded(): void {
  const existing = localStorage.getItem(USERS_KEY);
  if (existing && existing.length > 0) {
    const accounts = loadAccounts();
    const idx = accounts.findIndex(a => a.user.id === 'seed-demo-user');
    if (idx >= 0 && !accounts[idx].user.emailVerified) {
      accounts[idx] = { ...accounts[idx], user: { ...accounts[idx].user, emailVerified: true } };
      saveAccounts(accounts);
    }
    return;
  }
  const demoUser: M.AuthUser = {
    id: 'seed-demo-user',
    email: 'demo@bandos.example',
    displayName: 'Nova Vale',
    emailVerified: true,
    createdAt: new Date(2026, 3, 10),
    lastVerificationEmailAt: null,
  };
  saveAccounts([{ user: demoUser, password: 'bandos123', onboardingCompleted: true }]);
}

@Injectable({ providedIn: 'root' })
export class LocalAuthRepository implements AuthRepository {
  readonly supportsRemoteEmailActions = false;
  readonly supportsAccountDeletion = false;
  readonly backendLabel = 'Local demo mode';

  private readonly authSubject = new BehaviorSubject<M.AuthUser | null>(null);

  constructor() {
    ensureSeeded();
    this.restoreSession().then(u => this.authSubject.next(u));
  }

  authState$(): Observable<M.AuthUser | null> { return this.authSubject.asObservable(); }

  async restoreSession(): Promise<M.AuthUser | null> {
    ensureSeeded();
    const currentUserId = localStorage.getItem(SESSION_USER_ID_KEY);
    if (!currentUserId) return null;
    const accounts = loadAccounts();
    return accounts.find(a => a.user.id === currentUserId)?.user ?? null;
  }

  async signIn(input: { email: string; password: string; rememberEmail: boolean }): Promise<M.AuthUser> {
    const normalizedEmail = input.email.trim().toLowerCase();
    ensureSeeded();
    const accounts = loadAccounts();
    const account = accounts.find(a => a.user.email === normalizedEmail);
    if (!account || account.password !== input.password) {
      throw new AuthRepositoryException('Email or password is incorrect.');
    }
    localStorage.setItem(SESSION_USER_ID_KEY, account.user.id);
    localStorage.setItem(REMEMBER_EMAIL_KEY, input.rememberEmail ? '1' : '0');
    if (input.rememberEmail) {
      localStorage.setItem(REMEMBERED_EMAIL_KEY, normalizedEmail);
    } else {
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    }
    this.authSubject.next(account.user);
    return account.user;
  }

  async signUp(input: { displayName: string; email: string; password: string }): Promise<M.AuthUser> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const trimmedDisplayName = input.displayName.trim();
    ensureSeeded();
    const accounts = loadAccounts();
    const currentUserId = localStorage.getItem(SESSION_USER_ID_KEY);
    const currentDraftIndex = accounts.findIndex(a => a.user.id === currentUserId && !a.onboardingCompleted);

    const conflict = accounts.find(a => {
      if (a.user.email !== normalizedEmail) return false;
      if (currentDraftIndex === -1) return true;
      return a.user.id !== accounts[currentDraftIndex].user.id;
    });
    if (conflict) throw new AuthRepositoryException('An account already exists for that email.');

    if (currentDraftIndex !== -1) {
      const updatedUser: M.AuthUser = { ...accounts[currentDraftIndex].user, displayName: trimmedDisplayName, email: normalizedEmail };
      accounts[currentDraftIndex] = { ...accounts[currentDraftIndex], user: updatedUser, password: input.password };
      saveAccounts(accounts);
      localStorage.setItem(SESSION_USER_ID_KEY, updatedUser.id);
      localStorage.setItem(REMEMBER_EMAIL_KEY, '0');
      localStorage.removeItem(REMEMBERED_EMAIL_KEY);
      this.authSubject.next(updatedUser);
      return updatedUser;
    }

    const user: M.AuthUser = {
      id: uuid(), email: normalizedEmail, displayName: trimmedDisplayName,
      emailVerified: false, createdAt: new Date(), lastVerificationEmailAt: null,
    };
    accounts.push({ user, password: input.password, onboardingCompleted: false });
    saveAccounts(accounts);
    localStorage.setItem(SESSION_USER_ID_KEY, user.id);
    localStorage.setItem(REMEMBER_EMAIL_KEY, '0');
    localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    this.authSubject.next(user);
    return user;
  }

  async loadPendingSignUpDraft(): Promise<M.SignUpDraft | null> {
    ensureSeeded();
    const currentUserId = localStorage.getItem(SESSION_USER_ID_KEY);
    if (!currentUserId) return null;
    const accounts = loadAccounts();
    const draft = accounts.find(a => a.user.id === currentUserId && !a.onboardingCompleted);
    if (!draft) return null;
    return { displayName: draft.user.displayName, email: draft.user.email, password: draft.password };
  }

  async finalizePendingSignUp(): Promise<void> {
    ensureSeeded();
    const currentUserId = localStorage.getItem(SESSION_USER_ID_KEY);
    if (!currentUserId) return;
    const accounts = loadAccounts();
    const idx = accounts.findIndex(a => a.user.id === currentUserId);
    if (idx === -1 || accounts[idx].onboardingCompleted) return;
    accounts[idx] = { ...accounts[idx], onboardingCompleted: true };
    saveAccounts(accounts);
  }

  async loadRememberedEmail(): Promise<string | null> {
    return localStorage.getItem(REMEMBERED_EMAIL_KEY);
  }

  async loadRememberedEmailPreference(): Promise<boolean> {
    return localStorage.getItem(REMEMBER_EMAIL_KEY) === '1';
  }

  async signOut(): Promise<void> {
    const rememberEmail = localStorage.getItem(REMEMBER_EMAIL_KEY) === '1';
    localStorage.removeItem(SESSION_USER_ID_KEY);
    if (!rememberEmail) localStorage.removeItem(REMEMBERED_EMAIL_KEY);
    this.authSubject.next(null);
  }

  async sendPasswordReset(input: { email: string }): Promise<M.ActionResult> {
    const normalizedEmail = input.email.trim().toLowerCase();
    ensureSeeded();
    const accounts = loadAccounts();
    const exists = accounts.some(a => a.user.email === normalizedEmail);
    if (!exists) return M.ActionResult.success('If an account exists for that email, reset instructions have been sent.');
    return M.ActionResult.success('Password reset is simulated in local mode. Switch to Firebase to send a real email.');
  }

  async sendVerificationEmail(): Promise<M.ActionResult> {
    const currentUserId = localStorage.getItem(SESSION_USER_ID_KEY);
    if (!currentUserId) return M.ActionResult.failure('You need to be signed in first.');
    const accounts = loadAccounts();
    const idx = accounts.findIndex(a => a.user.id === currentUserId);
    if (idx === -1) return M.ActionResult.failure('Signed-in account was not found.');
    accounts[idx] = { ...accounts[idx], user: { ...accounts[idx].user, lastVerificationEmailAt: new Date() } };
    saveAccounts(accounts);
    return M.ActionResult.success('Verification email is simulated in local mode. Firebase setup is required for real email delivery.');
  }

  async refreshCurrentUser(): Promise<M.AuthUser | null> {
    const u = await this.restoreSession();
    this.authSubject.next(u);
    return u;
  }

  async deleteAccount(_input: { currentPassword: string }): Promise<M.ActionResult> {
    return M.ActionResult.failure('Account deletion is only available when Firebase Auth is enabled.');
  }
}
