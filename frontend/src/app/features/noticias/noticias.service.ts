import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/api';
import { Noticia, NoticiaInput } from './noticia.model';

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

  crear(datos: NoticiaInput): Observable<Noticia> {
    return this.http.post<Noticia>(this.baseUrl, datos);
  }

  actualizar(id: number, datos: NoticiaInput): Observable<Noticia> {
    return this.http.put<Noticia>(`${this.baseUrl}/${id}`, datos);
  }

  eliminar(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
