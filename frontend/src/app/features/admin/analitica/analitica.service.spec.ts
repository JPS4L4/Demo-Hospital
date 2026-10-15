import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API } from '../../../core/auth/auth.testing';
import { FiltrosAnalitica } from './analitica.model';
import { AnaliticaService } from './analitica.service';

const filtros: FiltrosAnalitica = {
  desde: '2025-10-15',
  hasta: '2026-10-15',
  sedeId: 2,
  especialidadId: null,
};

describe('AnaliticaService', () => {
  let service: AnaliticaService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AnaliticaService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the filters of GET /analitica/resumen and omits the empty ones', () => {
    service.resumen(filtros).subscribe();
    const req = http.expectOne((r) => r.url === `${API}/analitica/resumen`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe('2025-10-15');
    expect(req.request.params.get('hasta')).toBe('2026-10-15');
    expect(req.request.params.get('sede_id')).toBe('2');
    expect(req.request.params.has('especialidad_id')).toBe(false);
    req.flush({});
  });

  it('joins the dimensions with a comma and sends the measure', () => {
    service.citas(['fecha.dia_semana', 'hora'], 'total', filtros).subscribe();
    const req = http.expectOne((r) => r.url === `${API}/analitica/citas`);
    expect(req.request.params.get('agrupar')).toBe('fecha.dia_semana,hora');
    expect(req.request.params.get('medida')).toBe('total');
    expect(req.request.params.get('sede_id')).toBe('2');
    // The comma must stay literal in the URL, not %2C.
    expect(req.request.urlWithParams).toContain('agrupar=fecha.dia_semana,hora');
    req.flush({ medida: 'total', agrupar: [], filas: [] });
  });

  it('reads the freshness from GET /analitica/estado', () => {
    let result: unknown;
    service.estado().subscribe((e) => (result = e));
    const body = { refrescado_en: null, citas_oltp: 3, citas_analitica: 3, actualizada: true };
    http.expectOne(`${API}/analitica/estado`).flush(body);
    expect(result).toEqual(body);
  });

  it('refreshes with POST /analitica/refrescar', () => {
    service.refrescar().subscribe();
    const req = http.expectOne(`${API}/analitica/refrescar`);
    expect(req.request.method).toBe('POST');
    req.flush({ refrescado_en: '2026-10-15T12:00:00-05:00' });
  });
});
