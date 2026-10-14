import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API } from '../../../core/auth/auth.testing';
import { AdminNoticias } from './admin-noticias';

const noticia = (id: number, titulo = `Noticia ${id}`) => ({
  id,
  titulo,
  contenido: 'Contenido de la noticia',
  fecha_publicacion: '2026-10-01T10:00:00-05:00',
});

describe('AdminNoticias', () => {
  let fixture: ComponentFixture<AdminNoticias>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminNoticias],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminNoticias);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  afterEach(() => http.verify());

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  async function load(items = [noticia(1), noticia(2)]): Promise<void> {
    http.expectOne(`${API}/noticias`).flush(items);
    await settle();
  }

  const button = (text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(text))!;

  async function fill(id: string, value: string): Promise<void> {
    const field = el.querySelector<HTMLInputElement | HTMLTextAreaElement>(`#${id}`)!;
    field.value = value;
    field.dispatchEvent(new Event('input'));
    await settle();
  }

  it('lists the news with date and row actions', async () => {
    await load();
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Noticia 1');
    expect(rows[0].textContent).toContain('1 oct 2026');
    expect(rows[0].textContent).toContain('Editar');
    expect(rows[0].textContent).toContain('Eliminar');
  });

  it('shows an empty state inviting to publish', async () => {
    await load([]);
    expect(el.textContent).toContain('Aún no hay noticias');
  });

  it('creates a news item (POST) and reloads the list', async () => {
    await load();
    button('Nueva noticia').click();
    await settle();
    expect(el.querySelector('#noticia-form-titulo')?.textContent).toContain('Nueva noticia');

    await fill('noticia-titulo', '  Jornada de vacunación ');
    await fill('noticia-contenido', 'Este sábado en todas las sedes.');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    const post = http.expectOne(`${API}/noticias`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({ titulo: 'Jornada de vacunación', contenido: 'Este sábado en todas las sedes.' });
    post.flush(noticia(3, 'Jornada de vacunación'), { status: 201, statusText: 'Created' });
    await settle();

    expect(el.querySelector('form')).toBeNull();
    http.expectOne(`${API}/noticias`).flush([noticia(3, 'Jornada de vacunación'), noticia(1), noticia(2)]);
    await settle();
    expect(el.querySelectorAll('tbody tr').length).toBe(3);
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Noticia publicada.');
  });

  it('validates required fields before calling the API', async () => {
    await load();
    button('Nueva noticia').click();
    await settle();
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    http.expectNone(`${API}/noticias`);
    expect(el.querySelectorAll('[aria-invalid="true"]').length).toBe(2);
    expect(el.textContent).toContain('Este campo es obligatorio.');
  });

  it('edits a news item (PUT) with the current values prefilled', async () => {
    await load();
    button('Editar «Noticia 2»').click();
    await settle();

    expect(el.querySelector<HTMLInputElement>('#noticia-titulo')!.value).toBe('Noticia 2');
    await fill('noticia-titulo', 'Noticia 2 corregida');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();

    const put = http.expectOne(`${API}/noticias/2`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ titulo: 'Noticia 2 corregida', contenido: 'Contenido de la noticia' });
    put.flush(noticia(2, 'Noticia 2 corregida'));
    await settle();
    http.expectOne(`${API}/noticias`).flush([noticia(1), noticia(2, 'Noticia 2 corregida')]);
  });

  it('maps API validation errors onto the form fields', async () => {
    await load();
    button('Nueva noticia').click();
    await settle();
    await fill('noticia-titulo', 'Título');
    await fill('noticia-contenido', 'Texto');
    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    await settle();
    http.expectOne(`${API}/noticias`).flush(
      { detail: [{ loc: ['body', 'titulo'], msg: 'Value error, El título ya existe', type: 'value_error' }] },
      { status: 422, statusText: 'Unprocessable Entity' },
    );
    await settle();

    expect(el.querySelector('#noticia-titulo-error')?.textContent).toContain('El título ya existe');
    expect(el.querySelector('form')).not.toBeNull();
  });

  it('deletes only after confirming (DELETE) and then reloads', async () => {
    await load();
    button('Eliminar «Noticia 1»').click();
    await settle();
    const dialog = el.querySelector('dialog')!;
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.textContent).toContain('Noticia 1');
    http.expectNone(`${API}/noticias/1`);

    button('Sí, eliminar').click();
    await settle();
    const del = http.expectOne(`${API}/noticias/1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });
    await settle();

    expect(dialog.hasAttribute('open')).toBe(false);
    http.expectOne(`${API}/noticias`).flush([noticia(2)]);
    await settle();
    expect(el.querySelectorAll('tbody tr').length).toBe(1);
  });

  it('does not delete when the user backs out', async () => {
    await load();
    button('Eliminar «Noticia 1»').click();
    await settle();
    button('Conservar').click();
    await settle();
    http.expectNone(`${API}/noticias/1`);
    expect(el.querySelector('dialog')!.hasAttribute('open')).toBe(false);
  });
});
