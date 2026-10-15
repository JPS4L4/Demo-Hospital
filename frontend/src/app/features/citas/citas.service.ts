import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { Page, toHttpParams } from '../../core/page';
import { Cita, DURACION_CITA_MIN, Disponibilidad, EstadoCita, NuevaCita } from './cita.model';

export interface CitasFiltro {
  estado?: EstadoCita | null;
  /** Instante o fecha-hora local de Bogotá (sin zona). */
  desde?: string | null;
  hasta?: string | null;
  profesionalId?: number | null;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class CitasService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_BASE_URL);
  private readonly baseUrl = `${this.apiUrl}/citas`;
  private readonly profesionalesUrl = `${this.apiUrl}/profesionales`;

  /** Un paciente recibe solo sus citas; un admin, todas. Orden por inicio ascendente. */
  listar(filtro: CitasFiltro = {}): Observable<Page<Cita>> {
    const params = toHttpParams({
      estado: filtro.estado,
      desde: filtro.desde,
      hasta: filtro.hasta,
      profesional_id: filtro.profesionalId,
      limit: filtro.limit,
      offset: filtro.offset,
    });
    return this.http.get<Page<Cita>>(this.baseUrl, { params });
  }

  crear(cita: NuevaCita): Observable<Cita> {
    return this.http.post<Cita>(this.baseUrl, cita);
  }

  cancelar(id: number): Observable<Cita> {
    return this.http.post<Cita>(`${this.baseUrl}/${id}/cancelar`, {});
  }

  marcarAtendida(id: number): Observable<Cita> {
    return this.http.put<Cita>(`${this.baseUrl}/${id}`, { estado: 'atendida' });
  }

  disponibilidad(
    profesionalId: number,
    fecha: string,
    duracion = DURACION_CITA_MIN,
  ): Observable<Disponibilidad> {
    return this.http.get<Disponibilidad>(
      `${this.profesionalesUrl}/${profesionalId}/disponibilidad`,
      {
        params: toHttpParams({ fecha, duracion }),
      },
    );
  }
}
