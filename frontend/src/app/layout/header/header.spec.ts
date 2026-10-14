import { ComponentFixture, TestBed } from '@angular/core/testing';

import { provideRouter } from '@angular/router';

import { Header } from './header';

describe('Header', () => {
  let component: Header;
  let fixture: ComponentFixture<Header>;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Header],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Header);
    component = fixture.componentInstance;
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

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
});
