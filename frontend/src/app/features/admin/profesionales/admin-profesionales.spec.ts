import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API } from '../../../core/auth/auth.testing';
import { Profesional } from '../../profesionales/profesional.model';
import { AdminProfesionales } from './admin-profesionales';

const profesional = (id: number, over: Partial<Profesional> = {}): Profesional => ({
  id,
  nombres: 'Sofía',
  apellidos: `Beltrán ${id}`,
  especialidad_id: 3,
  sede_id: 1,
  registro_profesional: `RM-${id}`,
  email: `prof${id}@example.com`,
  telefono: null,
  bio: 'Bio',
  activo: true,
  especialidad: { id: 3, nombre: 'Medicina interna' },
  sede: { id: 1, nombre: 'Sede Chapinero', ciudad: 'Bogotá' },
  ...over,
});
const page = (items: Profesional[]) => ({ items, total: items.length, limit: 10, offset: 0 });

describe('AdminProfesionales', () => {
  let fixture: ComponentFixture<AdminProfesionales>;
  let http: HttpTestingController;
  let el: HTMLElement;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminProfesionales],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(AdminProfesionales);
    el = fixture.nativeElement;
    fixture.detectChanges();
  });

  async function settle(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
  }

  const listReq = () => http.expectOne((r) => r.url === `${API}/profesionales`);

  async function load(items: Profesional[]): Promise<void> {
    http
      .expectOne((r) => r.url === `${API}/especialidades`)
      .flush({ items: [{ id: 3, nombre: 'Medicina interna', descripcion: '' }, { id: 4, nombre: 'Pediatría', descripcion: '' }], total: 2, limit: 100, offset: 0 });
    http.expectOne(`${API}/sedes`).flush([{ id: 1, nombre: 'Sede Chapinero', direccion: 'x', ciudad: 'Bogotá', telefono: null }]);
    const req = listReq();
    // Inactive professionals are managed here too.
    expect(req.request.params.has('activo')).toBe(false);
    req.flush(page(items));
    await settle();
  }

  const button = (text: string) =>
    Array.from(el.querySelectorAll<HTMLButtonElement>('button')).find((b) => b.textContent?.includes(text))!;

  async function fill(id: string, value: string): Promise<void> {
    const field = el.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`#${id}`)!;
    field.value = value;
    field.dispatchEvent(new Event(field.tagName === 'SELECT' ? 'change' : 'input'));
    await settle();
  }

  it('lists active and inactive professionals with their status', async () => {
    await load([profesional(1), profesional(2, { activo: false })]);
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Activo');
    expect(rows[1].textContent).toContain('Inactivo');
    expect(rows[0].textContent).toContain('Desactivar');
    expect(rows[1].textContent).toContain('Activar');
  });

  it('deactivates a professional with a PUT carrying the full record', async () => {
    await load([profesional(1)]);
    button('Desactivar').click();
    await settle();

    const put = http.expectOne(`${API}/profesionales/1`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({
      nombres: 'Sofía',
      apellidos: 'Beltrán 1',
      especialidad_id: 3,
      sede_id: 1,
      registro_profesional: 'RM-1',
      email: 'prof1@example.com',
      telefono: null,
      bio: 'Bio',
      activo: false,
    });
    put.flush(profesional(1, { activo: false }));
    await settle();

    expect(el.querySelector('tbody tr')!.textContent).toContain('Inactivo');
    expect(el.querySelector('[role="status"]')?.textContent).toContain('Profesional desactivado.');
  });

  it('creates a professional (POST) after validating the form', async () => {
    await load([profesional(1)]);
    button('Nuevo profesional').click();
    await settle();

    el.querySelector('form.card')!.dispatchEvent(new Event('submit'));
    await settle();
    http.expectNone((r) => r.method === 'POST');
    expect(el.querySelectorAll('form.card [aria-invalid="true"]').length).toBeGreaterThanOrEqual(5);

    await fill('prof-nombres', 'Ana');
    await fill('prof-apellidos', 'Ruiz');
    await fill('prof-especialidad', '4');
    await fill('prof-sede', '1');
    await fill('prof-registro', 'RM-999');
    await fill('prof-email', 'ana.ruiz@example.com');
    await fill('prof-telefono', '300 123 4567');
    el.querySelector('form.card')!.dispatchEvent(new Event('submit'));
    await settle();

    const post = http.expectOne(`${API}/profesionales`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual({
      nombres: 'Ana',
      apellidos: 'Ruiz',
      especialidad_id: 4,
      sede_id: 1,
      registro_profesional: 'RM-999',
      email: 'ana.ruiz@example.com',
      telefono: '300 123 4567',
      bio: null,
      activo: true,
    });
    post.flush(profesional(9), { status: 201, statusText: 'Created' });
    await settle();
    listReq().flush(page([profesional(9), profesional(1)]));
    await settle();
    expect(el.querySelectorAll('tbody tr').length).toBe(2);
  });

  it('shows a duplicated professional registry on its own field', async () => {
    await load([profesional(1)]);
    button('Editar a').click();
    await settle();
    expect(el.querySelector<HTMLInputElement>('#prof-registro')!.value).toBe('RM-1');

    await fill('prof-registro', 'RM-2');
    el.querySelector('form.card')!.dispatchEvent(new Event('submit'));
    await settle();
    http
      .expectOne(`${API}/profesionales/1`)
      .flush({ detail: 'Ya existe un profesional con ese registro profesional' }, { status: 409, statusText: 'Conflict' });
    await settle();

    expect(el.querySelector('#prof-registro-error')?.textContent).toContain('registro profesional');
    expect(el.querySelector('form.card')).not.toBeNull();
  });

  it('shows an empty state when nothing matches', async () => {
    await load([]);
    expect(el.textContent).toContain('No encontramos profesionales');
  });
});
