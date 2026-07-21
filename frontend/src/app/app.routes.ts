import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
  },
  {
    path: 'citas',
    loadComponent: () => import('./features/citas/citas').then(m => m.Citas),
  },
  {
    path: 'medicamentos',
    loadComponent: () => import('./features/medicamentos/medicamentos').then(m => m.Medicamentos),
  },
  {
    path: 'profesionales',
    loadComponent: () => import('./features/profesionales/profesionales').then(m => m.Profesionales),
  },
  {
    path: 'noticias',
    loadComponent: () => import('./features/noticias/noticias').then(m => m.Noticias),
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFound),
  },
];