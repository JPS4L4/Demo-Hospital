import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Noticia } from './noticia.model';
import { Noticias } from './noticias';

const URL = 'http://localhost:8000/noticias';

const noticias: Noticia[] = [
  { id: 2, titulo: 'Segunda noticia', contenido: 'Contenido B', fecha_publicacion: '2026-10-05T10:00:00Z' },
  { id: 1, titulo: 'Primera noticia', contenido: 'Contenido A', fecha_publicacion: '2026-09-01T10:00:00Z' },
];

describe('Noticias', () => {
  let fixture: ComponentFixture<Noticias>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Noticias],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Noticias);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('shows a loading status while the request is pending', () => {
    http.expectOne(URL);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Cargando noticias');
    expect(el.querySelector('section')?.getAttribute('aria-busy')).toBe('true');
  });

  it('renders the news in API order with links to the detail page', async () => {
    http.expectOne(URL).flush(noticias);
    await settle();

    const titles = Array.from(el.querySelectorAll('h3')).map((h) => h.textContent?.trim());
    expect(titles).toEqual(['Segunda noticia', 'Primera noticia']);
    expect(el.querySelector('h3 a')?.getAttribute('href')).toBe('/noticias/2');
  });

  it('shows an empty state when there are no news', async () => {
    http.expectOne(URL).flush([]);
    await settle();

    expect(el.textContent).toContain('Aún no hay noticias');
  });

  it('shows an error with a retry that requests the list again', async () => {
    http.expectOne(URL).flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    const alert = el.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain('No pudimos cargar las noticias');

    (alert?.querySelector('button') as HTMLButtonElement).click();
    await settle();

    http.expectOne(URL).flush(noticias);
    await settle();
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(el.querySelectorAll('h3').length).toBe(2);
  });
});
