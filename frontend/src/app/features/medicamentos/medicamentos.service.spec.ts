import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { disponibilidad } from './medicamento.model';
import { MedicamentosService } from './medicamentos.service';

const URL = 'http://localhost:8000/medicamentos';

describe('MedicamentosService', () => {
  let service: MedicamentosService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MedicamentosService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends no query params when there are no filters', () => {
    service.listar().subscribe();

    const req = http.expectOne((r) => r.url === URL);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.keys()).toEqual([]);
    req.flush({ items: [], total: 0, limit: 20, offset: 0 });
  });

  it('maps search, formula filter and pagination to query params', () => {
    service.listar({ q: ' parac ', requiereFormula: false, limit: 12, offset: 12 }).subscribe();

    const req = http.expectOne((r) => r.url === URL);
    const p = req.request.params;
    expect(p.get('q')).toBe('parac');
    expect(p.get('requiere_formula')).toBe('false');
    expect(p.get('limit')).toBe('12');
    expect(p.get('offset')).toBe('12');
    req.flush({ items: [], total: 0, limit: 12, offset: 12 });
  });

  it('sends requiere_formula=true and omits it when the filter is null', () => {
    service.listar({ requiereFormula: true }).subscribe();
    const withFormula = http.expectOne((r) => r.url === URL);
    expect(withFormula.request.params.get('requiere_formula')).toBe('true');
    withFormula.flush({ items: [], total: 0, limit: 20, offset: 0 });

    service.listar({ requiereFormula: null }).subscribe();
    const all = http.expectOne((r) => r.url === URL);
    expect(all.request.params.has('requiere_formula')).toBe(false);
    all.flush({ items: [], total: 0, limit: 20, offset: 0 });
  });
});

describe('disponibilidad', () => {
  it('derives availability from stock', () => {
    expect(disponibilidad(0)).toBe('agotado');
    expect(disponibilidad(1)).toBe('pocas');
    expect(disponibilidad(50)).toBe('pocas');
    expect(disponibilidad(51)).toBe('disponible');
  });
});
