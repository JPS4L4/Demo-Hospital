import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Especialidad } from './especialidad.model';
import { EspecialidadesService } from './especialidades.service';

describe('EspecialidadesService', () => {
  let service: EspecialidadesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EspecialidadesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the whole catalogue (limit 100) and unwraps the items', () => {
    const items: Especialidad[] = [{ id: 1, nombre: 'Cardiología', descripcion: 'Corazón' }];
    let result: Especialidad[] | undefined;
    service.listar().subscribe((e) => (result = e));

    const req = http.expectOne((r) => r.url === 'http://localhost:8000/especialidades');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('100');
    req.flush({ items, total: 1, limit: 100, offset: 0 });

    expect(result).toEqual(items);
  });
});
