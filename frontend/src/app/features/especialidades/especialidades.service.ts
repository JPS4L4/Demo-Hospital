import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { Page, toHttpParams } from '../../core/page';
import { Especialidad } from './especialidad.model';

@Injectable({ providedIn: 'root' })
export class EspecialidadesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/especialidades`;

  /** Todas las especialidades (el catálogo es corto, cabe en una sola página de 100). */
  listar(): Observable<Especialidad[]> {
    return this.http
      .get<Page<Especialidad>>(this.baseUrl, { params: toHttpParams({ limit: 100 }) })
      .pipe(map((page) => page.items));
  }
}
