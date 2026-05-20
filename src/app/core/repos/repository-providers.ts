import { Provider } from '@angular/core';
import { environment } from '../../../environments/environment';
import { AUTH_REPOSITORY, AuthRepository } from './auth-repository';
import { WORKSPACE_REPOSITORY, WorkspaceRepository } from './workspace-repository';
import { LocalAuthRepository } from './local-auth-repository';
import { LocalWorkspaceRepository } from './local-workspace-repository';
import { FirebaseAuthRepository } from './firebase-auth-repository';
import { FirebaseWorkspaceRepository } from './firebase-workspace-repository';

export function provideBandosRepositories(): Provider[] {
  if (environment.useFirebase) {
    return [
      FirebaseAuthRepository,
      FirebaseWorkspaceRepository,
      { provide: AUTH_REPOSITORY, useExisting: FirebaseAuthRepository },
      { provide: WORKSPACE_REPOSITORY, useExisting: FirebaseWorkspaceRepository },
    ];
  }
  return [
    LocalAuthRepository,
    LocalWorkspaceRepository,
    { provide: AUTH_REPOSITORY, useExisting: LocalAuthRepository },
    { provide: WORKSPACE_REPOSITORY, useExisting: LocalWorkspaceRepository },
  ];
}

export { AUTH_REPOSITORY, WORKSPACE_REPOSITORY };
export type { AuthRepository, WorkspaceRepository };
