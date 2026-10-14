import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Profesional } from './profesional.model';
import { Profesionales, SEARCH_DEBOUNCE_MS } from './profesionales';

const API = 'http://localhost:8000';

const especialidades = {
  items: [
    { id: 1, nombre: 'Cardiología', descripcion: '' },
    { id: 3, nombre: 'Medicina interna', descripcion: '' },
  ],
  total: 2,
  limit: 100,
  offset: 0,
};
const sedes = [
  { id: 1, nombre: 'Sede Chapinero', direccion: 'Cra 13', ciudad: 'Bogotá', telefono: null },
  { id: 2, nombre: 'Sede El Poblado', direccion: 'Cll 10', ciudad: 'Medellín', telefono: null },
];

const profesional = (id: number, nombres: string, apellidos: string): Profesional => ({
  id,
  nombres,
  apellidos,
  especialidad_id: 3,
  sede_id: 1,
  registro_profesional: `RM-${20000 + id}`,
  email: `p${id}@example.com`,
  telefono: null,
  bio: 'Bio',
  activo: true,
  especialidad: { id: 3, nombre: 'Medicina interna' },
  sede: { id: 1, nombre: 'Sede Chapinero', ciudad: 'Bogotá' },
});

const page = (items: Profesional[], total = items.length, offset = 0) => ({ items, total, limit: 9, offset });

describe('Profesionales', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'profesionales', component: Profesionales }]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const list = (): TestRequest => http.expectOne((r) => r.url === `${API}/profesionales`);

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  /** Abre la ruta y responde a las tres peticiones iniciales (opciones de filtro + listado). */
  async function open(url: string, body: object = page([profesional(1, 'Ana', 'Zapata')])): Promise<void> {
    await harness.navigateByUrl(url, Profesionales);
    el = harness.routeNativeElement as HTMLElement;
    http.expectOne((r) => r.url === `${API}/especialidades`).flush(especialidades);
    http.expectOne(`${API}/sedes`).flush(sedes);
    list().flush(body);
    await settle();
  }

  it('shows a loading status while the first request is pending', async () => {
    await harness.navigateByUrl('/profesionales', Profesionales);
    el = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();

    expect(el.querySelector('app-skeleton-cards [role="status"]')?.textContent).toContain('Cargando profesionales');
    http.expectOne((r) => r.url === `${API}/especialidades`).flush(especialidades);
    http.expectOne(`${API}/sedes`).flush(sedes);
    list().flush(page([]));
  });

  it('requests active professionals with the page size and renders cards linking to the detail', async () => {
    await open('/profesionales', page([profesional(7, 'Sofía', 'Beltrán')], 1));

    const names = Array.from(el.querySelectorAll('app-profesional-card h3')).map((h) => h.textContent?.trim());
    expect(names).toEqual(['Sofía Beltrán']);
    expect(el.querySelector('app-profesional-card h3 a')?.getAttribute('href')).toBe('/profesionales/7');
    expect(el.querySelector('app-avatar')?.textContent).toContain('SB');
    expect(el.textContent).toContain('Sede Chapinero, Bogotá');
    expect(el.textContent).toContain('Registro RM-20007');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('1 profesional');
  });

  it('sends the filters found in the URL and preselects them', async () => {
    await harness.navigateByUrl('/profesionales?q=bel&especialidad_id=3&sede_id=2&pagina=2', Profesionales);
    el = harness.routeNativeElement as HTMLElement;
    http.expectOne((r) => r.url === `${API}/especialidades`).flush(especialidades);
    http.expectOne(`${API}/sedes`).flush(sedes);
    const req = list();
    const p = req.request.params;
    expect([p.get('q'), p.get('especialidad_id'), p.get('sede_id'), p.get('limit'), p.get('offset'), p.get('activo')]).toEqual([
      'bel', '3', '2', '9', '9', 'true',
    ]);
    req.flush(page([profesional(1, 'Ana', 'Zapata')], 12, 9));
    await settle();

    expect((el.querySelector('#filtro-q') as HTMLInputElement).value).toBe('bel');
    expect((el.querySelector('#filtro-especialidad') as HTMLSelectElement).value).toBe('3');
    expect((el.querySelector('#filtro-sede') as HTMLSelectElement).value).toBe('2');
    expect(el.textContent).toContain('Limpiar filtros');
  });

  it('writes a selected especialidad to the URL (first page) and requests it', async () => {
    await open('/profesionales?pagina=2', page([profesional(1, 'Ana', 'Zapata')], 12, 9));

    const select = el.querySelector('#filtro-especialidad') as HTMLSelectElement;
    select.value = '1';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(router.url).toBe('/profesionales?especialidad_id=1');
    const req = list();
    expect(req.request.params.get('especialidad_id')).toBe('1');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush(page([]));
    await settle();
  });

  it('keeps the previous results (dimmed) while a new filter loads', async () => {
    await open('/profesionales');

    const select = el.querySelector('#filtro-sede') as HTMLSelectElement;
    select.value = '2';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(el.querySelector('app-profesional-card')).toBeTruthy();
    expect(el.querySelector('.results-stale')).toBeTruthy();
    expect(el.querySelector('[aria-busy="true"]')).toBeTruthy();

    list().flush(page([profesional(2, 'Luis', 'Mora')]));
    await settle();
    expect(el.querySelector('.results-stale')).toBeNull();
    expect(el.querySelector('app-profesional-card h3')?.textContent).toContain('Luis Mora');
  });

  it('debounces the name search and replaces the URL instead of stacking history', async () => {
    await open('/profesionales');
    vi.useFakeTimers();
    try {
      const input = el.querySelector('#filtro-q') as HTMLInputElement;
      input.value = 'be';
      input.dispatchEvent(new Event('input'));
      harness.detectChanges();
      input.value = 'bel';
      input.dispatchEvent(new Event('input'));
      harness.detectChanges();

      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50);
      http.expectNone((r) => r.url === `${API}/profesionales`);

      vi.advanceTimersByTime(60);
    } finally {
      vi.useRealTimers();
    }
    await settle();

    expect(router.url).toBe('/profesionales?q=bel');
    const req = list();
    expect(req.request.params.get('q')).toBe('bel');
    req.flush(page([]));
    await settle();
  });

  it('paginates with Siguiente and shows the range', async () => {
    await open('/profesionales', page([profesional(1, 'Ana', 'Zapata')], 12));

    expect(el.querySelector('nav[aria-label="Paginación"]')?.textContent).toContain('1–9');
    const next = Array.from(el.querySelectorAll('nav button')).find((b) => b.textContent?.includes('Siguiente')) as HTMLButtonElement;
    next.click();
    await settle();

    expect(router.url).toBe('/profesionales?pagina=2');
    const req = list();
    expect(req.request.params.get('offset')).toBe('9');
    req.flush(page([profesional(2, 'Luis', 'Mora')], 12, 9));
    await settle();
    expect(el.querySelector('nav[aria-label="Paginación"]')?.textContent).toContain('10–12');
  });

  it('shows an empty state whose "Limpiar filtros" clears the URL filters', async () => {
    await open('/profesionales?q=zzz&sede_id=2', page([]));

    expect(el.textContent).toContain('No encontramos profesionales');
    const clear = Array.from(el.querySelectorAll('app-state-message button')).find((b) =>
      b.textContent?.includes('Limpiar filtros'),
    ) as HTMLButtonElement;
    clear.click();
    await settle();

    expect(router.url).toBe('/profesionales');
    list().flush(page([profesional(1, 'Ana', 'Zapata')]));
    await settle();
    expect(el.querySelector('app-profesional-card')).toBeTruthy();
  });

  it('offers to go back to the first page when the requested page is out of range', async () => {
    await open('/profesionales?pagina=9', page([], 12, 72));

    expect(el.textContent).toContain('Esa página ya no existe');
    (el.querySelector('app-state-message button') as HTMLButtonElement).click();
    await settle();
    expect(router.url).toBe('/profesionales');
    list().flush(page([profesional(1, 'Ana', 'Zapata')], 12));
  });

  it('shows a retryable error and requests the list again', async () => {
    await harness.navigateByUrl('/profesionales', Profesionales);
    el = harness.routeNativeElement as HTMLElement;
    http.expectOne((r) => r.url === `${API}/especialidades`).flush(especialidades);
    http.expectOne(`${API}/sedes`).flush(sedes);
    list().flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No pudimos cargar los profesionales');
    (alert?.querySelector('button') as HTMLButtonElement).click();
    await settle();

    list().flush(page([profesional(1, 'Ana', 'Zapata')]));
    await settle();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('app-profesional-card').length).toBe(1);
  });

  it('still lists professionals when the filter options fail to load', async () => {
    await harness.navigateByUrl('/profesionales', Profesionales);
    el = harness.routeNativeElement as HTMLElement;
    http.expectOne((r) => r.url === `${API}/especialidades`).error(new ProgressEvent('error'));
    http.expectOne(`${API}/sedes`).error(new ProgressEvent('error'));
    list().flush(page([profesional(1, 'Ana', 'Zapata')]));
    await settle();

    expect(el.querySelectorAll('app-profesional-card').length).toBe(1);
    expect(el.querySelectorAll('#filtro-especialidad option').length).toBe(1);
  });
});
