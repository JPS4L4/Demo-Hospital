import { HttpErrorResponse } from '@angular/common/http';
import { Signal, linkedSignal } from '@angular/core';
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

/** Estado con la última respuesta mantenida mientras llega la siguiente (`stale`), para no parpadear al filtrar. */
export type WithStale<T> = Remote<T> & { stale?: boolean };

/**
 * Mientras `source` vuelve a cargar, conserva el último resultado listo marcado como `stale`.
 * Un error o un 404 sí sustituyen al resultado anterior.
 */
export function keepPrevious<T>(source: Signal<Remote<T>>): Signal<WithStale<T>> {
  return linkedSignal<Remote<T>, WithStale<T>>({
    source,
    computation: (next, previous) =>
      next.status === 'loading' && previous?.value.status === 'ready'
        ? { status: 'ready', data: previous.value.data, stale: true }
        : next,
  });
}
