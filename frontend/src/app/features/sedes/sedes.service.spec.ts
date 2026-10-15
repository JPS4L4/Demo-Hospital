import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Sede } from './sede.model';
import { SedesService } from './sedes.service';

const sede: Sede = {
  id: 1,
  nombre: 'Sede Chapinero',
  direccion: 'Carrera 13 # 63-40',
  ciudad: 'Bogotá',
  telefono: '+57 601 555 0101',
};

describe('SedesService', () => {
  let service: SedesService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SedesService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists sedes from GET /sedes', () => {
    let result: Sede[] | undefined;
    service.listar().subscribe((s) => (result = s));

    const req = http.expectOne('http://localhost:8000/sedes');
    expect(req.request.method).toBe('GET');
    req.flush([sede]);

    expect(result).toEqual([sede]);
  });

  it('gets one sede from GET /sedes/:id', () => {
    let result: Sede | undefined;
    service.obtener(1).subscribe((s) => (result = s));

    http.expectOne('http://localhost:8000/sedes/1').flush(sede);

    expect(result).toEqual(sede);
  });
});
