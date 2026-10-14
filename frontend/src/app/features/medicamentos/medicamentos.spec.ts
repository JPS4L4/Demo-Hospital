import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import localeEsCo from '@angular/common/locales/es-CO';
import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Medicamento } from './medicamento.model';
import { Medicamentos, SEARCH_DEBOUNCE_MS } from './medicamentos';

registerLocaleData(localeEsCo);

const URL = 'http://localhost:8000/medicamentos';

const medicamento = (id: number, over: Partial<Medicamento> = {}): Medicamento => ({
  id,
  nombre: `Medicamento ${id}`,
  principio_activo: 'Principio',
  presentacion: 'Caja x 20 tabletas',
  concentracion: '500 mg',
  requiere_formula: false,
  stock: 200,
  precio: 6500,
  ...over,
});

const page = (items: Medicamento[], total = items.length, offset = 0) => ({ items, total, limit: 12, offset });

describe('Medicamentos', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'medicamentos', component: Medicamentos }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: LOCALE_ID, useValue: 'es-CO' },
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => http.verify());

  const list = (): TestRequest => http.expectOne((r) => r.url === URL);

  async function settle(): Promise<void> {
    await harness.fixture.whenStable();
    harness.detectChanges();
  }

  async function open(url: string, body: object = page([medicamento(1)])): Promise<void> {
    await harness.navigateByUrl(url, Medicamentos);
    el = harness.routeNativeElement as HTMLElement;
    list().flush(body);
    await settle();
  }

  it('shows a loading status while the first request is pending', async () => {
    await harness.navigateByUrl('/medicamentos', Medicamentos);
    el = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();

    expect(el.querySelector('app-skeleton-cards [role="status"]')?.textContent).toContain('Cargando medicamentos');
    list().flush(page([]));
  });

  it('renders presentation, concentration, es-CO price, formula badge and availability', async () => {
    await open(
      '/medicamentos',
      page([
        medicamento(1, { nombre: 'Amoxicilina', requiere_formula: true, precio: 18900, stock: 77 }),
        medicamento(2, { nombre: 'Acetaminofén', stock: 45 }),
        medicamento(3, { nombre: 'Agotadol', stock: 0 }),
      ]),
    );

    const cards = Array.from(el.querySelectorAll('app-medicamento-card')) as HTMLElement[];
    expect(cards.length).toBe(3);

    expect(cards[0].textContent).toContain('Amoxicilina');
    expect(cards[0].textContent).toContain('Requiere fórmula médica');
    expect(cards[0].textContent).toContain('Caja x 20 tabletas');
    expect(cards[0].textContent).toContain('500 mg');
    expect(cards[0].textContent).toMatch(/\$\s?18\.900/);
    expect(cards[0].textContent).toContain('Disponible');
    expect(cards[0].textContent).not.toContain('77');

    expect(cards[1].textContent).toContain('Venta libre');
    expect(cards[1].textContent).not.toContain('Requiere fórmula médica');
    expect(cards[1].textContent).toContain('Pocas unidades');
    expect(cards[2].textContent).toContain('Agotado');
  });

  it('shows the informative disclaimer', async () => {
    await open('/medicamentos');
    expect(el.textContent).toContain('Información orientativa');
  });

  it('sends the filters found in the URL and preselects them', async () => {
    await harness.navigateByUrl('/medicamentos?q=parac&formula=no&pagina=2', Medicamentos);
    el = harness.routeNativeElement as HTMLElement;
    const req = list();
    const p = req.request.params;
    expect([p.get('q'), p.get('requiere_formula'), p.get('limit'), p.get('offset')]).toEqual(['parac', 'false', '12', '12']);
    req.flush(page([medicamento(1)], 15, 12));
    await settle();

    expect((el.querySelector('#filtro-q') as HTMLInputElement).value).toBe('parac');
    const checked = el.querySelector('input[name="formula"]:checked') as HTMLInputElement;
    expect(checked.value).toBe('no');
  });

  it('maps the formula radio to requiere_formula and resets to the first page', async () => {
    await open('/medicamentos?pagina=2', page([medicamento(1)], 15, 12));

    const yes = el.querySelector('input[name="formula"][value="si"]') as HTMLInputElement;
    yes.click();
    await settle();

    expect(router.url).toBe('/medicamentos?formula=si');
    const req = list();
    expect(req.request.params.get('requiere_formula')).toBe('true');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush(page([medicamento(2, { requiere_formula: true })]));
    await settle();
  });

  it('debounces the search and replaces the URL instead of stacking history', async () => {
    await open('/medicamentos');
    vi.useFakeTimers();
    try {
      const input = el.querySelector('#filtro-q') as HTMLInputElement;
      input.value = 'ibu';
      input.dispatchEvent(new Event('input'));
      harness.detectChanges();

      vi.advanceTimersByTime(SEARCH_DEBOUNCE_MS - 50);
      http.expectNone((r) => r.url === URL);

      vi.advanceTimersByTime(60);
    } finally {
      vi.useRealTimers();
    }
    await settle();

    expect(router.url).toBe('/medicamentos?q=ibu');
    const req = list();
    expect(req.request.params.get('q')).toBe('ibu');
    req.flush(page([]));
    await settle();
  });

  it('paginates with Siguiente', async () => {
    await open('/medicamentos', page([medicamento(1)], 15));

    expect(el.querySelector('nav[aria-label="Paginación"]')?.textContent).toContain('1–12');
    const next = Array.from(el.querySelectorAll('nav button')).find((b) => b.textContent?.includes('Siguiente')) as HTMLButtonElement;
    next.click();
    await settle();

    expect(router.url).toBe('/medicamentos?pagina=2');
    const req = list();
    expect(req.request.params.get('offset')).toBe('12');
    req.flush(page([medicamento(13)], 15, 12));
    await settle();
    expect(el.querySelector('nav[aria-label="Paginación"]')?.textContent).toContain('13–15');
  });

  it('shows an empty state with "Limpiar filtros" when a search finds nothing', async () => {
    await open('/medicamentos?q=zzz', page([]));

    expect(el.textContent).toContain('No encontramos medicamentos');
    const clear = Array.from(el.querySelectorAll('app-state-message button')).find((b) =>
      b.textContent?.includes('Limpiar filtros'),
    ) as HTMLButtonElement;
    clear.click();
    await settle();

    expect(router.url).toBe('/medicamentos');
    list().flush(page([medicamento(1)]));
    await settle();
  });

  it('shows a retryable error and requests the list again', async () => {
    await harness.navigateByUrl('/medicamentos', Medicamentos);
    el = harness.routeNativeElement as HTMLElement;
    list().flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No pudimos cargar los medicamentos');
    (alert?.querySelector('button') as HTMLButtonElement).click();
    await settle();

    list().flush(page([medicamento(1)]));
    await settle();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('app-medicamento-card').length).toBe(1);
  });
});
