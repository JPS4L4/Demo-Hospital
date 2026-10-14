import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api';
import { AuthService, isProtectedUrl } from './auth.service';

/**
 * Añade `Authorization: Bearer` solo a las peticiones hacia la API propia y reacciona al 401:
 * limpia la sesión y, si el usuario está en una página protegida, lo lleva a `/ingresar`.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const base = inject(API_BASE_URL);
  if (req.url !== base && !req.url.startsWith(base + '/')) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const token = auth.token();
  const outgoing = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(outgoing).pipe(
    catchError((err: unknown) => {
      // Un 401 de /auth/login es "credenciales incorrectas", no una sesión vencida.
      const sessionRejected =
        err instanceof HttpErrorResponse && err.status === 401 && !!token && !req.url.endsWith('/auth/login');
      if (sessionRejected) {
        auth.clear();
        const current = router.url;
        if (isProtectedUrl(current)) {
          void router.navigate(['/ingresar'], { queryParams: { returnUrl: current, sesion: 'expirada' } });
        }
      }
      return throwError(() => err);
    }),
  );
};
