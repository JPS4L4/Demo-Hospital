import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { Page, toHttpParams } from '../../core/page';
import { Profesional, ProfesionalInput } from './profesional.model';

export interface ProfesionalesFiltro {
  q?: string | null;
  especialidadId?: number | null;
  sedeId?: number | null;
  /** Por defecto solo los profesionales activos; `null` trae también los inactivos. */
  activo?: boolean | null;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class ProfesionalesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/profesionales`;

  listar(filtro: ProfesionalesFiltro = {}): Observable<Page<Profesional>> {
    const params = toHttpParams({
      q: filtro.q?.trim(),
      especialidad_id: filtro.especialidadId,
      sede_id: filtro.sedeId,
      activo: filtro.activo === undefined ? true : filtro.activo,
      limit: filtro.limit,
      offset: filtro.offset,
    });
    return this.http.get<Page<Profesional>>(this.baseUrl, { params });
  }

  obtener(id: number | string): Observable<Profesional> {
    return this.http.get<Profesional>(`${this.baseUrl}/${id}`);
  }

  crear(datos: ProfesionalInput): Observable<Profesional> {
    return this.http.post<Profesional>(this.baseUrl, datos);
  }

  actualizar(id: number, datos: ProfesionalInput): Observable<Profesional> {
    return this.http.put<Profesional>(`${this.baseUrl}/${id}`, datos);
  }
}
