import { HttpParams } from '@angular/common/http';

/** Respuesta paginada de la API: `{ items, total, limit, offset }`. */
export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Arma los query params omitiendo los valores vacíos (`null`, `undefined` o texto en blanco). */
export function toHttpParams(values: Record<string, string | number | boolean | null | undefined>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    params = params.set(key, String(value));
  }
  return params;
}

/** Lee un entero positivo de un query param de la URL; `null` si no es válido. */
export function positiveInt(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const n = Number(value);
  return n > 0 ? n : null;
}
