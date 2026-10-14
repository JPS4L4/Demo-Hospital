import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoticiaDetalle } from './noticia-detalle';

const URL = 'http://localhost:8000/noticias/3';

describe('NoticiaDetalle', () => {
  let fixture: ComponentFixture<NoticiaDetalle>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NoticiaDetalle],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(NoticiaDetalle);
    fixture.componentRef.setInput('id', '3');
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders title, date and one paragraph per block of content', async () => {
    http.expectOne(URL).flush({
      id: 3,
      titulo: 'Nueva unidad',
      contenido: 'Primer párrafo.\n\nSegundo párrafo.',
      fecha_publicacion: '2026-10-05T15:00:00Z',
    });
    await settle();

    expect(el.querySelector('h1')?.textContent).toContain('Nueva unidad');
    expect(el.querySelectorAll('article p').length).toBe(2);
    expect(el.querySelector('time')?.getAttribute('datetime')).toBe('2026-10-05T15:00:00Z');
  });

  it('shows a not-found message when the API answers 404', async () => {
    http.expectOne(URL).flush({ detail: 'Noticia no encontrada' }, { status: 404, statusText: 'Not Found' });
    await settle();

    expect(el.textContent).toContain('No encontramos esta noticia');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows a retryable error for other failures', async () => {
    http.expectOne(URL).error(new ProgressEvent('error'));
    await settle();

    expect(el.querySelector('[role="alert"]')?.textContent).toContain('No pudimos cargar la noticia');
    expect(el.querySelector('[role="alert"] button')).toBeTruthy();
  });
});
