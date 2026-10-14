import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { PacienteFicha } from '../../core/auth/auth.model';
import { Page, toHttpParams } from '../../core/page';

@Injectable({ providedIn: 'root' })
export class PacientesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/pacientes`;

  /** Solo para administración. */
  listar(filtro: { limit?: number; offset?: number } = {}): Observable<Page<PacienteFicha>> {
    return this.http.get<Page<PacienteFicha>>(this.baseUrl, { params: toHttpParams(filtro) });
  }

  /** Cantidad total de pacientes registrados. */
  total(): Observable<number> {
    return this.listar({ limit: 1 }).pipe(map((page) => page.total));
  }
}
