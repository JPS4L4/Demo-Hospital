import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService, isProtectedUrl, safeReturnUrl } from './auth.service';
import { API, STORAGE_KEY, sesion, usuarioAdmin, usuarioPaciente } from './auth.testing';

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  function setup(): void {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => {
    http.verify();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('login stores the token with its expiry and exposes the user', () => {
    setup();
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    service.login('paula.herrera@example.com', 'secreto-123').subscribe();

    const req = http.expectOne(`${API}/auth/login`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      email: 'paula.herrera@example.com',
      password: 'secreto-123',
    });
    req.flush(sesion(usuarioPaciente));

    expect(service.token()).toBe('tok-123');
    expect(service.usuario()?.email).toBe('paula.herrera@example.com');
    expect(service.isPaciente()).toBe(true);
    expect(service.isAdmin()).toBe(false);
    expect(service.nombre()).toBe('Paula Herrera');
    expect(service.iniciales()).toBe('PH');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
      token: 'tok-123',
      expiresAt: 1_000_000 + 3_600_000,
    });
  });

  it('identifies an admin without a patient record', () => {
    setup();
    service.login('admin@meridiana.example', 'x').subscribe();
    http.expectOne(`${API}/auth/login`).flush(sesion(usuarioAdmin));
    expect(service.isAdmin()).toBe(true);
    expect(service.nombre()).toBe('Administración');
    expect(service.iniciales()).toBe('AD');
  });

  it('registro opens a session like login', () => {
    setup();
    service
      .registro({
        tipo_documento: 'CC',
        numero_documento: '1020304050',
        nombres: 'Paula',
        apellidos: 'Herrera',
        fecha_nacimiento: '1990-05-17',
        email: 'paula.herrera@example.com',
        telefono: '3001234567',
        password: 'secreto-123',
      })
      .subscribe();
    const req = http.expectOne(`${API}/auth/registro`);
    expect(req.request.method).toBe('POST');
    req.flush(sesion(usuarioPaciente));
    expect(service.usuario()?.rol).toBe('paciente');
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('logout clears the session and the stored token', () => {
    setup();
    service.login('a@b.co', 'x').subscribe();
    http.expectOne(`${API}/auth/login`).flush(sesion(usuarioPaciente));

    service.logout();

    expect(service.token()).toBeNull();
    expect(service.usuario()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('rehydrates a stored token through /auth/me, sending the bearer header', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: 'guardado', expiresAt: Date.now() + 60_000 }),
    );
    setup();

    const ready = service.whenReady();
    expect(service.restoring()).toBe(true);
    const req = http.expectOne(`${API}/auth/me`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer guardado');
    req.flush(usuarioPaciente);
    await ready;

    expect(service.restoring()).toBe(false);
    expect(service.usuario()?.id).toBe(usuarioPaciente.id);
    expect(service.token()).toBe('guardado');
  });

  it('ignores and removes an expired stored token without calling the API', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: 'viejo', expiresAt: Date.now() - 1 }),
    );
    setup();

    await service.whenReady();

    http.expectNone(`${API}/auth/me`);
    expect(service.token()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('drops a corrupt stored value', async () => {
    localStorage.setItem(STORAGE_KEY, '{no-json');
    setup();
    await service.whenReady();
    expect(service.usuario()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('clears the session when /auth/me answers 401', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: 'revocado', expiresAt: Date.now() + 60_000 }),
    );
    setup();

    const ready = service.whenReady();
    http
      .expectOne(`${API}/auth/me`)
      .flush({ detail: 'No autenticado' }, { status: 401, statusText: 'Unauthorized' });
    await ready;

    expect(service.usuario()).toBeNull();
    expect(service.token()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('keeps the stored token when /auth/me fails for another reason (API down)', async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ token: 'valido', expiresAt: Date.now() + 60_000 }),
    );
    setup();

    const ready = service.whenReady();
    http.expectOne(`${API}/auth/me`).error(new ProgressEvent('error'));
    await ready;

    expect(service.usuario()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();
  });

  it('restores only once', async () => {
    setup();
    await service.whenReady();
    await service.whenReady();
    http.expectNone(`${API}/auth/me`);
  });
});

describe('safeReturnUrl', () => {
  it('accepts internal paths and rejects external or auth pages', () => {
    expect(safeReturnUrl('/citas?profesional_id=3')).toBe('/citas?profesional_id=3');
    expect(safeReturnUrl('//evil.example')).toBeNull();
    expect(safeReturnUrl('https://evil.example')).toBeNull();
    expect(safeReturnUrl('/\\evil')).toBeNull();
    expect(safeReturnUrl('/ingresar?returnUrl=/x')).toBeNull();
    expect(safeReturnUrl('/registro')).toBeNull();
    expect(safeReturnUrl(null)).toBeNull();
  });
});

describe('isProtectedUrl', () => {
  it('flags the patient and admin areas only', () => {
    expect(isProtectedUrl('/mis-citas')).toBe(true);
    expect(isProtectedUrl('/admin/agenda?x=1')).toBe(true);
    expect(isProtectedUrl('/citas?profesional_id=3')).toBe(false);
    expect(isProtectedUrl('/administracion')).toBe(false);
  });
});
