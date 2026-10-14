import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API, sesion, usuarioPaciente } from '../../../core/auth/auth.testing';
import { Registro } from './registro';

describe('Registro', () => {
  let fixture: ComponentFixture<Registro>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Registro],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Registro);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const field = (id: string) => el.querySelector<HTMLInputElement | HTMLSelectElement>(`#${id}`)!;

  async function type(id: string, value: string): Promise<void> {
    const control = field(id);
    control.value = value;
    control.dispatchEvent(new Event(control.tagName === 'SELECT' ? 'change' : 'input'));
    control.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function fillValid(): Promise<void> {
    await type('reg-documento', '1020304050');
    await type('reg-nombres', ' Paula ');
    await type('reg-apellidos', 'Herrera');
    await type('reg-nacimiento', '1990-05-17');
    await type('reg-telefono', '300 123 4567');
    await type('reg-email', 'paula.nueva@example.com');
    await type('reg-password', 'clave-segura-1');
  }

  async function submit(): Promise<void> {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('sets autocomplete attributes for browsers and password managers', () => {
    expect(field('reg-nombres').getAttribute('autocomplete')).toBe('given-name');
    expect(field('reg-apellidos').getAttribute('autocomplete')).toBe('family-name');
    expect(field('reg-nacimiento').getAttribute('autocomplete')).toBe('bday');
    expect(field('reg-telefono').getAttribute('autocomplete')).toBe('tel');
    expect(field('reg-email').getAttribute('autocomplete')).toBe('email');
    expect(field('reg-password').getAttribute('autocomplete')).toBe('new-password');
  });

  it('blocks an empty form and flags every required field', async () => {
    await submit();
    http.expectNone(`${API}/auth/registro`);
    const invalid = el.querySelectorAll('[aria-invalid="true"]');
    expect(invalid.length).toBe(7);
  });

  it('mirrors the API rules: document, phone, birth date and password length', async () => {
    await fillValid();
    await type('reg-documento', 'AB 12');
    await type('reg-telefono', '12345');
    await type('reg-nacimiento', '2999-01-01');
    await type('reg-password', 'corta');
    await submit();

    http.expectNone(`${API}/auth/registro`);
    expect(el.textContent).toContain('Usa entre 4 y 30 letras o dígitos, sin espacios.');
    expect(el.textContent).toContain('Escribe un teléfono de 7 a 15 dígitos');
    expect(el.textContent).toContain('La fecha de nacimiento debe ser anterior a hoy.');
    expect(el.textContent).toContain('Usa al menos 8 caracteres.');
  });

  it('creates the account with trimmed values and goes to Mis citas', async () => {
    await fillValid();
    await submit();

    const req = http.expectOne(`${API}/auth/registro`);
    expect(req.request.body).toEqual({
      tipo_documento: 'CC',
      numero_documento: '1020304050',
      nombres: 'Paula',
      apellidos: 'Herrera',
      fecha_nacimiento: '1990-05-17',
      telefono: '300 123 4567',
      email: 'paula.nueva@example.com',
      eps: null,
      password: 'clave-segura-1',
    });
    req.flush(sesion(usuarioPaciente));

    expect(router.navigateByUrl).toHaveBeenCalledWith('/mis-citas');
  });

  it('returns to the page the visitor came from', async () => {
    fixture.componentRef.setInput('returnUrl', '/citas?profesional_id=3&fecha=2026-10-15');
    await fillValid();
    await submit();
    http.expectOne(`${API}/auth/registro`).flush(sesion(usuarioPaciente));
    expect(router.navigateByUrl).toHaveBeenCalledWith('/citas?profesional_id=3&fecha=2026-10-15');
  });

  it('maps a 409 on the document and on the email to their own fields', async () => {
    await fillValid();
    await submit();
    http
      .expectOne(`${API}/auth/registro`)
      .flush({ detail: 'Ya existe un paciente con ese tipo y número de documento' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();

    expect(field('reg-documento').getAttribute('aria-invalid')).toBe('true');
    expect(el.querySelector('#reg-documento-error')?.textContent).toContain('número de documento');
    expect(el.querySelector('form [role="alert"]')).toBeNull();

    // Corregir el campo limpia el error del servidor y deja reintentar.
    await type('reg-documento', '1020304051');
    await submit();
    http
      .expectOne(`${API}/auth/registro`)
      .flush({ detail: 'Ya existe una cuenta con ese correo electrónico' }, { status: 409, statusText: 'Conflict' });
    await fixture.whenStable();
    expect(el.querySelector('#reg-email-error')?.textContent).toContain('correo');
  });

  it('maps FastAPI 422 field errors to fields', async () => {
    await fillValid();
    await submit();
    http.expectOne(`${API}/auth/registro`).flush(
      {
        detail: [
          { loc: ['body', 'telefono'], msg: 'Value error, El teléfono debe tener entre 7 y 15 dígitos', type: 'value_error' },
          { loc: ['body', 'eps'], msg: 'String should have at most 120 characters', type: 'string_too_long' },
        ],
      },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await fixture.whenStable();

    expect(el.querySelector('#reg-telefono-error')?.textContent).toContain('El teléfono debe tener entre 7 y 15 dígitos');
    expect(el.querySelector('#reg-eps-error')?.textContent).toContain('Revisa este campo.');
  });

  it('shows a form-level alert when the server cannot be reached', async () => {
    await fillValid();
    await submit();
    http.expectOne(`${API}/auth/registro`).error(new ProgressEvent('error'));
    await fixture.whenStable();
    expect(el.querySelector('form [role="alert"]')?.textContent).toContain('No pudimos conectar');
  });

  it('toggles password visibility', async () => {
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    expect((field('reg-password') as HTMLInputElement).type).toBe('password');
    toggle.click();
    await fixture.whenStable();
    expect((field('reg-password') as HTMLInputElement).type).toBe('text');
  });
});
