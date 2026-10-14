import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API } from '../../../core/auth/auth.testing';
import { AdminResumen } from './resumen';

const page = (total: number) => ({ items: [], total, limit: 1, offset: 0 });

describe('AdminResumen', () => {
  let fixture: ComponentFixture<AdminResumen>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-14T15:00:00Z'));
    await TestBed.configureTestingModule({
      imports: [AdminResumen],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminResumen);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('counts today, upcoming, active professionals and patients from the list endpoints', async () => {
    const citas = http.match((r) => r.url === `${API}/citas`);
    expect(citas.length).toBe(2);
    const hoy = citas.find((r) => r.request.params.get('hasta') === '2026-10-14T23:59:59')!;
    const proximas = citas.find((r) => !r.request.params.has('hasta'))!;
    expect(hoy.request.params.get('estado')).toBe('programada');
    expect(hoy.request.params.get('desde')).toBe('2026-10-14T00:00:00');
    expect(proximas.request.params.get('desde')).toBe('2026-10-14T10:00:00');
    hoy.flush(page(4));
    proximas.flush(page(11));

    const prof = http.expectOne((r) => r.url === `${API}/profesionales`);
    expect(prof.request.params.get('activo')).toBe('true');
    prof.flush(page(8));
    http.expectOne((r) => r.url === `${API}/pacientes`).flush(page(25));

    await fixture.whenStable();
    fixture.detectChanges();

    const values = Array.from(el.querySelectorAll('.stat-value')).map((v) => v.textContent?.trim());
    expect(values).toEqual(['4', '11', '8', '25']);
  });

  it('offers a retry when a count fails', async () => {
    // One failing request cancels the rest of the group.
    http.match((r) => r.url === `${API}/citas`)[0].flush({ detail: 'x' }, { status: 500, statusText: 'Error' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar el resumen');
  });
});
