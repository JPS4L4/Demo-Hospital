import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { Noticia } from './noticia.model';

@Injectable({ providedIn: 'root' })
export class NoticiasService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/noticias`;

  /** Noticias, la más reciente primero (orden que entrega la API). */
  listar(): Observable<Noticia[]> {
    return this.http.get<Noticia[]>(this.baseUrl);
  }

  obtener(id: number | string): Observable<Noticia> {
    return this.http.get<Noticia>(`${this.baseUrl}/${id}`);
  }
}
