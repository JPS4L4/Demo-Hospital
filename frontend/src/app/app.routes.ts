import { Routes } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './core/auth/auth.guards';

export const routes: Routes = [
  {
    path: '',
    title: 'Meridiana · Red de salud',
    loadComponent: () => import('./features/home/home').then(m => m.Home),
  },
  {
    path: 'citas',
    title: 'Citas · Meridiana',
    loadComponent: () => import('./features/citas/citas').then(m => m.Citas),
  },
  {
    path: 'mis-citas',
    title: 'Mis citas · Meridiana',
    canActivate: [authGuard],
    loadComponent: () => import('./features/citas/mis-citas/mis-citas').then(m => m.MisCitas),
  },
  {
    path: 'ingresar',
    title: 'Ingresar · Meridiana',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then(m => m.Login),
  },
  {
    path: 'registro',
    title: 'Crear cuenta · Meridiana',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/registro/registro').then(m => m.Registro),
  },
  {
    path: 'admin',
    title: 'Panel · Meridiana',
    canActivate: [adminGuard],
    loadChildren: () => import('./features/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  },
  {
    path: 'medicamentos',
    title: 'Medicamentos · Meridiana',
    loadComponent: () => import('./features/medicamentos/medicamentos').then(m => m.Medicamentos),
  },
  {
    path: 'profesionales',
    title: 'Profesionales · Meridiana',
    loadComponent: () => import('./features/profesionales/profesionales').then(m => m.Profesionales),
  },
  {
    path: 'profesionales/:id',
    title: 'Profesional · Meridiana',
    loadComponent: () =>
      import('./features/profesionales/profesional-detalle/profesional-detalle').then(m => m.ProfesionalDetalle),
  },
  {
    path: 'noticias',
    title: 'Noticias · Meridiana',
    loadComponent: () => import('./features/noticias/noticias').then(m => m.Noticias),
  },
  {
    path: 'noticias/:id',
    title: 'Noticia · Meridiana',
    loadComponent: () =>
      import('./features/noticias/noticia-detalle/noticia-detalle').then(m => m.NoticiaDetalle),
  },
  {
    path: 'sedes',
    title: 'Sedes · Meridiana',
    loadComponent: () => import('./features/sedes/sedes').then(m => m.Sedes),
  },
  {
    path: '**',
    title: 'Página no encontrada · Meridiana',
    loadComponent: () => import('./features/not-found/not-found').then(m => m.NotFound),
  },
];
