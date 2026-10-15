import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../../core/api';
import { toHttpParams } from '../../../core/page';
import {
  ConsultaAnalitica,
  EstadoAnalitica,
  FiltrosAnalitica,
  Medida,
  Resumen,
} from './analitica.model';

/** Lado OLAP de la API (`/analitica/*`, solo administración). */
@Injectable({ providedIn: 'root' })
export class AnaliticaService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/analitica`;

  resumen(filtros: FiltrosAnalitica): Observable<Resumen> {
    return this.http.get<Resumen>(`${this.baseUrl}/resumen`, { params: this.params(filtros) });
  }

  /** Consulta agregada: 1 o 2 dimensiones (`agrupar`) y una medida, con los filtros de slice/dice. */
  citas(
    agrupar: string[],
    medida: Medida,
    filtros: FiltrosAnalitica,
  ): Observable<ConsultaAnalitica> {
    return this.http.get<ConsultaAnalitica>(`${this.baseUrl}/citas`, {
      params: this.params(filtros).set('agrupar', agrupar.join(',')).set('medida', medida),
    });
  }

  estado(): Observable<EstadoAnalitica> {
    return this.http.get<EstadoAnalitica>(`${this.baseUrl}/estado`);
  }

  refrescar(): Observable<{ refrescado_en: string }> {
    return this.http.post<{ refrescado_en: string }>(`${this.baseUrl}/refrescar`, {});
  }

  private params(f: FiltrosAnalitica) {
    return toHttpParams({
      desde: f.desde,
      hasta: f.hasta,
      sede_id: f.sedeId,
      especialidad_id: f.especialidadId,
    });
  }
}
