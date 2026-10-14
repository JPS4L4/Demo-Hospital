import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Noticia } from './noticia.model';
import { NoticiasService } from './noticias.service';

const noticia: Noticia = {
  id: 7,
  titulo: 'Jornada de vacunación',
  contenido: 'Texto',
  fecha_publicacion: '2026-10-01T10:00:00Z',
};

describe('NoticiasService', () => {
  let service: NoticiasService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(NoticiasService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists news from GET /noticias', () => {
    let result: Noticia[] | undefined;
    service.listar().subscribe((n) => (result = n));

    const req = http.expectOne('http://localhost:8000/noticias');
    expect(req.request.method).toBe('GET');
    req.flush([noticia]);

    expect(result).toEqual([noticia]);
  });

  it('gets one news item from GET /noticias/:id', () => {
    let result: Noticia | undefined;
    service.obtener(7).subscribe((n) => (result = n));

    const req = http.expectOne('http://localhost:8000/noticias/7');
    expect(req.request.method).toBe('GET');
    req.flush(noticia);

    expect(result).toEqual(noticia);
  });

  it('propagates HTTP errors to the subscriber', () => {
    let status = 0;
    service.obtener(9999).subscribe({ error: (e) => (status = e.status) });

    http.expectOne('http://localhost:8000/noticias/9999').flush('nope', { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });
});
