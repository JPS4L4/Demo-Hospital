import { Routes } from '@angular/router';

/** Panel de administración: una carcasa con sub-navegación y una sección por hija (carga diferida). */
export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./admin').then((m) => m.Admin),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Resumen · Panel Meridiana',
        loadComponent: () => import('./resumen/resumen').then((m) => m.AdminResumen),
      },
      {
        path: 'agenda',
        title: 'Agenda · Panel Meridiana',
        loadComponent: () => import('./agenda/agenda').then((m) => m.AdminAgenda),
      },
      {
        path: 'analitica',
        title: 'Analítica · Panel Meridiana',
        loadComponent: () => import('./analitica/analitica').then((m) => m.AdminAnalitica),
      },
      {
        path: 'noticias',
        title: 'Noticias · Panel Meridiana',
        loadComponent: () => import('./noticias/admin-noticias').then((m) => m.AdminNoticias),
      },
      {
        path: 'profesionales',
        title: 'Profesionales · Panel Meridiana',
        loadComponent: () =>
          import('./profesionales/admin-profesionales').then((m) => m.AdminProfesionales),
      },
    ],
  },
];
