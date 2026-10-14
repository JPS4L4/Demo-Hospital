import { HttpErrorResponse } from '@angular/common/http';
import { Observable, catchError, map, of, startWith } from 'rxjs';

/** Estado de una petición para pintar carga, error o contenido sin ramas especiales. */
export type Remote<T> =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; data: T };

export const LOADING: Remote<never> = { status: 'loading' };

export function toRemote<T>(source: Observable<T>): Observable<Remote<T>> {
  return source.pipe(
    map((data): Remote<T> => ({ status: 'ready', data })),
    startWith(LOADING as Remote<T>),
    catchError((err: unknown) =>
      of<Remote<T>>(err instanceof HttpErrorResponse && err.status === 404 ? { status: 'not-found' } : { status: 'error' }),
    ),
  );
}
