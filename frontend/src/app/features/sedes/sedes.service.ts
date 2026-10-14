import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { Sede } from './sede.model';

@Injectable({ providedIn: 'root' })
export class SedesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/sedes`;

  listar(): Observable<Sede[]> {
    return this.http.get<Sede[]>(this.baseUrl);
  }

  obtener(id: number | string): Observable<Sede> {
    return this.http.get<Sede>(`${this.baseUrl}/${id}`);
  }
}
