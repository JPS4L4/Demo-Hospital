import { Component, Signal, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Observable, catchError, filter, forkJoin, map, of, switchMap, tap } from 'rxjs';
import { addMonths, formatFechaCorta, formatHora, hoyBogota } from '../../../core/dates';
import { parseApiError, problemMessage } from '../../../core/forms';
import { positiveInt } from '../../../core/page';
import { LOADING, Remote, WithStale, keepPrevious, toRemote } from '../../../core/remote';
import { Icon } from '../../../shared/ui/icon';
import { StateMessage } from '../../../shared/ui/state-message';
import { EspecialidadesService } from '../../especialidades/especialidades.service';
import { SedesService } from '../../sedes/sedes.service';
import { ConsultaAnalitica, FiltrosAnalitica, NivelFecha, Resumen } from './analitica.model';
import { AnaliticaService } from './analitica.service';
import { Barra, BarChart } from './charts/bar-chart';
import { Celda, Heatmap } from './charts/heatmap';
import { PuntoTendencia, SerieTendencia, TrendChart } from './charts/trend-chart';
import { Widget } from './charts/widget';
import { formatear, periodoCorto, periodoLargo } from './format';

type Preset = '3' | '6' | '12' | 'custom';

interface Tendencia {
  puntos: PuntoTendencia[];
  series: SerieTendencia[];
}

/** Filtros más un contador: subirlo repite todas las consultas (reintentar, tras refrescar). */
interface Consulta {
  f: FiltrosAnalitica;
  n: number;
}

@Component({
  selector: 'app-admin-analitica',
  imports: [Icon, StateMessage, Widget, BarChart, TrendChart, Heatmap],
  templateUrl: './analitica.html',
  styleUrl: './analitica.css',
})
export class AdminAnalitica {
  private readonly api = inject(AnaliticaService);

  protected readonly hoy = hoyBogota();
  protected readonly presets: { value: Preset; label: string }[] = [
    { value: '3', label: '3 meses' },
    { value: '6', label: '6 meses' },
    { value: '12', label: '12 meses' },
    { value: 'custom', label: 'Otro' },
  ];
  protected readonly niveles: { value: NivelFecha; label: string }[] = [
    { value: 'anio', label: 'Año' },
    { value: 'trimestre', label: 'Trimestre' },
    { value: 'mes', label: 'Mes' },
    { value: 'semana', label: 'Semana' },
  ];

  // Estado de los filtros (signals; el resto del panel tampoco los guarda en la URL).
  protected readonly preset = signal<Preset>('12');
  protected readonly desdeCustom = signal(addMonths(this.hoy, -3));
  protected readonly hastaCustom = signal(this.hoy);
  protected readonly sedeId = signal<number | null>(null);
  protected readonly especialidadId = signal<number | null>(null);
  protected readonly nivel = signal<NivelFecha>('mes');
  private readonly reload = signal(0);

  protected readonly sedes = toSignal(
    inject(SedesService)
      .listar()
      .pipe(catchError(() => of([]))),
    {
      initialValue: [],
    },
  );
  protected readonly especialidades = toSignal(
    inject(EspecialidadesService)
      .listar()
      .pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  /** Periodo en uso; `null` si el rango personalizado no es válido. */
  protected readonly rango = computed(() => {
    const p = this.preset();
    if (p === 'custom') {
      const desde = this.desdeCustom();
      const hasta = this.hastaCustom();
      return desde && hasta && desde <= hasta ? { desde, hasta } : null;
    }
    return { desde: addMonths(this.hoy, -Number(p)), hasta: this.hoy };
  });

  private readonly consulta = computed<Consulta | null>(() => {
    const rango = this.rango();
    if (!rango) return null;
    return {
      f: {
        ...rango,
        sedeId: this.sedeId(),
        especialidadId: this.especialidadId(),
      },
      n: this.reload(),
    };
  });

  /** Mensaje cuando la API responde 503 (falta el schema `analitica`). */
  protected readonly noDisponible = signal<string | null>(null);

  protected readonly resumen = this.widget(this.consulta, (c) => this.api.resumen(c.f));

  protected readonly tendencia = this.widget(
    computed(() => {
      const c = this.consulta();
      return c && { ...c, nivel: this.nivel() };
    }),
    (c): Observable<Tendencia> => {
      const dim = `fecha.${c.nivel}`;
      return forkJoin({
        total: this.api.citas([dim], 'total', c.f),
        canceladas: this.api.citas([dim], 'canceladas', c.f),
      }).pipe(
        map(({ total, canceladas }) => {
          const claves = total.filas.map((fila) => String(fila.dimensiones[dim]));
          const canc = new Map(
            canceladas.filas.map((fila) => [String(fila.dimensiones[dim]), fila.valor ?? 0]),
          );
          return {
            puntos: claves.map((k) => ({
              corta: periodoCorto(c.nivel, k),
              larga: periodoLargo(c.nivel, k),
            })),
            series: [
              {
                nombre: 'Citas',
                valores: total.filas.map((fila) => fila.valor ?? 0),
                tono: 'brand' as const,
              },
              {
                nombre: 'Canceladas',
                valores: claves.map((k) => canc.get(k) ?? 0),
                tono: 'accent' as const,
                discontinua: true,
              },
            ],
          };
        }),
      );
    },
  );

  protected readonly porEspecialidad = this.widget(this.consulta, (c) =>
    this.api.citas(['especialidad'], 'total', c.f).pipe(map((r) => barras(r, 'especialidad'))),
  );

  protected readonly porSede = this.widget(this.consulta, (c) =>
    this.api.citas(['sede'], 'total', c.f).pipe(map((r) => barras(r, 'sede'))),
  );

  protected readonly cancelacion = this.widget(this.consulta, (c) =>
    this.api
      .citas(['especialidad'], 'tasa_cancelacion', c.f)
      .pipe(map((r) => barras(r, 'especialidad'))),
  );

  protected readonly horas = this.widget(this.consulta, (c) =>
    this.api.citas(['fecha.dia_semana', 'hora'], 'total', c.f).pipe(
      map((r): Celda[] =>
        r.filas.map((fila) => ({
          dia: String(fila.dimensiones['fecha.dia_semana']).toLowerCase(),
          hora: Number(fila.dimensiones['hora']),
          valor: fila.valor ?? 0,
        })),
      ),
    ),
  );

  /** Frescura de los datos: solo depende de los reintentos, no de los filtros. */
  protected readonly estado = this.widget(
    computed(() => this.reload()),
    () => this.api.estado(),
  );

  protected readonly kpis = computed(() => {
    const r = this.resumen();
    if (r.status !== 'ready') return null;
    const d: Resumen = r.data;
    return [
      { label: 'Citas', valor: formatear(d.total, 'entero'), hint: 'En el periodo' },
      { label: 'Atendidas', valor: formatear(d.atendidas, 'entero'), hint: 'Citas realizadas' },
      {
        label: 'Cancelación',
        valor: d.tasa_cancelacion === null ? '—' : formatear(d.tasa_cancelacion, 'porcentaje'),
        hint: `${formatear(d.canceladas, 'entero')} canceladas`,
      },
      {
        label: 'Duración media',
        valor: d.duracion_media_min === null ? '—' : formatear(d.duracion_media_min, 'minutos'),
        hint: 'Sin contar canceladas',
      },
      {
        label: 'Pacientes',
        valor: formatear(d.pacientes_distintos, 'entero'),
        hint: 'Distintos en el periodo',
      },
    ];
  });

  protected readonly refrescando = signal(false);
  protected readonly feedback = signal<{ ok: boolean; texto: string } | null>(null);

  protected readonly fechaCorta = formatFechaCorta;
  protected readonly hora = formatHora;

  protected estadoDe(v: Remote<unknown>): 'loading' | 'error' | 'ready' {
    return v.status === 'ready' ? 'ready' : v.status === 'loading' ? 'loading' : 'error';
  }

  protected vacio<T extends { length: number }>(v: WithStale<T>): boolean {
    return v.status === 'ready' && v.data.length === 0;
  }

  protected onPreset(value: Preset): void {
    this.preset.set(value);
  }

  protected onFecha(event: Event, campo: 'desde' | 'hasta'): void {
    const value = (event.target as HTMLInputElement).value;
    if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    (campo === 'desde' ? this.desdeCustom : this.hastaCustom).set(value);
  }

  protected onSede(event: Event): void {
    this.sedeId.set(positiveInt((event.target as HTMLSelectElement).value));
  }

  protected onEspecialidad(event: Event): void {
    this.especialidadId.set(positiveInt((event.target as HTMLSelectElement).value));
  }

  protected retry(): void {
    this.noDisponible.set(null);
    this.reload.update((n) => n + 1);
  }

  protected refrescar(): void {
    if (this.refrescando()) return;
    this.refrescando.set(true);
    this.feedback.set(null);
    this.api.refrescar().subscribe({
      next: () => {
        this.refrescando.set(false);
        this.feedback.set({ ok: true, texto: 'Datos refrescados. Los gráficos ya están al día.' });
        this.retry();
      },
      error: (err: unknown) => {
        this.refrescando.set(false);
        this.registrarError(err);
        this.feedback.set({
          ok: false,
          texto: problemMessage(
            parseApiError(err),
            'No pudimos refrescar los datos. Inténtalo de nuevo.',
          ),
        });
      },
    });
  }

  private registrarError(err: unknown): void {
    const problema = parseApiError(err);
    if (problema.status === 503) {
      this.noDisponible.set(
        problema.detail ?? 'El modelo analítico no está disponible en este entorno.',
      );
    }
  }

  /** Una consulta por widget: se repite al cambiar su fuente y conserva el resultado previo mientras recarga. */
  private widget<K, T>(
    source: Signal<K | null>,
    fetch: (key: K) => Observable<T>,
  ): Signal<WithStale<T>> {
    const result = toSignal(
      toObservable(source).pipe(
        filter((key): key is K => key !== null),
        switchMap((key) =>
          toRemote(fetch(key).pipe(tap({ error: (err: unknown) => this.registrarError(err) }))),
        ),
      ),
      { initialValue: LOADING as Remote<T> },
    );
    return keepPrevious(result);
  }
}

function barras(r: ConsultaAnalitica, dimension: string): Barra[] {
  return r.filas
    .filter((fila) => fila.valor !== null)
    .map((fila) => ({ etiqueta: String(fila.dimensiones[dimension]), valor: fila.valor ?? 0 }))
    .sort((a, b) => b.valor - a.valor);
}
