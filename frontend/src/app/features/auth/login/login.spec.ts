import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { API, sesion, usuarioAdmin, usuarioPaciente } from '../../../core/auth/auth.testing';
import { Login } from './login';

describe('Login', () => {
  let fixture: ComponentFixture<Login>;
  let http: HttpTestingController;
  let router: Router;
  let el: HTMLElement;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(Login);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  const input = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`)!;

  async function type(id: string, value: string): Promise<void> {
    const field = input(id);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function submit(): Promise<void> {
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  }

  it('declares the right autocomplete hints', () => {
    expect(input('login-email').getAttribute('autocomplete')).toBe('username');
    expect(input('login-password').getAttribute('autocomplete')).toBe('current-password');
  });

  it('validates required fields without calling the API and marks them invalid', async () => {
    await submit();

    http.expectNone(`${API}/auth/login`);
    expect(el.textContent).toContain('Este campo es obligatorio.');
    expect(input('login-email').getAttribute('aria-invalid')).toBe('true');
    expect(input('login-email').getAttribute('aria-describedby')).toBe('login-email-error');
  });

  it('rejects a malformed email', async () => {
    await type('login-email', 'no-es-un-correo');
    await type('login-password', 'algo');
    await submit();
    http.expectNone(`${API}/auth/login`);
    expect(el.textContent).toContain('Escribe un correo válido');
  });

  it('logs a patient in and goes to Mis citas', async () => {
    await type('login-email', ' paula.herrera@example.com ');
    await type('login-password', 'Paciente-Demo-2026');
    await submit();

    const req = http.expectOne(`${API}/auth/login`);
    expect(req.request.body).toEqual({
      email: 'paula.herrera@example.com',
      password: 'Paciente-Demo-2026',
    });
    req.flush(sesion(usuarioPaciente));

    expect(router.navigateByUrl).toHaveBeenCalledWith('/mis-citas');
  });

  it('sends an admin to the panel', async () => {
    await type('login-email', 'admin@meridiana.example');
    await type('login-password', 'Admin-Demo-2026');
    await submit();
    http.expectOne(`${API}/auth/login`).flush(sesion(usuarioAdmin));
    expect(router.navigateByUrl).toHaveBeenCalledWith('/admin');
  });

  it('honours a safe returnUrl and ignores an external one', async () => {
    fixture.componentRef.setInput('returnUrl', '/citas?profesional_id=3');
    await type('login-email', 'a@b.co');
    await type('login-password', 'x');
    await submit();
    http.expectOne(`${API}/auth/login`).flush(sesion(usuarioPaciente));
    expect(router.navigateByUrl).toHaveBeenLastCalledWith('/citas?profesional_id=3');
  });

  it('ignores an external returnUrl', async () => {
    fixture.componentRef.setInput('returnUrl', 'https://evil.example');
    await type('login-email', 'a@b.co');
    await type('login-password', 'x');
    await submit();
    http.expectOne(`${API}/auth/login`).flush(sesion(usuarioPaciente));
    expect(router.navigateByUrl).toHaveBeenLastCalledWith('/mis-citas');
  });

  it('shows the server message on wrong credentials and re-enables the button', async () => {
    await type('login-email', 'a@b.co');
    await type('login-password', 'mala');
    await submit();
    http
      .expectOne(`${API}/auth/login`)
      .flush(
        { detail: 'Correo o contraseña incorrectos' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await fixture.whenStable();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain(
      'Correo o contraseña incorrectos',
    );
    expect(el.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(router.navigateByUrl).not.toHaveBeenCalled();
  });

  it('toggles password visibility, exposing the state with aria-pressed', async () => {
    const toggle = el.querySelector<HTMLButtonElement>('button[aria-pressed]')!;
    expect(input('login-password').type).toBe('password');
    expect(toggle.getAttribute('aria-label')).toBe('Mostrar contraseña');

    toggle.click();
    await fixture.whenStable();

    expect(input('login-password').type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Ocultar contraseña');
  });

  it('lists the demo accounts and fills the form from one of them', async () => {
    expect(el.textContent).toContain('Cuentas de demostración');
    expect(el.textContent).toContain('admin@meridiana.example');

    const useButtons = Array.from(el.querySelectorAll('aside button'));
    (useButtons[0] as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(input('login-email').value).toBe('paula.herrera@example.com');
    expect(input('login-password').value).toBe('Paciente-Demo-2026');
  });

  it('explains a session that expired', async () => {
    fixture.componentRef.setInput('sesion', 'expirada');
    await fixture.whenStable();
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Tu sesión venció');
  });
});
