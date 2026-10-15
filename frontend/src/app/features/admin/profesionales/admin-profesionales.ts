import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  catchError,
  combineLatest,
  debounceTime,
  distinctUntilChanged,
  map,
  of,
  switchMap,
} from 'rxjs';
import {
  applyProblem,
  focusFirstInvalid,
  parseApiError,
  problemMessage,
  requiredText,
  telefonoValido,
} from '../../../core/forms';
import { Page, positiveInt } from '../../../core/page';
import { LOADING, Remote, keepPrevious, toRemote } from '../../../core/remote';
import { Field } from '../../../shared/ui/field';
import { Icon } from '../../../shared/ui/icon';
import { Pagination } from '../../../shared/ui/pagination';
import { StateMessage } from '../../../shared/ui/state-message';
import { EspecialidadesService } from '../../especialidades/especialidades.service';
import { SedesService } from '../../sedes/sedes.service';
import {
  Profesional,
  ProfesionalInput,
  nombreCompleto,
} from '../../profesionales/profesional.model';
import { ProfesionalesService } from '../../profesionales/profesionales.service';

export const ADMIN_PAGE_SIZE = 10;

/** `null` = sin editor; `'nuevo'` = creando; un profesional = editándolo. */
type Edicion = null | 'nuevo' | Profesional;

@Component({
  selector: 'app-admin-profesionales',
  imports: [ReactiveFormsModule, Field, Icon, Pagination, StateMessage],
  templateUrl: './admin-profesionales.html',
})
export class AdminProfesionales {
  private readonly service = inject(ProfesionalesService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private trigger: HTMLElement | null = null;

  protected readonly pageSize = ADMIN_PAGE_SIZE;
  protected readonly search = signal('');
  private readonly q = signal('');
  protected readonly offset = signal(0);
  private readonly reload = signal(0);

  protected readonly especialidades = toSignal(
    inject(EspecialidadesService)
      .listar()
      .pipe(catchError(() => of([]))),
    {
      initialValue: [],
    },
  );
  protected readonly sedes = toSignal(
    inject(SedesService)
      .listar()
      .pipe(catchError(() => of([]))),
    {
      initialValue: [],
    },
  );

  private readonly result = toSignal(
    combineLatest([
      toObservable(this.q),
      toObservable(this.offset),
      toObservable(this.reload),
    ]).pipe(
      // `activo: null` incluye los inactivos: aquí se gestionan.
      switchMap(([q, offset]) =>
        toRemote(this.service.listar({ q, activo: null, limit: ADMIN_PAGE_SIZE, offset })),
      ),
    ),
    { initialValue: LOADING as Remote<Page<Profesional>> },
  );

  protected readonly view = keepPrevious(this.result);

  protected readonly edicion = signal<Edicion>(null);
  protected readonly guardando = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly anuncio = signal('');
  /** Filas ya actualizadas por el servidor; se descartan cuando llega una lista nueva. */
  private readonly cambios = linkedSignal<unknown, Record<number, Profesional>>({
    source: this.result,
    computation: () => ({}),
  });

  protected readonly form = inject(FormBuilder).group({
    nombres: ['', [requiredText, Validators.required, Validators.maxLength(120)]],
    apellidos: ['', [requiredText, Validators.required, Validators.maxLength(120)]],
    especialidad_id: [null as number | null, [Validators.required]],
    sede_id: [null as number | null, [Validators.required]],
    registro_profesional: ['', [requiredText, Validators.required, Validators.maxLength(40)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [telefonoValido]],
    bio: ['', [Validators.maxLength(600)]],
    activo: [true],
  });

  protected readonly nombre = nombreCompleto;
  protected readonly esNuevo = (e: Edicion) => e === 'nuevo';
  protected readonly actual = (p: Profesional) => this.cambios()[p.id] ?? p;

  constructor() {
    // La búsqueda se aplica tras una pausa al escribir y vuelve a la primera página.
    toObservable(this.search)
      .pipe(
        debounceTime(300),
        map((t) => t.trim()),
        distinctUntilChanged(),
        takeUntilDestroyed(),
      )
      .subscribe((q) => {
        this.q.set(q);
        this.offset.set(0);
      });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected limpiar(): void {
    this.search.set('');
    this.q.set('');
    this.offset.set(0);
  }

  protected onOffset(offset: number): void {
    this.offset.set(offset);
  }

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  protected abrir(edicion: 'nuevo' | Profesional, event: Event): void {
    this.trigger = event.currentTarget as HTMLElement;
    this.formError.set(null);
    if (edicion === 'nuevo') {
      this.form.reset({
        nombres: '',
        apellidos: '',
        especialidad_id: null,
        sede_id: null,
        registro_profesional: '',
        email: '',
        telefono: '',
        bio: '',
        activo: true,
      });
    } else {
      this.form.reset({
        nombres: edicion.nombres,
        apellidos: edicion.apellidos,
        especialidad_id: edicion.especialidad_id,
        sede_id: edicion.sede_id,
        registro_profesional: edicion.registro_profesional,
        email: edicion.email,
        telefono: edicion.telefono ?? '',
        bio: edicion.bio ?? '',
        activo: edicion.activo,
      });
    }
    this.edicion.set(edicion);
    afterNextRender(
      () => this.host.nativeElement.querySelector<HTMLElement>('#prof-nombres')?.focus(),
      {
        injector: this.injector,
      },
    );
  }

  protected cerrar(): void {
    this.edicion.set(null);
    this.restoreFocus();
  }

  protected onSelectNumber(control: 'especialidad_id' | 'sede_id', event: Event): void {
    this.form.controls[control].setValue(positiveInt((event.target as HTMLSelectElement).value));
  }

  protected guardar(): void {
    const edicion = this.edicion();
    if (!edicion || this.guardando()) return;
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const v = this.form.getRawValue();
    const datos: ProfesionalInput = {
      nombres: v.nombres!.trim(),
      apellidos: v.apellidos!.trim(),
      especialidad_id: v.especialidad_id!,
      sede_id: v.sede_id!,
      registro_profesional: v.registro_profesional!.trim(),
      email: v.email!.trim(),
      telefono: v.telefono?.trim() || null,
      bio: v.bio?.trim() || null,
      activo: !!v.activo,
    };
    this.guardando.set(true);
    const request =
      edicion === 'nuevo' ? this.service.crear(datos) : this.service.actualizar(edicion.id, datos);
    request.subscribe({
      next: (guardado) => {
        this.guardando.set(false);
        this.edicion.set(null);
        this.anuncio.set(edicion === 'nuevo' ? 'Profesional creado.' : 'Profesional actualizado.');
        this.cambios.update((m) => ({ ...m, [guardado.id]: guardado }));
        // Un profesional nuevo puede caer en cualquier página: se recarga la lista.
        if (edicion === 'nuevo') this.reload.update((n) => n + 1);
        this.restoreFocus();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        // 409: el registro profesional ya existe.
        this.formError.set(
          applyProblem(this.form, parseApiError(err), (detail) =>
            /registro/i.test(detail) ? 'registro_profesional' : null,
          ),
        );
        if (this.formError() === null) focusFirstInvalid(this.host.nativeElement);
      },
    });
  }

  protected alternarActivo(p: Profesional): void {
    const actual = this.actual(p);
    this.actionError.set(null);
    this.busyId.set(p.id);
    const datos: ProfesionalInput = {
      nombres: actual.nombres,
      apellidos: actual.apellidos,
      especialidad_id: actual.especialidad_id,
      sede_id: actual.sede_id,
      registro_profesional: actual.registro_profesional,
      email: actual.email,
      telefono: actual.telefono,
      bio: actual.bio || null,
      activo: !actual.activo,
    };
    this.service.actualizar(p.id, datos).subscribe({
      next: (guardado) => {
        this.cambios.update((m) => ({ ...m, [guardado.id]: guardado }));
        this.busyId.set(null);
        this.anuncio.set(guardado.activo ? 'Profesional activado.' : 'Profesional desactivado.');
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.actionError.set(
          problemMessage(
            parseApiError(err),
            'No pudimos actualizar al profesional. Inténtalo de nuevo.',
          ),
        );
      },
    });
  }

  private restoreFocus(): void {
    const target = this.trigger;
    afterNextRender(
      () =>
        (target?.isConnected
          ? target
          : this.host.nativeElement.querySelector<HTMLElement>('h2')
        )?.focus(),
      {
        injector: this.injector,
      },
    );
  }
}
