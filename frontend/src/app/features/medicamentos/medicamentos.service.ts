import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { Page, toHttpParams } from '../../core/page';
import { Medicamento } from './medicamento.model';

export interface MedicamentosFiltro {
  /** Busca en nombre o principio activo. */
  q?: string | null;
  /** `null`/`undefined` = todos. */
  requiereFormula?: boolean | null;
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class MedicamentosService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/medicamentos`;

  listar(filtro: MedicamentosFiltro = {}): Observable<Page<Medicamento>> {
    const params = toHttpParams({
      q: filtro.q?.trim(),
      requiere_formula: filtro.requiereFormula,
      limit: filtro.limit,
      offset: filtro.offset,
    });
    return this.http.get<Page<Medicamento>>(this.baseUrl, { params });
  }
}
