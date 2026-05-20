import { Routes } from '@angular/router';
import { bandosRedirectGuard } from './core/state/router-guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'loading' },
  {
    path: 'loading',
    loadComponent: () => import('./features/home/loading.component').then(m => m.LoadingScreenComponent),
    canActivate: [bandosRedirectGuard],
  },
  {
    path: 'sign-in',
    loadComponent: () => import('./features/auth/sign-in.component').then(m => m.SignInComponent),
    canActivate: [bandosRedirectGuard],
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/register.component').then(m => m.RegisterComponent),
    canActivate: [bandosRedirectGuard],
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password.component').then(m => m.ForgotPasswordComponent),
    canActivate: [bandosRedirectGuard],
  },
  {
    path: 'band-setup',
    loadComponent: () => import('./features/onboarding/band-setup.component').then(m => m.BandSetupComponent),
    canActivate: [bandosRedirectGuard],
  },
  {
    path: 'join-pending',
    loadComponent: () => import('./features/onboarding/pending-approval.component').then(m => m.PendingApprovalComponent),
    canActivate: [bandosRedirectGuard],
  },
  {
    path: 'app',
    loadComponent: () => import('./features/home/app-shell.component').then(m => m.AppShellComponent),
    canActivate: [bandosRedirectGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'songs', loadComponent: () => import('./features/songs/songs.component').then(m => m.SongsComponent) },
      { path: 'releases', loadComponent: () => import('./features/songs/releases.component').then(m => m.ReleasesComponent) },
      { path: 'setlists', loadComponent: () => import('./features/setlists/setlists.component').then(m => m.SetlistsComponent) },
      { path: 'tasks', loadComponent: () => import('./features/tasks/tasks.component').then(m => m.TasksComponent) },
      { path: 'calendar', loadComponent: () => import('./features/calendar/calendar.component').then(m => m.CalendarComponent) },
      { path: 'contacts', loadComponent: () => import('./features/contacts/contacts.component').then(m => m.ContactsComponent) },
      { path: 'riders', loadComponent: () => import('./features/riders/riders.component').then(m => m.RidersComponent) },
      { path: 'finances', loadComponent: () => import('./features/finances/finances.component').then(m => m.FinancesComponent) },
      { path: 'band', loadComponent: () => import('./features/band/band.component').then(m => m.BandComponent) },
    ],
  },
  { path: '**', redirectTo: 'loading' },
];
