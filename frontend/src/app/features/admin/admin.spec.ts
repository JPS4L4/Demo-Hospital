import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Admin } from './admin';

describe('Admin shell', () => {
  it('offers the four sections as sub-navigation and marks the current one', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin', component: Admin, children: [{ path: 'agenda', children: [] }] },
        ]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/agenda', Admin);
    harness.detectChanges();
    const el = harness.routeNativeElement as HTMLElement;

    const nav = el.querySelector('nav[aria-label="Secciones del panel"]')!;
    const links = Array.from(nav.querySelectorAll('a'));
    expect(links.map((a) => a.textContent?.trim())).toEqual([
      'Resumen',
      'Agenda',
      'Noticias',
      'Profesionales',
    ]);
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '/admin',
      '/admin/agenda',
      '/admin/noticias',
      '/admin/profesionales',
    ]);
    const current = links.filter((a) => a.getAttribute('aria-current') === 'page');
    expect(current.map((a) => a.textContent?.trim())).toEqual(['Agenda']);
  });
});
