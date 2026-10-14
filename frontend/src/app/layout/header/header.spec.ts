import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Router, provideRouter } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { API, sesion, usuarioAdmin, usuarioPaciente } from '../../core/auth/auth.testing';
import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  let el: HTMLElement;
  let http: HttpTestingController;

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  afterEach(() => localStorage.clear());

  async function logIn(user = usuarioPaciente): Promise<void> {
    TestBed.inject(AuthService).login('a@b.co', 'x').subscribe();
    http.expectOne(`${API}/auth/login`).flush(sesion(user));
    await fixture.whenStable();
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('links to the main sections and has a "Pedir cita" call to action', () => {
    const hrefs = Array.from(el.querySelectorAll('nav a')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(expect.arrayContaining(['/', '/noticias', '/sedes', '/profesionales', '/medicamentos']));
    const cta = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('Pedir cita'));
    expect(cta?.getAttribute('href')).toBe('/citas');
  });

  it('opens and closes the mobile menu with the toggle and Escape, keeping aria-expanded in sync', async () => {
    const toggle = el.querySelector('button[aria-controls="menu-movil"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#menu-movil')).toBeNull();

    toggle.click();
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(el.querySelector('#menu-movil')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await fixture.whenStable();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(el.querySelector('#menu-movil')).toBeNull();
  });

  it('toggles the theme and reflects it on the document', async () => {
    const button = el.querySelector('button.theme-toggle') as HTMLButtonElement;
    const before = document.documentElement.dataset['theme'];
    button.click();
    await fixture.whenStable();
    expect(document.documentElement.dataset['theme']).not.toBe(before);
    expect(button.getAttribute('aria-label')).toMatch(/Cambiar a modo/);
  });

  describe('account', () => {
    const link = (text: string) => Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.trim() === text);

    it('offers "Ingresar" (desktop and mobile menu) while logged out', async () => {
      expect(link('Ingresar')?.getAttribute('href')).toBe('/ingresar');
      expect(el.querySelector('.user-button')).toBeNull();

      (el.querySelector('button[aria-controls="menu-movil"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      const mobile = Array.from(el.querySelectorAll('#menu-movil a')).map((a) => a.textContent?.trim());
      expect(mobile).toEqual(expect.arrayContaining(['Ingresar', 'Crear cuenta']));
    });

    it('shows initials and an accessible user menu for a patient', async () => {
      await logIn();
      const button = el.querySelector<HTMLButtonElement>('.user-button')!;
      expect(button.textContent).toContain('PH');
      expect(button.getAttribute('aria-expanded')).toBe('false');
      expect(button.getAttribute('aria-label')).toBe('Menú de Paula Herrera');
      expect(link('Ingresar')).toBeUndefined();

      button.click();
      await fixture.whenStable();
      expect(button.getAttribute('aria-expanded')).toBe('true');
      const panel = el.querySelector('#menu-usuario')!;
      expect(panel.textContent).toContain('paula.herrera@example.com');
      expect(panel.querySelector('a')?.getAttribute('href')).toBe('/mis-citas');
      expect(panel.textContent).not.toContain('Panel');
    });

    it('shows "Panel" instead of "Mis citas" for an admin', async () => {
      await logIn(usuarioAdmin);
      (el.querySelector('.user-button') as HTMLButtonElement).click();
      await fixture.whenStable();
      const panel = el.querySelector('#menu-usuario')!;
      expect(panel.querySelector('a')?.getAttribute('href')).toBe('/admin');
      expect(panel.textContent).not.toContain('Mis citas');
    });

    it('closes the user menu with Escape and returns focus to its button', async () => {
      await logIn();
      const button = el.querySelector<HTMLButtonElement>('.user-button')!;
      button.click();
      await fixture.whenStable();
      el.querySelector<HTMLElement>('#menu-usuario a')!.focus();

      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      await fixture.whenStable();

      expect(el.querySelector('#menu-usuario')).toBeNull();
      expect(document.activeElement).toBe(button);
    });

    it('closes the user menu on an outside click', async () => {
      await logIn();
      (el.querySelector('.user-button') as HTMLButtonElement).click();
      await fixture.whenStable();
      document.body.click();
      await fixture.whenStable();
      expect(el.querySelector('#menu-usuario')).toBeNull();
    });

    it('logs out from the menu, clears the session and goes home', async () => {
      await logIn();
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
      (el.querySelector('.user-button') as HTMLButtonElement).click();
      await fixture.whenStable();

      const logout = Array.from(el.querySelectorAll('#menu-usuario button')).find((b) =>
        b.textContent?.includes('Cerrar sesión'),
      ) as HTMLButtonElement;
      logout.click();
      await fixture.whenStable();

      expect(TestBed.inject(AuthService).usuario()).toBeNull();
      expect(navigate).toHaveBeenCalledWith('/');
      expect(link('Ingresar')).toBeTruthy();
    });

    it('repeats the account links in the mobile menu', async () => {
      await logIn();
      (el.querySelector('button[aria-controls="menu-movil"]') as HTMLButtonElement).click();
      await fixture.whenStable();
      const menu = el.querySelector('#menu-movil')!;
      expect(menu.textContent).toContain('Paula Herrera');
      expect(menu.querySelector('a[href="/mis-citas"]')).toBeTruthy();
      expect(menu.textContent).toContain('Cerrar sesión');
    });
  });
});
