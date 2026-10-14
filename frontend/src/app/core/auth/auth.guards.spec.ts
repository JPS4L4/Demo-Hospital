import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, CanActivateFn, Router, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { adminGuard, authGuard, guestGuard } from './auth.guards';
import { AuthService } from './auth.service';
import { API, sesion, usuarioAdmin, usuarioPaciente } from './auth.testing';

describe('auth guards', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
  });

  afterEach(() => localStorage.clear());

  async function run(guard: CanActivateFn, url = '/mis-citas', returnUrl: string | null = null) {
    const route = { queryParamMap: { get: () => returnUrl } } as unknown as ActivatedRouteSnapshot;
    const state = { url } as RouterStateSnapshot;
    return (await TestBed.runInInjectionContext(() => guard(route, state))) as boolean | UrlTree;
  }

  function logIn(user = usuarioPaciente): void {
    auth.login('a@b.co', 'x').subscribe();
    http.expectOne(`${API}/auth/login`).flush(sesion(user));
  }

  it('authGuard sends visitors to /ingresar remembering where they were going', async () => {
    const result = await run(authGuard, '/mis-citas?x=1');
    expect(router.serializeUrl(result as UrlTree)).toBe('/ingresar?returnUrl=%2Fmis-citas%3Fx%3D1');
  });

  it('authGuard lets a logged-in user through', async () => {
    logIn();
    expect(await run(authGuard)).toBe(true);
  });

  it('authGuard waits for a stored token to be validated before deciding', async () => {
    localStorage.setItem('meridiana.sesion', JSON.stringify({ token: 't', expiresAt: Date.now() + 60_000 }));
    const pending = run(authGuard);
    http.expectOne(`${API}/auth/me`).flush(usuarioPaciente);
    expect(await pending).toBe(true);
  });

  it('adminGuard: visitor -> /ingresar, patient -> home, admin -> allowed', async () => {
    expect(router.serializeUrl((await run(adminGuard, '/admin')) as UrlTree)).toBe('/ingresar?returnUrl=%2Fadmin');

    logIn(usuarioPaciente);
    expect(router.serializeUrl((await run(adminGuard, '/admin')) as UrlTree)).toBe('/');

    auth.clear();
    logIn(usuarioAdmin);
    expect(await run(adminGuard, '/admin')).toBe(true);
  });

  it('guestGuard: visitors may enter; logged-in users are sent to their returnUrl or home', async () => {
    expect(await run(guestGuard, '/ingresar')).toBe(true);

    logIn();
    expect(router.serializeUrl((await run(guestGuard, '/ingresar')) as UrlTree)).toBe('/');
    expect(router.serializeUrl((await run(guestGuard, '/ingresar', '/citas?profesional_id=3')) as UrlTree)).toBe(
      '/citas?profesional_id=3',
    );
    expect(router.serializeUrl((await run(guestGuard, '/ingresar', 'https://evil.example')) as UrlTree)).toBe('/');
  });
});
