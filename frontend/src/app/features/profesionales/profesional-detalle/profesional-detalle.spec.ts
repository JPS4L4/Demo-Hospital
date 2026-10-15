import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Profesional } from '../profesional.model';
import { ProfesionalDetalle } from './profesional-detalle';

const URL = 'http://localhost:8000/profesionales/3';

const profesional: Profesional = {
  id: 3,
  nombres: 'Sofía',
  apellidos: 'Beltrán Pardo',
  especialidad_id: 3,
  sede_id: 1,
  registro_profesional: 'RM-20003',
  email: 'sofia.beltran@example.com',
  telefono: '+57 601 555 0103',
  bio: 'Primer párrafo.\n\nSegundo párrafo.',
  activo: true,
  especialidad: { id: 3, nombre: 'Medicina interna' },
  sede: { id: 1, nombre: 'Sede Chapinero', ciudad: 'Bogotá' },
};

describe('ProfesionalDetalle', () => {
  let fixture: ComponentFixture<ProfesionalDetalle>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfesionalDetalle],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(ProfesionalDetalle);
    fixture.componentRef.setInput('id', '3');
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the profile with bio, sede link, contact data and the booking call to action', async () => {
    http.expectOne(URL).flush(profesional);
    await settle();

    expect(el.querySelector('h1')?.textContent).toContain('Sofía Beltrán Pardo');
    expect(el.textContent).toContain('Medicina interna');
    expect(el.querySelectorAll('.prose-body p').length).toBe(2);
    expect(el.textContent).toContain('RM-20003');

    const links = Array.from(el.querySelectorAll('a'));
    expect(links.find((a) => a.textContent?.includes('Sede Chapinero'))?.getAttribute('href')).toBe(
      '/sedes',
    );
    expect(links.find((a) => a.textContent?.includes('sofia.beltran'))?.getAttribute('href')).toBe(
      'mailto:sofia.beltran@example.com',
    );
    expect(links.find((a) => a.textContent?.includes('555 0103'))?.getAttribute('href')).toBe(
      'tel:+576015550103',
    );
    // Deep link: the booking flow opens with this professional and specialty preselected.
    expect(links.find((a) => a.textContent?.includes('Pedir cita'))?.getAttribute('href')).toBe(
      '/citas?profesional_id=3&especialidad_id=3',
    );
  });

  it('omits the phone when missing and hides the booking button for inactive professionals', async () => {
    http.expectOne(URL).flush({ ...profesional, telefono: null, activo: false });
    await settle();

    expect(el.querySelector('a[href^="tel:"]')).toBeNull();
    expect(el.textContent).toContain('No está atendiendo citas');
    expect(
      Array.from(el.querySelectorAll('a')).some((a) => a.textContent?.includes('Pedir cita')),
    ).toBe(false);
  });

  it('shows a loading status while the request is pending', () => {
    http.expectOne(URL);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Cargando profesional');
  });

  it('shows a not-found message when the API answers 404', async () => {
    http
      .expectOne(URL)
      .flush({ detail: 'Profesional no encontrado' }, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(el.textContent).toContain('No encontramos a este profesional');
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelector('a[href="/profesionales"]')).toBeTruthy();
  });

  it('shows a retryable error for other failures', async () => {
    http.expectOne(URL).error(new ProgressEvent('error'));
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar el perfil',
    );
    (el.querySelector('[role="alert"] button') as HTMLButtonElement).click();
    await settle();

    http.expectOne(URL).flush(profesional);
    await settle();
    expect(el.querySelector('h1')?.textContent).toContain('Sofía');
  });
});
