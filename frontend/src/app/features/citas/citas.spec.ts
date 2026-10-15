import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  TestRequest,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthService } from '../../core/auth/auth.service';
import { API, sesion, usuarioAdmin, usuarioPaciente } from '../../core/auth/auth.testing';
import { Citas } from './citas';

const especialidades = {
  items: [
    { id: 3, nombre: 'Medicina interna', descripcion: 'Adultos' },
    { id: 4, nombre: 'Pediatría', descripcion: 'Niños' },
  ],
  total: 2,
  limit: 100,
  offset: 0,
};

const profesional = (over: object = {}) => ({
  id: 5,
  nombres: 'Sofía',
  apellidos: 'Beltrán Pardo',
  especialidad_id: 3,
  sede_id: 1,
  registro_profesional: 'RM-20003',
  email: 'sofia@example.com',
  telefono: null,
  bio: 'Bio',
  activo: true,
  especialidad: { id: 3, nombre: 'Medicina interna' },
  sede: { id: 1, nombre: 'Sede Chapinero', ciudad: 'Bogotá' },
  ...over,
});

const hueco = (hora: string) => ({
  inicio: `2026-10-15T${hora}:00-05:00`,
  fin: `2026-10-15T${hora}:00-05:00`,
});
const disponibilidad = {
  profesional_id: 5,
  fecha: '2026-10-15',
  duracion_min: 30,
  huecos: [hueco('09:00'), hueco('10:30'), hueco('14:00')],
};

const citaCreada = {
  id: 90,
  paciente_id: 7,
  profesional_id: 5,
  sede_id: 1,
  inicio: '2026-10-15T09:00:00-05:00',
  fin: '2026-10-15T09:30:00-05:00',
  duracion_min: 30,
  motivo: 'Control general',
  estado: 'programada',
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
};

describe('Citas (booking flow)', () => {
  let harness: RouterTestingHarness;
  let fixture: ComponentFixture<unknown>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Miércoles 14 de octubre de 2026, 10:00 en Bogotá.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T15:00:00Z'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'citas', component: Citas },
          { path: 'ingresar', children: [] },
          { path: 'registro', children: [] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
    harness.detectChanges();
    await fixture.whenStable();
  }

  async function open(url: string): Promise<void> {
    harness = await RouterTestingHarness.create();
    fixture = harness.fixture;
    await harness.navigateByUrl(url, Citas);
    el = harness.routeNativeElement as HTMLElement;
    harness.detectChanges();
  }

  const especialidadesReq = () => http.expectOne((r) => r.url === `${API}/especialidades`);
  const profesionalesReq = () => http.expectOne((r) => r.url === `${API}/profesionales`);
  const slotsReq = (id = 5) =>
    http.expectOne((r) => r.url === `${API}/profesionales/${id}/disponibilidad`);

  async function logIn(user = usuarioPaciente): Promise<void> {
    TestBed.inject(AuthService).login('a@b.co', 'x').subscribe();
    http.expectOne(`${API}/auth/login`).flush(sesion(user));
    await settle();
  }

  const click = async (selector: string, text?: string) => {
    const target = Array.from(el.querySelectorAll<HTMLElement>(selector)).find(
      (n) => !text || n.textContent?.includes(text),
    );
    expect(target, `${selector} ${text ?? ''}`).toBeTruthy();
    target!.click();
    await settle();
  };

  const stepTitle = () => el.querySelector('[data-paso-actual] h2')?.textContent?.trim();

  it('walks specialty -> professional -> day -> time, keeping each step in the URL', async () => {
    await open('/citas');
    expect(stepTitle()).toBe('Especialidad');
    especialidadesReq().flush(especialidades);
    await settle();

    await click('.choice', 'Medicina interna');
    expect(router.url).toBe('/citas?especialidad_id=3');
    expect(stepTitle()).toBe('Profesional');
    const list = profesionalesReq();
    expect(list.request.params.get('especialidad_id')).toBe('3');
    expect(list.request.params.get('activo')).toBe('true');
    list.flush({ items: [profesional()], total: 1, limit: 100, offset: 0 });
    await settle();

    await click('.choice', 'Sofía Beltrán Pardo');
    expect(router.url).toBe('/citas?especialidad_id=3&profesional_id=5');
    expect(stepTitle()).toBe('Día y hora');
    http.expectOne(`${API}/profesionales/5`).flush(profesional());
    await settle();

    // 14 days from today; the Sunday (18 Oct) cannot be picked.
    const days = Array.from(el.querySelectorAll<HTMLButtonElement>('.day'));
    expect(days.length).toBe(14);
    expect(days[0].getAttribute('aria-label')).toContain('miércoles, 14 de octubre de 2026');
    const sunday = days.find((d) =>
      d.getAttribute('aria-label')?.includes('domingo, 18 de octubre'),
    )!;
    expect(sunday.disabled).toBe(true);
    expect(sunday.getAttribute('aria-label')).toContain('sin atención');
    expect(days.filter((d) => d.disabled).length).toBe(2);

    await click('.day', 'jue');
    expect(router.url).toContain('fecha=2026-10-15');
    const slots = slotsReq();
    expect(slots.request.params.get('fecha')).toBe('2026-10-15');
    expect(slots.request.params.get('duracion')).toBe('30');
    slots.flush(disponibilidad);
    await settle();

    expect(el.textContent).toContain('3 horarios libres');
    expect(
      Array.from(el.querySelectorAll('.slot')).map((s) =>
        s.textContent?.trim().replace(/\s/g, ' '),
      ),
    ).toEqual(['9:00 a. m.', '10:30 a. m.', '2:00 p. m.']);

    await click('.slot', '10:30');
    expect(router.url).toContain('hora=10:30');
    expect(stepTitle()).toBe('Confirma tu cita');
    expect(el.textContent).toContain('Sede Chapinero, Bogotá');
  });

  it('opens at the date step from a professional deep link and fixes the specialty in the URL', async () => {
    await open('/citas?profesional_id=5');
    especialidadesReq().flush(especialidades);
    http.expectOne(`${API}/profesionales/5`).flush(profesional());
    await settle();

    expect(stepTitle()).toBe('Día y hora');
    expect(router.url).toBe('/citas?especialidad_id=3&profesional_id=5');
    expect(el.textContent).toContain('Medicina interna');
    expect(el.textContent).toContain('Sofía Beltrán Pardo');
    http.expectNone((r) => r.url === `${API}/profesionales`);
  });

  it('restores the whole selection from the URL (date and time included)', async () => {
    await open('/citas?especialidad_id=3&profesional_id=5&fecha=2026-10-15&hora=09:00');
    especialidadesReq().flush(especialidades);
    http.expectOne(`${API}/profesionales/5`).flush(profesional());
    await settle();
    slotsReq().flush(disponibilidad);
    await settle();

    expect(stepTitle()).toBe('Confirma tu cita');
    expect(el.textContent).toContain('jueves, 15 de octubre de 2026');
    expect(el.textContent).toMatch(/9:00\s+a\. m\./);
  });

  it('drops a time from the URL that is no longer free and says so', async () => {
    await open('/citas?especialidad_id=3&profesional_id=5&fecha=2026-10-15&hora=11:00');
    especialidadesReq().flush(especialidades);
    http.expectOne(`${API}/profesionales/5`).flush(profesional());
    await settle();
    slotsReq().flush(disponibilidad);
    await settle();

    expect(stepTitle()).toBe('Día y hora');
    expect(router.url).not.toContain('hora=');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Ese horario ya no está disponible',
    );
  });

  it('ignores a Sunday or out-of-range date in the URL', async () => {
    await open('/citas?especialidad_id=3&profesional_id=5&fecha=2026-10-18');
    especialidadesReq().flush(especialidades);
    http.expectOne(`${API}/profesionales/5`).flush(profesional());
    await settle();

    http.expectNone((r) => r.url === `${API}/profesionales/5/disponibilidad`);
    expect(el.textContent).toContain('Elige un día para ver los horarios libres.');
  });

  it('warns when the linked professional is inactive and offers the list instead', async () => {
    await open('/citas?especialidad_id=3&profesional_id=5');
    especialidadesReq().flush(especialidades);
    http.expectOne(`${API}/profesionales/5`).flush(profesional({ activo: false }));
    await settle();
    profesionalesReq().flush({ items: [], total: 0, limit: 100, offset: 0 });
    await settle();

    expect(stepTitle()).toBe('Profesional');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('no está atendiendo citas');
  });

  const atConfirmStep = async () => {
    await open('/citas?especialidad_id=3&profesional_id=5&fecha=2026-10-15&hora=09:00');
    especialidadesReq().flush(especialidades);
    http.expectOne(`${API}/profesionales/5`).flush(profesional());
    await settle();
    slotsReq().flush(disponibilidad);
    await settle();
  };

  it('asks anonymous visitors to sign in, keeping the selection in the returnUrl', async () => {
    await atConfirmStep();

    expect(el.textContent).toContain('Para confirmar necesitas ingresar');
    expect(
      Array.from(el.querySelectorAll('button')).some((b) =>
        b.textContent?.includes('Confirmar cita'),
      ),
    ).toBe(false);

    const motivo = el.querySelector<HTMLTextAreaElement>('#cita-motivo')!;
    motivo.value = 'Dolor de cabeza';
    motivo.dispatchEvent(new Event('input'));
    await settle();

    const login = Array.from(el.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Ingresar para confirmar'),
    )!;
    const href = new URL(login.getAttribute('href')!, 'http://x');
    expect(href.pathname).toBe('/ingresar');
    const back = href.searchParams.get('returnUrl')!;
    expect(back).toContain('/citas?');
    expect(back).toContain('profesional_id=5');
    expect(back).toContain('fecha=2026-10-15');
    expect(back).toContain('hora=09:00');

    login.click(); // saves the typed reason before leaving
    expect(sessionStorage.getItem('meridiana.cita-borrador')).toBe('Dolor de cabeza');
  });

  it('restores the saved reason after coming back from the login', async () => {
    sessionStorage.setItem('meridiana.cita-borrador', 'Dolor de cabeza');
    await atConfirmStep();
    expect(el.querySelector<HTMLTextAreaElement>('#cita-motivo')!.value).toBe('Dolor de cabeza');
    expect(sessionStorage.getItem('meridiana.cita-borrador')).toBeNull();
  });

  it('requires a reason before confirming', async () => {
    await atConfirmStep();
    await logIn();

    await click('button[type="submit"]');
    http.expectNone(`${API}/citas`);
    expect(el.querySelector('#cita-motivo-error')?.textContent).toContain(
      'Este campo es obligatorio.',
    );
  });

  it('confirms the appointment and shows the summary with a link to Mis citas', async () => {
    await atConfirmStep();
    await logIn();

    const motivo = el.querySelector<HTMLTextAreaElement>('#cita-motivo')!;
    motivo.value = '  Control general ';
    motivo.dispatchEvent(new Event('input'));
    await click('button[type="submit"]');

    const post = http.expectOne(`${API}/citas`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      profesional_id: 5,
      inicio: '2026-10-15T09:00:00-05:00',
      duracion_min: 30,
      motivo: 'Control general',
    });
    post.flush(citaCreada, { status: 201, statusText: 'Created' });
    await settle();

    expect(el.querySelector('#cita-creada')?.textContent).toContain('Tu cita quedó confirmada');
    expect(el.textContent).toContain('Sofía Beltrán Pardo');
    expect(el.textContent).toContain('Control general');
    expect(el.querySelector('a[href="/mis-citas"]')).toBeTruthy();
  });

  it('on 409 explains the conflict, goes back to the time step and refreshes the slots', async () => {
    await atConfirmStep();
    await logIn();
    const motivo = el.querySelector<HTMLTextAreaElement>('#cita-motivo')!;
    motivo.value = 'Control';
    motivo.dispatchEvent(new Event('input'));
    await click('button[type="submit"]');

    http
      .expectOne(`${API}/citas`)
      .flush(
        { detail: 'El profesional ya tiene una cita en ese horario' },
        { status: 409, statusText: 'Conflict' },
      );
    await settle();

    expect(stepTitle()).toBe('Día y hora');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'El profesional ya tiene una cita en ese horario',
    );
    expect(router.url).not.toContain('hora=');
    const refreshed = slotsReq();
    refreshed.flush({ ...disponibilidad, huecos: [hueco('10:30')] });
    await settle();
    expect(Array.from(el.querySelectorAll('.slot')).length).toBe(1);
  });

  it('on 401 while confirming sends the user to /ingresar with the selection to return to', async () => {
    await atConfirmStep();
    await logIn();
    const navigate = vi.spyOn(router, 'navigate');
    const motivo = el.querySelector<HTMLTextAreaElement>('#cita-motivo')!;
    motivo.value = 'Control';
    motivo.dispatchEvent(new Event('input'));
    await click('button[type="submit"]');

    http
      .expectOne(`${API}/citas`)
      .flush({ detail: 'x' }, { status: 401, statusText: 'Unauthorized' });
    await settle();

    const call = navigate.mock.calls.find((c) => (c[0] as string[])[0] === '/ingresar')!;
    expect((call[1] as { queryParams: { returnUrl: string } }).queryParams.returnUrl).toContain(
      'profesional_id=5',
    );
    expect(sessionStorage.getItem('meridiana.cita-borrador')).toBe('Control');
  });

  it('tells administrators that booking is for patients', async () => {
    await open('/citas');
    especialidadesReq().flush(especialidades);
    await logIn(usuarioAdmin);

    expect(el.textContent).toContain('las citas en línea son para pacientes');
    expect(el.querySelector('a[href="/admin/agenda"]')).toBeTruthy();
  });

  it('lets the user go back to a previous step with "Cambiar"', async () => {
    await atConfirmStep();
    await click('button', 'Cambiar día y hora');
    expect(stepTitle()).toBe('Día y hora');
    expect(router.url).toContain('fecha=2026-10-15');
    expect(router.url).not.toContain('hora=');
  });
});
