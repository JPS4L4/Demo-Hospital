import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { iniciales, nombreCompleto } from './profesional.model';
import { ProfesionalesService } from './profesionales.service';

const URL = 'http://localhost:8000/profesionales';

describe('ProfesionalesService', () => {
  let service: ProfesionalesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ProfesionalesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists only active professionals by default and sends no empty filters', () => {
    service.listar().subscribe();

    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual(['activo']);
    expect(req.request.params.get('activo')).toBe('true');
    req.flush({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it('maps the filters and pagination to query params', () => {
    service.listar({ q: '  bel ', especialidadId: 3, sedeId: 2, limit: 9, offset: 18 }).subscribe();

    const req = http.expectOne((r) => r.url === URL);
    const p = req.request.params;
    expect(p.get('q')).toBe('bel');
    expect(p.get('especialidad_id')).toBe('3');
    expect(p.get('sede_id')).toBe('2');
    expect(p.get('limit')).toBe('9');
    expect(p.get('offset')).toBe('18');
    req.flush({ items: [], total: 0, limit: 9, offset: 18 });
  });

  it('skips blank search text and null ids', () => {
    service.listar({ q: '   ', especialidadId: null, sedeId: null }).subscribe();

    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.params.has('q')).toBe(false);
    expect(req.request.params.has('especialidad_id')).toBe(false);
    expect(req.request.params.has('sede_id')).toBe(false);
    req.flush({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it('propagates a 404 from GET /profesionales/:id', () => {
    let status = 0;
    service.obtener(9999).subscribe({ error: (e) => (status = e.status) });

    http.expectOne(`${URL}/9999`).flush('nope', { status: 404, statusText: 'Not Found' });

    expect(status).toBe(404);
  });
});

describe('profesional model helpers', () => {
  it('builds the full name and the avatar initials', () => {
    const p = { nombres: 'Sofía', apellidos: 'Beltrán Pardo' };
    expect(nombreCompleto(p)).toBe('Sofía Beltrán Pardo');
    expect(iniciales(p)).toBe('SB');
    expect(iniciales({ nombres: 'élan', apellidos: 'ñoño' })).toBe('ÉÑ');
  });
});
