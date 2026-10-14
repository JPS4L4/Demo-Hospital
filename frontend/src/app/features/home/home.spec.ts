import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';

const NOTICIAS = 'http://localhost:8000/noticias';
const SEDES = 'http://localhost:8000/sedes';
const ESPECIALIDADES = 'http://localhost:8000/especialidades';

const catalogo = {
  items: [
    { id: 1, nombre: 'Cardiología', descripcion: '' },
    { id: 5, nombre: 'Medicina Interna', descripcion: '' },
    { id: 9, nombre: 'Otra especialidad', descripcion: '' },
  ],
  total: 3,
  limit: 100,
  offset: 0,
};

const noticia = (id: number) => ({
  id,
  titulo: 'Noticia ' + id,
  contenido: 'Contenido',
  fecha_publicacion: '2026-10-01T10:00:00Z',
});

describe('Home', () => {
  let fixture: ComponentFixture<Home>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(Home);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('renders the hero with a single h1 and the booking call to action', () => {
    http.expectOne(NOTICIAS);
    http.expectOne(SEDES);
    http.expectOne((r) => r.url === ESPECIALIDADES);

    expect(el.querySelectorAll('h1').length).toBe(1);
    const cta = Array.from(el.querySelectorAll('a')).find((a) => a.textContent?.includes('Pedir cita'));
    expect(cta?.getAttribute('href')).toBe('/citas');
  });

  it('lists the specialties', () => {
    http.expectOne(NOTICIAS);
    http.expectOne(SEDES);
    http.expectOne((r) => r.url === ESPECIALIDADES);

    expect(el.textContent).toContain('Cardiología');
    expect(el.textContent).toContain('Urgencias 24 horas');
  });

  it('shows only the three latest news and every sede from the API', async () => {
    http.expectOne(NOTICIAS).flush([1, 2, 3, 4, 5].map(noticia));
    http.expectOne(SEDES).flush([
      { id: 1, nombre: 'Sede Chapinero', direccion: 'Carrera 13 # 63-40', ciudad: 'Bogotá', telefono: null },
      { id: 2, nombre: 'Sede El Poblado', direccion: 'Calle 10 # 34-25', ciudad: 'Medellín', telefono: '+57 604 555 0102' },
    ]);
    http.expectOne((r) => r.url === ESPECIALIDADES).flush(catalogo);
    await settle();

    const titles = Array.from(el.querySelectorAll('app-news-card h3')).map((h) => h.textContent?.trim());
    expect(titles).toEqual(['Noticia 1', 'Noticia 2', 'Noticia 3']);
    expect(el.textContent).toContain('Sede Chapinero');
    expect(el.textContent).toContain('Sede El Poblado');
  });

  it('keeps the rest of the page usable when the API fails', async () => {
    http.expectOne(NOTICIAS).error(new ProgressEvent('error'));
    http.expectOne(SEDES).error(new ProgressEvent('error'));
    http.expectOne((r) => r.url === ESPECIALIDADES).error(new ProgressEvent('error'));
    await settle();

    expect(el.querySelectorAll('[role="alert"]').length).toBe(2);
    expect(el.querySelector('h1')).toBeTruthy();
  });

  describe('specialties', () => {
    const link = (name: string) =>
      Array.from(el.querySelectorAll('#titulo-especialidades ~ * a, ul a')).find((a) =>
        a.textContent?.includes(name),
      ) as HTMLAnchorElement;

    it('links each specialty to the professionals filtered by its real id (accent and case insensitive)', async () => {
      http.expectOne(NOTICIAS).flush([]);
      http.expectOne(SEDES).flush([]);
      http.expectOne((r) => r.url === ESPECIALIDADES).flush(catalogo);
      await settle();

      expect(link('Cardiología').getAttribute('href')).toBe('/profesionales?especialidad_id=1');
      expect(link('Medicina interna').getAttribute('href')).toBe('/profesionales?especialidad_id=5');
      // Sin coincidencia en la API: enlaza al listado completo.
      expect(link('Pediatría').getAttribute('href')).toBe('/profesionales');
    });

    it('shows the real specialty count in the hero stat', async () => {
      http.expectOne(NOTICIAS).flush([]);
      http.expectOne(SEDES).flush([]);
      http.expectOne((r) => r.url === ESPECIALIDADES).flush(catalogo);
      await settle();

      const stat = Array.from(el.querySelectorAll('dl div')).find((d) => d.textContent?.includes('Especialidades'));
      expect(stat?.querySelector('dd')?.textContent?.trim()).toBe('3');
    });

    it('falls back to the fixed list, plain links and the 6+ stat when the API fails', async () => {
      http.expectOne(NOTICIAS).flush([]);
      http.expectOne(SEDES).flush([]);
      http.expectOne((r) => r.url === ESPECIALIDADES).error(new ProgressEvent('error'));
      await settle();

      expect(link('Cardiología').getAttribute('href')).toBe('/profesionales');
      const stat = Array.from(el.querySelectorAll('dl div')).find((d) => d.textContent?.includes('Especialidades'));
      expect(stat?.querySelector('dd')?.textContent?.trim()).toBe('6+');
    });
  });
});
