import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../../core/auth/auth.service';
import { API, sesion, usuarioAdmin, usuarioPaciente } from '../../../core/auth/auth.testing';
import { Cita } from '../cita.model';
import { MisCitas } from './mis-citas';

const cita = (
  id: number,
  inicio: string,
  estado: Cita['estado'] = 'programada',
  extra: Partial<Cita> = {},
): Cita => ({
  id,
  paciente_id: 7,
  profesional_id: 5,
  sede_id: 1,
  inicio,
  fin: inicio.replace(/:00-05:00$/, ':30-05:00'),
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
    apellidos: 'Beltrán Pardo',
    especialidad: { id: 3, nombre: 'Medicina interna' },
  },
  sede: { id: 1, nombre: 'Sede Chapinero', ciudad: 'Bogotá' },
  ...extra,
});

const lista = [
  cita(1, '2026-10-20T10:00:00-05:00'),
  cita(2, '2026-10-16T08:30:00-05:00'),
  cita(3, '2026-09-01T09:00:00-05:00', 'atendida'),
  cita(4, '2026-10-25T09:00:00-05:00', 'cancelada'),
  cita(5, '2026-10-01T09:00:00-05:00', 'programada'),
];
const page = (items: Cita[]) => ({ items, total: items.length, limit: 100, offset: 0 });

describe('MisCitas', () => {
  let fixture: ComponentFixture<MisCitas>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T15:00:00Z'));
    await TestBed.configureTestingModule({
      imports: [MisCitas],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function create(user = usuarioPaciente): Promise<void> {
    TestBed.inject(AuthService).login('a@b.co', 'x').subscribe();
    http.expectOne(`${API}/auth/login`).flush(sesion(user));
    fixture = TestBed.createComponent(MisCitas);
    el = fixture.nativeElement;
    fixture.detectChanges();
  }

  const listReq = () => http.expectOne((r) => r.url === `${API}/citas`);
  const cards = () => Array.from(el.querySelectorAll('li.cita'));
  const button = (text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) =>
      b.textContent?.includes(text),
    )!;

  it('separates upcoming from past and shows date, time, professional, specialty, venue and status', async () => {
    await create();
    listReq().flush(page(lista));
    await settle();

    expect(el.textContent).toContain('Próximas (2)');
    expect(el.textContent).toContain('Anteriores (3)');
    const first = cards()[0];
    // Nearest first: Friday 16 Oct 8:30 a. m. (Bogotá).
    expect(first.textContent).toContain('viernes, 16 de octubre de 2026');
    expect(first.textContent).toMatch(/8:30\s+a\. m\./);
    expect(first.textContent).toContain('Sofía Beltrán Pardo');
    expect(first.textContent).toContain('Medicina interna');
    expect(first.textContent).toContain('Sede Chapinero, Bogotá');
    expect(first.textContent).toContain('Programada');
    expect(first.textContent).toContain('Control general');
    expect(cards().length).toBe(2);

    (el.querySelector('input[value="anteriores"]') as HTMLInputElement).click();
    await settle();
    // Most recent first: cancelled (25 Oct), then the missed one (1 Oct), then the attended one (1 Sep).
    expect(cards().map((c) => c.querySelector('app-estado-badge')?.textContent?.trim())).toEqual([
      'Cancelada',
      'Programada',
      'Atendida',
    ]);
    // Past or cancelled appointments cannot be cancelled again.
    expect(cards().some((c) => c.textContent?.includes('Cancelar'))).toBe(false);
  });

  it('cancels after an explicit confirmation and moves the card to the past list', async () => {
    await create();
    listReq().flush(page(lista));
    await settle();

    button('Cancelar cita del').click();
    await settle();
    const dialog = el.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.textContent).toContain('¿Cancelar esta cita?');
    expect(dialog.textContent).toContain('viernes, 16 de octubre de 2026');
    http.expectNone((r) => r.url.endsWith('/cancelar'));

    button('Sí, cancelar cita').click();
    await settle();
    const post = http.expectOne(`${API}/citas/2/cancelar`);
    expect(post.request.method).toBe('POST');
    // While waiting, the dialog is busy and the list is untouched.
    expect(button('Cancelando…').disabled).toBe(true);
    expect(cards().length).toBe(2);

    post.flush(cita(2, '2026-10-16T08:30:00-05:00', 'cancelada'));
    await settle();

    expect(dialog.hasAttribute('open')).toBe(false);
    expect(el.textContent).toContain('Próximas (1)');
    expect(el.textContent).toContain('Anteriores (4)');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Cita cancelada.');
  });

  it('keeps the appointment when the user chooses not to cancel', async () => {
    await create();
    listReq().flush(page(lista));
    await settle();

    button('Cancelar cita del').click();
    await settle();
    button('Conservar cita').click();
    await settle();

    expect(el.querySelector('dialog')!.hasAttribute('open')).toBe(false);
    http.expectNone((r) => r.url.endsWith('/cancelar'));
    expect(el.textContent).toContain('Próximas (2)');
  });

  it('closes the dialog on Escape (native cancel event) when idle', async () => {
    await create();
    listReq().flush(page(lista));
    await settle();
    button('Cancelar cita del').click();
    await settle();

    el.querySelector('dialog')!.dispatchEvent(new Event('cancel', { cancelable: true }));
    await settle();
    expect(el.querySelector('dialog')!.hasAttribute('open')).toBe(false);
  });

  it('shows the server error inside the dialog and leaves the list as it was', async () => {
    await create();
    listReq().flush(page(lista));
    await settle();

    button('Cancelar cita del').click();
    await settle();
    button('Sí, cancelar cita').click();
    await settle();
    http
      .expectOne(`${API}/citas/2/cancelar`)
      .flush({ detail: 'La cita ya fue atendida' }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(el.querySelector('dialog')!.textContent).toContain('La cita ya fue atendida');
    // A 409 means our copy is stale: the list is requested again.
    listReq().flush(page(lista));
    await settle();
  });

  it('offers to book when there are no upcoming appointments', async () => {
    await create();
    listReq().flush(page([lista[2]]));
    await settle();

    expect(el.textContent).toContain('No tienes citas próximas');
    expect(el.querySelector('a[href="/citas"]')).toBeTruthy();
  });

  it('shows an error with retry when the list cannot be loaded', async () => {
    await create();
    listReq().flush({ detail: 'x' }, { status: 500, statusText: 'Server Error' });
    await settle();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'No pudimos cargar tus citas',
    );

    button('Reintentar').click();
    await settle();
    listReq().flush(page(lista));
    await settle();
    expect(cards().length).toBe(2);
  });

  it('tells administrators this section is for patients', async () => {
    await create(usuarioAdmin);
    http.expectOne((r) => r.url === `${API}/citas`).flush(page([]));
    await settle();
    expect(el.textContent).toContain('Mis citas es para pacientes');
    expect(el.querySelector('a[href="/admin/agenda"]')).toBeTruthy();
  });
});
