import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Sedes } from './sedes';

const URL = 'http://localhost:8000/sedes';

describe('Sedes', () => {
  let fixture: ComponentFixture<Sedes>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sedes],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Sedes);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders a card per sede with a dialable phone and a map link', async () => {
    http.expectOne(URL).flush([
      {
        id: 1,
        nombre: 'Sede Chapinero',
        direccion: 'Carrera 13 # 63-40',
        ciudad: 'Bogotá',
        telefono: '+57 601 555 0101',
      },
      { id: 2, nombre: 'Sede Sin Teléfono', direccion: 'Calle 1', ciudad: 'Cali', telefono: null },
    ]);
    await settle();

    expect(el.querySelectorAll('h3').length).toBe(2);
    expect(el.querySelector('a[href="tel:+576015550101"]')).toBeTruthy();
    expect(el.querySelectorAll('a[href^="tel:"]').length).toBe(1);

    const map = el.querySelector('a[target="_blank"]') as HTMLAnchorElement;
    expect(map.rel).toContain('noopener');
    expect(map.href).toContain('Carrera%2013');
  });

  it('shows an empty state', async () => {
    http.expectOne(URL).flush([]);
    await settle();

    expect(el.textContent).toContain('Aún no hay sedes registradas');
  });

  it('shows an error state when the API is down', async () => {
    http.expectOne(URL).error(new ProgressEvent('error'));
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar las sedes',
    );
  });
});
