import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from './auth.service';
import { API, STORAGE_KEY, sesion, usuarioPaciente } from './auth.testing';

const tick = () => new Promise((resolve) => setTimeout(resolve));

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let auth: AuthService;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    http.verify();
    localStorage.clear();
  });

  function logIn(): void {
    auth.login('a@b.co', 'x').subscribe();
    http.expectOne(`${API}/auth/login`).flush(sesion(usuarioPaciente));
  }

  it('sends no Authorization header while logged out', () => {
    client.get(`${API}/noticias`).subscribe();
    expect(http.expectOne(`${API}/noticias`).request.headers.has('Authorization')).toBe(false);
  });

  it('adds the bearer token to requests for the API', () => {
    logIn();
    client.get(`${API}/citas`).subscribe();
    expect(http.expectOne(`${API}/citas`).request.headers.get('Authorization')).toBe(
      'Bearer tok-123',
    );
  });

  it('never leaks the token to other origins (including look-alike hosts)', () => {
    logIn();
    client.get('https://example.org/api').subscribe();
    client.get('http://localhost:8000.evil.example/x').subscribe();
    expect(http.expectOne('https://example.org/api').request.headers.has('Authorization')).toBe(
      false,
    );
    expect(
      http.expectOne('http://localhost:8000.evil.example/x').request.headers.has('Authorization'),
    ).toBe(false);
  });

  it('on 401 clears the session and goes to /ingresar with returnUrl when on a protected page', async () => {
    logIn();
    await router.navigateByUrl('/mis-citas');

    client.get(`${API}/citas`).subscribe({ error: () => undefined });
    http
      .expectOne(`${API}/citas`)
      .flush({ detail: 'Sesión vencida' }, { status: 401, statusText: 'Unauthorized' });
    await tick();

    expect(auth.token()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(router.url).toBe('/ingresar?returnUrl=%2Fmis-citas&sesion=expirada');
  });

  it('on 401 in a public page clears the session but stays put', async () => {
    logIn();
    await router.navigateByUrl('/citas?profesional_id=3');

    client.post(`${API}/citas`, {}).subscribe({ error: () => undefined });
    http
      .expectOne(`${API}/citas`)
      .flush({ detail: 'x' }, { status: 401, statusText: 'Unauthorized' });
    await tick();

    expect(auth.usuario()).toBeNull();
    expect(router.url).toBe('/citas?profesional_id=3');
  });

  it('treats a 401 from /auth/login as wrong credentials, not an expired session', async () => {
    await router.navigateByUrl('/mis-citas');
    auth.login('a@b.co', 'mala').subscribe({ error: () => undefined });
    http
      .expectOne(`${API}/auth/login`)
      .flush(
        { detail: 'Correo o contraseña incorrectos' },
        { status: 401, statusText: 'Unauthorized' },
      );
    await tick();
    expect(router.url).toBe('/mis-citas');
  });
});
