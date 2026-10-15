import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { API } from '../../../core/auth/auth.testing';
import { AdminAnalitica } from './analitica';

const resumen = {
  total: 1200,
  atendidas: 1040,
  canceladas: 150,
  programadas: 10,
  tasa_cancelacion: 0.125,
  duracion_media_min: 31.4,
  pacientes_distintos: 320,
};

const estadoOk = {
  refrescado_en: '2026-10-15T09:30:00-05:00',
  citas_oltp: 1200,
  citas_analitica: 1200,
  actualizada: true,
};

const fila = (dimensiones: Record<string, string | number>, valor: number | null) => ({
  dimensiones,
  valor,
});

/** Respuesta por defecto de /analitica/citas según las dimensiones y la medida pedidas. */
function citas(req: TestRequest) {
  const agrupar = req.request.params.get('agrupar');
  const medida = req.request.params.get('medida');
  const body = (filas: ReturnType<typeof fila>[]) => ({
    medida,
    agrupar: agrupar?.split(','),
    filas,
  });
  if (agrupar?.startsWith('fecha.') && !agrupar.includes(',')) {
    const dim = agrupar;
    const k = medida === 'canceladas' ? 0.1 : 1;
    return body([fila({ [dim]: '2026-01' }, 100 * k), fila({ [dim]: '2026-02' }, 120 * k)]);
  }
  if (agrupar === 'especialidad' && medida === 'tasa_cancelacion') {
    return body([
      fila({ especialidad: 'Cardiología' }, 0.08),
      fila({ especialidad: 'Pediatría' }, 0.2),
    ]);
  }
  if (agrupar === 'especialidad') {
    return body([
      fila({ especialidad: 'Cardiología' }, 300),
      fila({ especialidad: 'Pediatría' }, 500),
    ]);
  }
  if (agrupar === 'sede') {
    return body([fila({ sede: 'Sede Norte' }, 700), fila({ sede: 'Sede Sur' }, 500)]);
  }
  return body([
    fila({ 'fecha.dia_semana': 'lunes', hora: 8 }, 30),
    fila({ 'fecha.dia_semana': 'lunes', hora: 9 }, 10),
  ]);
}

/** Responde una petición con los datos de prueba habituales. */
function flushDefault(req: TestRequest, estado: object = estadoOk) {
  const url = req.request.url;
  if (url === `${API}/sedes`) {
    req.flush([{ id: 1, nombre: 'Sede Norte', direccion: '', ciudad: '', telefono: null }]);
  } else if (url === `${API}/especialidades`) {
    req.flush({
      items: [{ id: 3, nombre: 'Cardiología', descripcion: '' }],
      total: 1,
      limit: 100,
      offset: 0,
    });
  } else if (url === `${API}/analitica/resumen`) {
    req.flush(resumen);
  } else if (url === `${API}/analitica/estado`) {
    req.flush(estado);
  } else if (url === `${API}/analitica/citas`) {
    req.flush(citas(req));
  }
}

describe('AdminAnalitica', () => {
  let fixture: ComponentFixture<AdminAnalitica>;
  let http: HttpTestingController;
  let el: HTMLElement;

  /** Estabiliza, responde todo lo pendiente (salvo lo que `solo` excluya) y repinta. */
  async function responder(overrides: { estado?: object } = {}) {
    for (let i = 0; i < 4; i++) {
      await fixture.whenStable();
      fixture.detectChanges();
      const pendientes = http.match(() => true);
      if (pendientes.length === 0) break;
      for (const req of pendientes) flushDefault(req, overrides.estado);
    }
    await fixture.whenStable();
    fixture.detectChanges();
  }

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-15T15:00:00Z'));
    await TestBed.configureTestingModule({
      imports: [AdminAnalitica],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAnalitica);
    el = fixture.nativeElement;
  });

  afterEach(() => vi.useRealTimers());

  /** Cuerpo de las próximas peticiones capturadas por URL sin responderlas. */
  async function capturar(): Promise<TestRequest[]> {
    await fixture.whenStable();
    fixture.detectChanges();
    return http.match(() => true);
  }

  it('shows the KPIs from /analitica/resumen and the freshness from /estado', async () => {
    fixture.detectChanges();
    await responder();

    const kpis = Array.from(el.querySelectorAll('.kpi')).map((k) => [
      k.querySelector('.kpi-label')?.textContent?.trim(),
      k.querySelector('.kpi-value')?.textContent?.replace(/\s/g, ' ').trim(),
    ]);
    expect(kpis).toEqual([
      ['Citas', '1.200'],
      ['Atendidas', '1.040'],
      ['Cancelación', '12,5%'],
      ['Duración media', '31 min'],
      ['Pacientes', '320'],
    ]);
    expect(el.querySelector('.fresh')?.textContent).toContain('Datos actualizados a 15 oct 2026');
    expect(el.querySelector('.fresh .notice')).toBeNull();
  });

  it('asks for the last 12 months by default and renders every chart', async () => {
    fixture.detectChanges();
    const reqs = await capturar();
    const resumenReq = reqs.find((r) => r.request.url === `${API}/analitica/resumen`)!;
    expect(resumenReq.request.params.get('desde')).toBe('2025-10-15');
    expect(resumenReq.request.params.get('hasta')).toBe('2026-10-15');
    for (const r of reqs) flushDefault(r);
    await responder();

    const titulos = Array.from(el.querySelectorAll('.widget-title')).map((t) =>
      t.textContent?.trim(),
    );
    expect(titulos).toEqual([
      'Citas en el tiempo',
      'Demanda por especialidad',
      'Cancelación por especialidad',
      'Citas por sede',
      'Horas pico',
    ]);
    // Especialidades ordenadas de mayor a menor demanda.
    const demanda = el.querySelectorAll('app-bar-chart')[0];
    expect(
      Array.from(demanda.querySelectorAll('.bar-label')).map((l) => l.textContent?.trim()),
    ).toEqual(['Pediatría', 'Cardiología']);
    expect(el.querySelectorAll('app-trend-chart svg path.line').length).toBe(2);
    expect(el.querySelectorAll('app-heatmap tbody tr').length).toBe(7);
  });

  it('flags the first and last month of the range as incomplete', async () => {
    fixture.detectChanges();
    const reqs = await capturar();
    for (const r of reqs) {
      const esMes =
        r.request.url === `${API}/analitica/citas` &&
        r.request.params.get('agrupar') === 'fecha.mes';
      if (esMes) {
        const filas = ['2025-10', '2025-11', '2026-09', '2026-10'].map((m) =>
          fila({ 'fecha.mes': m }, 100),
        );
        r.flush({ medida: r.request.params.get('medida'), agrupar: ['fecha.mes'], filas });
      } else {
        flushDefault(r);
      }
    }
    await responder();

    const filas = Array.from(el.querySelectorAll('app-trend-chart tbody th')).map((c) =>
      c.textContent?.replace(/\s+/g, ' ').trim(),
    );
    expect(filas).toEqual([
      'octubre de 2025 (periodo incompleto)',
      'noviembre de 2025',
      'septiembre de 2026',
      'octubre de 2026 (periodo incompleto)',
    ]);
    // Dos series x dos meses incompletos, más el marcador de la leyenda.
    expect(el.querySelectorAll('app-trend-chart circle.hueco').length).toBe(5);
  });

  it('requests a new grouping when the detail level changes', async () => {
    fixture.detectChanges();
    await responder();

    const agrupar = (reqs: TestRequest[]) =>
      reqs
        .filter((r) => r.request.url === `${API}/analitica/citas`)
        .map((r) => `${r.request.params.get('agrupar')}:${r.request.params.get('medida')}`);

    const trimestre = el.querySelector(
      'input[name="nivel"][value="trimestre"]',
    ) as HTMLInputElement;
    trimestre.click();
    fixture.detectChanges();
    const reqs = await capturar();

    // Solo se repite la tendencia (total y canceladas); los demás gráficos no cambian.
    expect(agrupar(reqs).sort()).toEqual(['fecha.trimestre:canceladas', 'fecha.trimestre:total']);
    for (const r of reqs) r.flush(citas(r));
    await responder();
    expect(trimestre.checked).toBe(true);
  });

  it('propagates the sede, especialidad and period filters to every query', async () => {
    fixture.detectChanges();
    await responder();

    const sede = el.querySelector('#an-sede') as HTMLSelectElement;
    sede.value = '1';
    sede.dispatchEvent(new Event('change'));
    const esp = el.querySelector('#an-esp') as HTMLSelectElement;
    esp.value = '3';
    esp.dispatchEvent(new Event('change'));
    (el.querySelector('input[name="periodo"][value="3"]') as HTMLInputElement).click();
    fixture.detectChanges();
    const reqs = await capturar();

    const consultas = reqs.filter((r) => r.request.url.startsWith(`${API}/analitica/`));
    // resumen + tendencia (2) + especialidad + cancelación + sede + horas; /estado no depende de los filtros.
    expect(consultas.filter((r) => !r.request.url.endsWith('/estado')).length).toBe(7);
    for (const r of consultas.filter((c) => !c.request.url.endsWith('/estado'))) {
      expect(r.request.params.get('sede_id')).toBe('1');
      expect(r.request.params.get('especialidad_id')).toBe('3');
      expect(r.request.params.get('desde')).toBe('2026-07-15');
      expect(r.request.params.get('hasta')).toBe('2026-10-15');
    }
    for (const r of reqs) flushDefault(r);
    await responder();
  });

  it('warns when the analytics copy is behind the operational data', async () => {
    fixture.detectChanges();
    await responder({
      estado: { refrescado_en: null, citas_oltp: 1210, citas_analitica: 1200, actualizada: false },
    });
    const fresh = el.querySelector('.fresh')!;
    expect(fresh.textContent).toContain('aún no se ha refrescado');
    expect(fresh.querySelector('.notice')?.textContent).toContain('1210 en el sistema operativo');
  });

  it('refreshes on demand: disables the button meanwhile, then reloads the widgets', async () => {
    fixture.detectChanges();
    await responder();
    const boton = Array.from(el.querySelectorAll('.fresh button')).find((b) =>
      b.textContent?.includes('Refrescar'),
    ) as HTMLButtonElement;

    boton.click();
    fixture.detectChanges();
    expect(boton.disabled).toBe(true);
    expect(boton.textContent).toContain('Refrescando');
    http
      .expectOne(`${API}/analitica/refrescar`)
      .flush({ refrescado_en: '2026-10-15T10:00:00-05:00' });

    await responder();
    expect(boton.disabled).toBe(false);
    expect(el.textContent).toContain('Datos refrescados');
    // Tras refrescar se repitieron todas las consultas y la frescura.
    expect(el.querySelector('.kpi-value')?.textContent).toContain('1.200');
  });

  it('reports a failed refresh without losing the page', async () => {
    fixture.detectChanges();
    await responder();
    const boton = Array.from(el.querySelectorAll('.fresh button')).find((b) =>
      b.textContent?.includes('Refrescar'),
    ) as HTMLButtonElement;
    boton.click();
    http
      .expectOne(`${API}/analitica/refrescar`)
      .flush({ detail: 'Otro refresco en curso.' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role="status"] .notice-error')?.textContent).toContain(
      'Otro refresco en curso.',
    );
    expect(boton.disabled).toBe(false);
    expect(el.querySelectorAll('.kpi').length).toBe(5);
  });

  it('shows a clear message when the analytics schema is missing (503)', async () => {
    fixture.detectChanges();
    const reqs = await capturar();
    for (const r of reqs) {
      // The first 503 swaps the page for the message, which cancels the other queries.
      if (r.cancelled) continue;
      if (r.request.url.startsWith(`${API}/analitica/`)) {
        r.flush(
          { detail: 'El esquema analitica no existe.' },
          { status: 503, statusText: 'Service Unavailable' },
        );
      } else if (r.request.url === `${API}/sedes`) r.flush([]);
      else r.flush({ items: [], total: 0, limit: 100, offset: 0 });
    }
    await fixture.whenStable();
    fixture.detectChanges();

    const alerta = el.querySelector('[role="alert"]')!;
    expect(alerta.textContent).toContain('La analítica no está disponible');
    expect(alerta.textContent).toContain('El esquema analitica no existe.');
    expect(el.querySelector('app-widget')).toBeNull();
  });

  it('shows an error with retry in a chart that fails and an empty state without data', async () => {
    fixture.detectChanges();
    const reqs = await capturar();
    for (const r of reqs) {
      const agrupar = r.request.params.get('agrupar');
      if (r.request.url === `${API}/analitica/citas` && agrupar === 'sede') {
        r.flush({ detail: 'x' }, { status: 500, statusText: 'Error' });
      } else if (
        r.request.url === `${API}/analitica/citas` &&
        agrupar === 'especialidad' &&
        r.request.params.get('medida') === 'total'
      ) {
        r.flush({ medida: 'total', agrupar: ['especialidad'], filas: [] });
      } else flushDefault(r);
    }
    await responder();

    const widgets = Array.from(el.querySelectorAll('app-widget'));
    const porTitulo = (t: string) =>
      widgets.find((w) => w.querySelector('.widget-title')?.textContent?.trim() === t)!;
    expect(porTitulo('Citas por sede').querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar este gráfico',
    );
    expect(porTitulo('Demanda por especialidad').textContent).toContain(
      'Sin citas para estos filtros',
    );
    expect(el.querySelector('app-state-message')).toBeNull();
  });

  it('does not query while a custom range is invalid', async () => {
    fixture.detectChanges();
    await responder();
    (el.querySelector('input[name="periodo"][value="custom"]') as HTMLInputElement).click();
    fixture.detectChanges();
    const reqs = await capturar();
    for (const r of reqs) flushDefault(r);
    await responder();

    const desde = el.querySelector('#an-desde') as HTMLInputElement;
    desde.value = '2026-12-01';
    desde.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(http.match(() => true).length).toBe(0);
    expect(el.textContent).toContain('Elige un periodo válido');
  });
});
