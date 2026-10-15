import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { combineLatest, map, of, switchMap } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import {
  addDays,
  diaSemana,
  etiquetaDia,
  formatFechaLarga,
  formatHora,
  horaBogota,
  hoyBogota,
  inicioIso,
} from '../../core/dates';
import { focusFirstInvalid, parseApiError, problemMessage, requiredText } from '../../core/forms';
import { positiveInt } from '../../core/page';
import { LOADING, Remote, toRemote } from '../../core/remote';
import { Avatar } from '../../shared/ui/avatar';
import { Field } from '../../shared/ui/field';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { StateMessage } from '../../shared/ui/state-message';
import { EspecialidadesService } from '../especialidades/especialidades.service';
import { Profesional, iniciales, nombreCompleto } from '../profesionales/profesional.model';
import { ProfesionalesService } from '../profesionales/profesionales.service';
import { Cita, DURACION_CITA_MIN, Disponibilidad } from './cita.model';
import { CitasService } from './citas.service';

/** Días ofrecidos para reservar, contando hoy. */
export const DIAS_VISIBLES = 14;
const DRAFT_KEY = 'meridiana.cita-borrador';

/** Selección del flujo; vive en la URL (`?especialidad_id=&profesional_id=&fecha=&hora=`). */
interface Seleccion {
  especialidadId: number | null;
  profesionalId: number | null;
  /** YYYY-MM-DD, ya validada (entre hoy y los próximos días, sin domingos). */
  fecha: string | null;
  /** HH:mm en hora de Bogotá. */
  hora: string | null;
}

@Component({
  selector: 'app-citas',
  imports: [ReactiveFormsModule, RouterLink, Avatar, Field, Icon, PageHeader, StateMessage],
  templateUrl: './citas.html',
  styleUrl: './citas.css',
})
export class Citas {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly citas = inject(CitasService);
  private readonly especialidades = inject(EspecialidadesService);
  private readonly profesionalesService = inject(ProfesionalesService);
  protected readonly auth = inject(AuthService);

  protected readonly hoy = hoyBogota();
  protected readonly duracion = DURACION_CITA_MIN;
  protected readonly dias = Array.from({ length: DIAS_VISIBLES }, (_, i) => {
    const fecha = addDays(this.hoy, i);
    return {
      fecha,
      ...etiquetaDia(fecha),
      domingo: diaSemana(fecha) === 0,
      largo: formatFechaLarga(fecha),
    };
  });

  private readonly reloadEspecialidades = signal(0);
  private readonly reloadProfesionales = signal(0);
  private readonly reloadSlots = signal(0);
  private focusPending = false;

  protected readonly seleccion = toSignal(
    this.route.queryParamMap.pipe(
      map((p): Seleccion => {
        const fecha = p.get('fecha');
        const validaFecha =
          fecha !== null &&
          /^\d{4}-\d{2}-\d{2}$/.test(fecha) &&
          this.dias.some((d) => d.fecha === fecha && !d.domingo);
        const hora = p.get('hora');
        return {
          especialidadId: positiveInt(p.get('especialidad_id')),
          profesionalId: positiveInt(p.get('profesional_id')),
          fecha: validaFecha ? fecha : null,
          hora: validaFecha && hora !== null && /^\d{2}:\d{2}$/.test(hora) ? hora : null,
        };
      }),
    ),
    { requireSync: true },
  );

  protected readonly especialidadesState = toSignal(
    toObservable(this.reloadEspecialidades).pipe(
      switchMap(() => toRemote(this.especialidades.listar())),
    ),
    { initialValue: LOADING as Remote<{ id: number; nombre: string; descripcion: string }[]> },
  );

  /** Profesional elegido (por URL); `null` mientras no hay `profesional_id`. */
  protected readonly profesionalState = toSignal(
    toObservable(computed(() => this.seleccion().profesionalId)).pipe(
      switchMap((id) => (id === null ? of(null) : toRemote(this.profesionalesService.obtener(id)))),
    ),
    { initialValue: null as Remote<Profesional> | null },
  );

  /** El profesional de la URL existe y atiende; si no, el flujo vuelve al paso 2 con un aviso. */
  protected readonly profesional = computed(() => {
    const s = this.profesionalState();
    return s?.status === 'ready' && s.data.activo ? s.data : null;
  });
  protected readonly profesionalProblema = computed(() => {
    const s = this.profesionalState();
    if (!s || s.status === 'loading') return null;
    if (s.status === 'ready')
      return s.data.activo ? null : 'Este profesional no está atendiendo citas por el momento.';
    return s.status === 'not-found'
      ? 'No encontramos a ese profesional.'
      : 'No pudimos cargar al profesional.';
  });

  /** Especialidad vigente: la de la URL o, en un enlace directo al profesional, la suya. */
  protected readonly especialidadId = computed(
    () => this.seleccion().especialidadId ?? this.profesional()?.especialidad_id ?? null,
  );
  protected readonly especialidadNombre = computed(() => {
    const id = this.especialidadId();
    const prof = this.profesional();
    if (prof && prof.especialidad_id === id) return prof.especialidad.nombre;
    const s = this.especialidadesState();
    return s.status === 'ready' ? (s.data.find((e) => e.id === id)?.nombre ?? '') : '';
  });

  protected readonly profesionalesList = toSignal(
    combineLatest([
      toObservable(
        computed(() =>
          this.seleccion().profesionalId === null || this.profesionalProblema() !== null
            ? this.especialidadId()
            : null,
        ),
      ),
      toObservable(this.reloadProfesionales),
    ]).pipe(
      switchMap(([especialidadId]) =>
        especialidadId === null
          ? of(null)
          : toRemote(
              this.profesionalesService
                .listar({ especialidadId, limit: 100 })
                .pipe(map((page) => page.items)),
            ),
      ),
    ),
    { initialValue: null as Remote<Profesional[]> | null },
  );

  protected readonly slotsState = toSignal(
    combineLatest([
      toObservable(computed(() => (this.profesional() ? this.seleccion().profesionalId : null))),
      toObservable(computed(() => this.seleccion().fecha)),
      toObservable(this.reloadSlots),
    ]).pipe(
      switchMap(([profesionalId, fecha]) =>
        profesionalId === null || fecha === null
          ? of(null)
          : toRemote(this.citas.disponibilidad(profesionalId, fecha, DURACION_CITA_MIN)),
      ),
    ),
    { initialValue: null as Remote<Disponibilidad> | null },
  );

  /** Horarios del día separados en mañana y tarde. */
  protected readonly horarios = computed(() => {
    const s = this.slotsState();
    if (s?.status !== 'ready') return null;
    const todos = s.data.huecos.map((h) => ({
      hora: horaBogota(h.inicio),
      etiqueta: formatHora(h.inicio),
    }));
    return {
      total: todos.length,
      manana: todos.filter((h) => h.hora < '12:00'),
      tarde: todos.filter((h) => h.hora >= '12:00'),
    };
  });

  protected readonly horaElegida = computed(() => {
    const { hora } = this.seleccion();
    const s = this.slotsState();
    if (!hora || s?.status !== 'ready') return null;
    const hueco = s.data.huecos.find((h) => horaBogota(h.inicio) === hora);
    return hueco ? { hora, etiqueta: formatHora(hueco.inicio) } : null;
  });

  /** Paso vigente (1–4). Con un `profesional_id` en la URL se asume válido mientras carga. */
  protected readonly paso = computed(() => {
    const s = this.seleccion();
    if (s.especialidadId === null && s.profesionalId === null) return 1;
    if (s.profesionalId === null || this.profesionalProblema() !== null) return 2;
    return s.fecha !== null && this.horaElegida() ? 4 : 3;
  });

  /** Aviso del paso 3: horario ocupado (409) o que ya no está libre. */
  protected readonly avisoHorario = signal<string | null>(null);
  protected readonly horaPerdida = computed(() => {
    const { hora } = this.seleccion();
    return !!hora && this.slotsState()?.status === 'ready' && !this.horaElegida();
  });

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly creada = signal<Cita | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    motivo: ['', [requiredText, Validators.required, Validators.maxLength(500)]],
  });

  /** URL actual del flujo, para volver aquí tras ingresar. */
  protected readonly urlActual = computed(() => {
    const s = this.seleccion();
    return this.router.serializeUrl(
      this.router.createUrlTree(['/citas'], { queryParams: this.params(s) }),
    );
  });

  protected readonly nombre = (p: Profesional) => nombreCompleto(p);
  protected readonly iniciales = (p: Profesional) => iniciales(p);
  protected readonly fechaLarga = formatFechaLarga;
  protected readonly horaCita = formatHora;

  constructor() {
    this.restoreDraft();

    // Un enlace directo a un profesional sin especialidad (o con otra) se corrige en la URL.
    effect(() => {
      const prof = this.profesional();
      const actual = this.seleccion().especialidadId;
      if (prof && actual !== prof.especialidad_id) {
        untracked(() => this.update({ especialidadId: prof.especialidad_id }, true));
      }
    });

    // Un horario del enlace que ya no está libre se descarta con un aviso.
    effect(() => {
      if (this.horaPerdida()) {
        untracked(() => {
          this.avisoHorario.set('Ese horario ya no está disponible. Elige otro.');
          this.update({ hora: null }, true);
        });
      }
    });

    // Tras elegir (no al cargar), el foco pasa al título del nuevo paso.
    effect(() => {
      this.paso();
      untracked(() => {
        if (!this.focusPending) return;
        this.focusPending = false;
        afterNextRender(
          () =>
            this.host.nativeElement.querySelector<HTMLElement>('[data-paso-actual] h2')?.focus(),
          { injector: this.injector },
        );
      });
    });
  }

  protected elegirEspecialidad(id: number): void {
    this.avisoHorario.set(null);
    this.go({ especialidadId: id, profesionalId: null, fecha: null, hora: null });
  }

  protected elegirProfesional(p: Profesional): void {
    this.avisoHorario.set(null);
    this.go({ especialidadId: p.especialidad_id, profesionalId: p.id, fecha: null, hora: null });
  }

  protected elegirDia(fecha: string): void {
    this.avisoHorario.set(null);
    this.go({ fecha, hora: null }, false);
  }

  protected elegirHora(hora: string): void {
    this.avisoHorario.set(null);
    this.go({ hora });
  }

  /** Vuelve a un paso anterior conservando lo elegido antes de él. */
  protected irAPaso(paso: 1 | 2 | 3): void {
    this.avisoHorario.set(null);
    if (paso === 1) this.go({ especialidadId: null, profesionalId: null, fecha: null, hora: null });
    else if (paso === 2) this.go({ profesionalId: null, fecha: null, hora: null });
    else this.go({ hora: null });
  }

  protected reintentarEspecialidades(): void {
    this.reloadEspecialidades.update((n) => n + 1);
  }
  protected reintentarProfesionales(): void {
    this.reloadProfesionales.update((n) => n + 1);
  }
  protected reintentarHorarios(): void {
    this.reloadSlots.update((n) => n + 1);
  }

  protected confirmar(): void {
    const { profesionalId, fecha, hora } = this.seleccion();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    if (profesionalId === null || fecha === null || hora === null) return;

    this.formError.set(null);
    this.submitting.set(true);
    this.citas
      .crear({
        profesional_id: profesionalId,
        inicio: inicioIso(fecha, hora),
        duracion_min: DURACION_CITA_MIN,
        motivo: this.form.controls.motivo.value.trim(),
      })
      .subscribe({
        next: (cita) => {
          this.submitting.set(false);
          this.creada.set(cita);
          this.clearDraft();
          afterNextRender(
            () => this.host.nativeElement.querySelector<HTMLElement>('#cita-creada')?.focus(),
            {
              injector: this.injector,
            },
          );
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const problem = parseApiError(err);
          if (problem.status === 401) {
            this.saveDraft();
            void this.router.navigate(['/ingresar'], {
              queryParams: { returnUrl: this.urlActual(), sesion: 'expirada' },
            });
          } else if (problem.status === 409) {
            // El hueco se ocupó o choca con otra cita del paciente: se vuelve al paso 3 con huecos frescos.
            this.avisoHorario.set(
              problem.detail ?? 'Ese horario ya no está disponible. Elige otro.',
            );
            this.go({ hora: null });
            this.reloadSlots.update((n) => n + 1);
          } else {
            this.formError.set(
              problemMessage(problem, 'No pudimos confirmar la cita. Inténtalo de nuevo.'),
            );
          }
        },
      });
  }

  protected nuevaCita(): void {
    this.creada.set(null);
    this.form.reset();
    this.go({ especialidadId: null, profesionalId: null, fecha: null, hora: null });
  }

  /** Antes de salir a ingresar o registrarse se guarda el motivo escrito. */
  protected saveDraft(): void {
    const motivo = this.form.controls.motivo.value;
    try {
      if (motivo.trim()) sessionStorage.setItem(DRAFT_KEY, motivo);
    } catch {
      // Sin almacenamiento: solo se pierde el borrador del motivo.
    }
  }

  private restoreDraft(): void {
    try {
      const draft = sessionStorage.getItem(DRAFT_KEY);
      if (draft) this.form.controls.motivo.setValue(draft);
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignorado.
    }
  }

  private clearDraft(): void {
    try {
      sessionStorage.removeItem(DRAFT_KEY);
    } catch {
      // Ignorado.
    }
  }

  private params(s: Seleccion) {
    return {
      especialidad_id: s.especialidadId,
      profesional_id: s.profesionalId,
      fecha: s.fecha,
      hora: s.hora,
    };
  }

  /** Cambia la selección en la URL; `moverFoco` lleva el foco al título del nuevo paso. */
  private go(patch: Partial<Seleccion>, moverFoco = true): void {
    this.update(patch, false);
    this.focusPending = moverFoco;
  }

  private update(patch: Partial<Seleccion>, replaceUrl: boolean): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.params({ ...this.seleccion(), ...patch }),
      replaceUrl,
      scroll: 'manual',
    });
  }
}
