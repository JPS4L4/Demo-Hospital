import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService, safeReturnUrl } from './auth.service';

/** Exige sesión; si no hay, lleva a `/ingresar` recordando a dónde volver. */
export const authGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  return auth.usuario() ? true : router.createUrlTree(['/ingresar'], { queryParams: { returnUrl: state.url } });
};

/** Exige rol admin; un paciente vuelve al inicio, un visitante va a `/ingresar`. */
export const adminGuard: CanActivateFn = async (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.usuario()) return router.createUrlTree(['/ingresar'], { queryParams: { returnUrl: state.url } });
  return auth.isAdmin() ? true : router.createUrlTree(['/']);
};

/** Para `/ingresar` y `/registro`: quien ya tiene sesión no necesita verlas. */
export const guestGuard: CanActivateFn = async (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  await auth.whenReady();
  if (!auth.usuario()) return true;
  const target = safeReturnUrl(route.queryParamMap.get('returnUrl'));
  return router.parseUrl(target ?? '/');
};
