import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guard';

/// putanje su na hrvatskom jer se vide u adresnoj traci i dio su sucelja
export const routes: Routes = [
  {
    path: 'prijava',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((m) => m.Login),
  },
  {
    path: 'registracija',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/register/register').then((m) => m.Register),
  },
  {
    // sve iza prijave dijeli okvir s bocnom navigacijom, pa je Shell roditelj s
    // jednim guardom umjesto da se guard ponavlja na svakoj ruti
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'lampe' },
      {
        path: 'lampe',
        loadComponent: () => import('./pages/lamp-list/lamp-list').then((m) => m.LampList),
      },
      {
        // ruta s parametrom - detalj jedne svjetiljke
        path: 'lampe/:id',
        loadComponent: () => import('./pages/lamp-detail/lamp-detail').then((m) => m.LampDetail),
      },
      {
        path: 'karta',
        loadComponent: () => import('./pages/lamp-map/lamp-map').then((m) => m.LampMap),
      },
      {
        path: 'telemetrija',
        loadComponent: () => import('./pages/uplinks/uplinks').then((m) => m.Uplinks),
      },
      {
        path: 'naredbe',
        loadComponent: () => import('./pages/downlinks/downlinks').then((m) => m.Downlinks),
      },
      {
        path: 'korisnici',
        loadComponent: () => import('./pages/users/users').then((m) => m.Users),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
