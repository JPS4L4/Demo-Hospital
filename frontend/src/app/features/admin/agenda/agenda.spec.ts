import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API } from '../../../core/auth/auth.testing';
import { Cita } from '../../citas/cita.model';
import { AdminAgenda } from './agenda';

const cita = (id: number, inicio: string, estado: Cita['estado'] = 'programada'): Cita => ({
  id,
  paciente_id: 7,
  profesional_id: 5,
  sede_id: 1,
  inicio,
  fin: inicio,
  duracion_min: 30,
  motivo: 'Control general',
  estado,
  paciente: {
    id: 7,
    tipo_documento: 'CC',
    numero_documento: '1020304050',
    nombres: 'Paula',
    apellidos: 'Herrera',
  },
  profesional: {
    id: 5,
    nombres: 'Sofía',
    apellidos: 'Beltrán',
    especialidad: { id: 3, nombre: 'Medicina interna' },
  },
  sede: { id: 1, nombre: 'Sede Chapinero', ciudad: 'Bogotá' },
});

const profesionales = {
  items: [
    {
      id: 5,
      nombres: 'Sofía',
      apellidos: 'Beltrán',
      especialidad: { id: 3, nombre: 'Medicina interna' },
    },
    { id: 6, nombres: 'Luis', apellidos: 'Mora', especialidad: { id: 4, nombre: 'Pediatría' } },
  ],
  total: 2,
  limit: 100,
  offset: 0,
};
const page = (items: Cita[]) => ({ items, total: items.length, limit: 100, offset: 0 });

describe('AdminAgenda', () => {
  let fixture: ComponentFixture<AdminAgenda>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T15:00:00Z'));
    await TestBed.configureTestingModule({
      imports: [AdminAgenda],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminAgenda);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const citasReq = () => http.expectOne((r) => r.url === `${API}/citas`);
  const button = (text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(text),
    )!;

  async function load(items: Cita[]): Promise<void> {
    http.expectOne((r) => r.url === `${API}/profesionales`).flush(profesionales);
    citasReq().flush(page(items));
    await settle();
  }

  it('asks for today in Bogota time, all professionals included (inactive too) in the filter', async () => {
    const prof = http.expectOne((r) => r.url === `${API}/profesionales`);
    expect(prof.request.params.has('activo')).toBe(false);
    prof.flush(profesionales);
    const req = citasReq();
    expect(req.request.params.get('desde')).toBe('2026-10-14T00:00:00');
    expect(req.request.params.get('hasta')).toBe('2026-10-14T23:59:59');
    expect(req.request.params.has('profesional_id')).toBe(false);
    req.flush(page([]));
    await settle();
    expect(el.textContent).toContain('No hay citas este día');
  });

  it('lists the day with patient, professional, time and status', async () => {
    await load([
      cita(1, '2026-10-14T09:00:00-05:00'),
      cita(2, '2026-10-14T10:00:00-05:00', 'atendida'),
    ]);

    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Paula Herrera');
    expect(rows[0].textContent).toContain('CC 1020304050');
    expect(rows[0].textContent).toContain('Sofía Beltrán');
    expect(rows[0].textContent).toMatch(/9:00\s+a\. m\./);
    expect(el.textContent).toContain('2 citas · 1 por atender · 1 atendidas');
    // Only scheduled appointments have actions.
    expect(rows[0].querySelectorAll('button').length).toBe(2);
    expect(rows[1].querySelectorAll('button').length).toBe(0);
  });

  it('marks an appointment as attended with a PUT and updates the row', async () => {
    await load([cita(1, '2026-10-14T09:00:00-05:00')]);

    button('Atendida').click();
    await settle();
    const put = http.expectOne(`${API}/citas/1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ estado: 'atendida' });
    put.flush(cita(1, '2026-10-14T09:00:00-05:00', 'atendida'));
    await settle();

    expect(el.querySelector('tbody tr')!.textContent).toContain('Atendida');
    expect(el.querySelectorAll('tbody tr button').length).toBe(0);
    expect(el.querySelector('[role="status"]')?.textContent).toContain(
      'Cita marcada como atendida.',
    );
  });

  it('cancels after confirmation', async () => {
    await load([cita(1, '2026-10-14T09:00:00-05:00')]);

    button('Cancelar').click();
    await settle();
    expect(el.querySelector('dialog')!.hasAttribute('open')).toBe(true);
    http.expectNone(`${API}/citas/1/cancelar`);

    button('Sí, cancelar cita').click();
    await settle();
    http
      .expectOne(`${API}/citas/1/cancelar`)
      .flush(cita(1, '2026-10-14T09:00:00-05:00', 'cancelada'));
    await settle();

    expect(el.querySelector('dialog')!.hasAttribute('open')).toBe(false);
    expect(el.querySelector('tbody tr')!.textContent).toContain('Cancelada');
  });

  it('shows an inline error when marking fails and leaves the row untouched', async () => {
    await load([cita(1, '2026-10-14T09:00:00-05:00')]);
    button('Atendida').click();
    await settle();
    http
      .expectOne(`${API}/citas/1`)
      .flush({ detail: 'No se pudo' }, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No se pudo');
    expect(el.querySelector('tbody tr')!.textContent).toContain('Programada');
  });

  it('filters by professional', async () => {
    await load([]);
    const select = el.querySelector<HTMLSelectElement>('#agenda-profesional')!;
    select.value = '6';
    select.dispatchEvent(new Event('change'));
    await settle();

    const req = citasReq();
    expect(req.request.params.get('profesional_id')).toBe('6');
    req.flush(page([]));
  });

  it('moves between days with the previous/next buttons and the Today shortcut', async () => {
    await load([]);
    expect(button('Hoy').disabled).toBe(true);

    el.querySelector<HTMLButtonElement>('button[aria-label="Día siguiente"]')!.click();
    await settle();
    const req = citasReq();
    expect(req.request.params.get('desde')).toBe('2026-10-15T00:00:00');
    req.flush(page([]));
    await settle();
    expect(el.querySelector<HTMLInputElement>('#agenda-fecha')!.value).toBe('2026-10-15');

    button('Hoy').click();
    await settle();
    expect(citasReq().request.params.get('desde')).toBe('2026-10-14T00:00:00');
  });

  it('shows an error with retry', async () => {
    http.expectOne((r) => r.url === `${API}/profesionales`).flush(profesionales);
    citasReq().flush({ detail: 'x' }, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar la agenda',
    );
  });
});
