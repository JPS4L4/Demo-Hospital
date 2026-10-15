import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { formatear } from '../format';

export interface PuntoTendencia {
  /** Etiqueta breve para el eje ("mar 26"). */
  corta: string;
  /** Etiqueta completa para el tooltip y la tabla ("marzo de 2026"). */
  larga: string;
  /** El rango consultado no cubre el periodo entero: su valor no es comparable con los demás. */
  parcial?: boolean;
}

export interface SerieTendencia {
  nombre: string;
  valores: number[];
  tono: 'brand' | 'accent';
  /** Trazo discontinuo: la serie no depende solo del color. */
  discontinua?: boolean;
}

const MARGEN = { arriba: 12, derecha: 14, abajo: 28, izquierda: 42 };
const ANCHO_ETIQUETA = 52;

/** Límite superior "redondo" del eje y cuatro divisiones. */
export function escalaY(max: number): { tope: number; marcas: number[] } {
  if (max <= 0) return { tope: 4, marcas: [0, 1, 2, 3, 4] };
  const paso0 = max / 4;
  const potencia = 10 ** Math.floor(Math.log10(paso0));
  const paso =
    [1, 1.5, 2, 2.5, 3, 4, 5, 10].map((m) => m * potencia).find((p) => p >= paso0) ?? paso0;
  const marcas = Array.from({ length: 5 }, (_, i) => i * paso);
  return { tope: marcas[4], marcas };
}

interface PuntoTrazo {
  x: number;
  y: number;
  parcial: boolean;
}

/**
 * Path de los tramos completos (`parcial = false`) o de los que tocan un periodo incompleto
 * (`parcial = true`). Los tramos contiguos del mismo tipo forman un solo subtrazo.
 */
export function trazo(puntos: PuntoTrazo[], parcial: boolean): string {
  let d = '';
  let abierto = false;
  for (let k = 1; k < puntos.length; k++) {
    const toca = puntos[k - 1].parcial || puntos[k].parcial;
    if (toca !== parcial) {
      abierto = false;
      continue;
    }
    const a = puntos[k - 1];
    const b = puntos[k];
    if (!abierto) d += `${d ? ' ' : ''}M${a.x.toFixed(1)} ${a.y.toFixed(1)}`;
    d += ` L${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    abierto = true;
  }
  return d;
}

/**
 * Líneas sobre un eje temporal (una o dos series en la misma escala). Se dibuja en SVG con el
 * ancho real del contenedor para que el texto no se encoja en móvil. El detalle de cada periodo
 * sale al pasar el puntero o con las flechas del teclado (el gráfico recibe foco), y la tabla
 * plegable repite todos los datos.
 */
@Component({
  selector: 'app-trend-chart',
  template: `
    <ul class="legend" aria-hidden="true">
      @for (s of series(); track s.nombre) {
        <li>
          <svg width="22" height="10" viewBox="0 0 22 10">
            <line
              x1="1"
              y1="5"
              x2="21"
              y2="5"
              [class]="'line s-' + s.tono"
              [attr.stroke-dasharray]="s.discontinua ? '5 3' : null"
            />
          </svg>
          {{ s.nombre }}
        </li>
      }
      @if (hayParcial()) {
        <li>
          <svg width="22" height="10" viewBox="0 0 22 10">
            <line x1="1" y1="5" x2="11" y2="5" class="line s-parcial" stroke-dasharray="1 4" />
            <circle cx="16" cy="5" r="3" class="dot hueco f-brand" />
          </svg>
          Periodo incompleto
        </li>
      }
    </ul>

    <div #lienzo class="canvas">
      <svg
        [attr.viewBox]="'0 0 ' + ancho() + ' ' + alto()"
        [attr.width]="ancho()"
        [attr.height]="alto()"
        role="group"
        tabindex="0"
        [attr.aria-label]="
          nombre() + '. Usa las flechas izquierda y derecha para recorrer los periodos.'
        "
        (pointermove)="mover($event)"
        (pointerleave)="soltar()"
        (focus)="enfocar()"
        (blur)="activo.set(null)"
        (keydown)="teclado($event)"
      >
        @for (m of escala().marcas; track m) {
          <line
            class="grid"
            [attr.x1]="izq"
            [attr.x2]="ancho() - der"
            [attr.y1]="y(m)"
            [attr.y2]="y(m)"
          />
          <text
            class="tick"
            [attr.x]="izq - 8"
            [attr.y]="y(m)"
            text-anchor="end"
            dominant-baseline="middle"
          >
            {{ miles(m) }}
          </text>
        }
        @for (e of etiquetasEje(); track e.i) {
          <text class="tick" [attr.x]="x(e.i)" [attr.y]="alto() - 8" text-anchor="middle">
            {{ e.texto }}
          </text>
        }

        @for (b of bandas(); track b.i) {
          <rect
            class="banda"
            [attr.x]="b.x"
            [attr.y]="arriba"
            [attr.width]="b.w"
            [attr.height]="alto() - arriba - abajo"
          />
        }

        @if (activoIdx() !== null) {
          <line
            class="cross"
            [attr.x1]="x(activoIdx()!)"
            [attr.x2]="x(activoIdx()!)"
            [attr.y1]="arriba"
            [attr.y2]="alto() - abajo"
          />
        }

        @for (s of trazos(); track s.nombre) {
          <path
            [class]="'line s-' + s.tono"
            [attr.d]="s.d"
            [attr.stroke-dasharray]="s.discontinua ? '5 3' : null"
          />
          @if (s.dParcial) {
            <path
              [class]="'line s-' + s.tono + ' parcial'"
              [attr.d]="s.dParcial"
              stroke-dasharray="1 4"
            />
          }
          @for (p of s.puntos; track p.i) {
            @if (marcadores() || p.parcial || p.i === activoIdx()) {
              <circle
                [class]="'dot f-' + s.tono + (p.parcial ? ' hueco' : '')"
                [attr.cx]="p.x"
                [attr.cy]="p.y"
                [attr.r]="p.i === activoIdx() ? 5 : 3.5"
              />
            }
          }
        }
      </svg>

      @if (tooltip(); as t) {
        <div class="tip" [style.left.px]="t.izquierda" aria-hidden="true">
          <strong>{{ t.titulo }}</strong>
          @if (t.parcial) {
            <em class="aviso">Periodo incompleto</em>
          }
          @for (l of t.lineas; track l.nombre) {
            <span
              >{{ l.nombre }}: <b>{{ l.valor }}</b></span
            >
          }
        </div>
        <p class="sr-only" role="status">
          {{ t.titulo }}.
          @if (t.parcial) {
            Periodo incompleto.
          }
          @for (l of t.lineas; track l.nombre) {
            {{ l.nombre }}: {{ l.valor }}.
          }
        </p>
      }
    </div>

    <details class="data">
      <summary>Ver como tabla</summary>
      <div class="table-wrap mt-2">
        <table class="data-table">
          <caption class="sr-only">
            {{
              nombre()
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Periodo</th>
              @for (s of series(); track s.nombre) {
                <th scope="col">{{ s.nombre }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (p of puntos(); track $index; let i = $index) {
              <tr>
                <th scope="row">
                  {{ p.larga }}
                  @if (p.parcial) {
                    <span class="text-muted font-normal">(periodo incompleto)</span>
                  }
                </th>
                @for (s of series(); track s.nombre) {
                  <td>{{ miles(s.valores[i]) }}</td>
                }
              </tr>
            }
          </tbody>
        </table>
      </div>
    </details>
  `,
  styles: `
    .legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.25rem 1.25rem;
      margin: 0 0 0.5rem;
      padding: 0;
      list-style: none;
      font-size: 0.875rem;
    }
    .legend li {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
    }
    .canvas {
      position: relative;
      width: 100%;
    }
    svg {
      display: block;
      max-width: 100%;
      touch-action: pan-y;
      border-radius: 0.5rem;
    }
    .grid {
      stroke: var(--line);
      stroke-width: 1;
    }
    .tick {
      fill: var(--muted);
      font-size: 11px;
      font-variant-numeric: tabular-nums;
    }
    .cross {
      stroke: var(--muted);
      stroke-width: 1;
      stroke-dasharray: 2 3;
    }
    .line {
      fill: none;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
    .s-brand {
      stroke: var(--brand);
    }
    .s-accent {
      stroke: var(--accent);
    }
    .dot {
      stroke: var(--surface);
      stroke-width: 2;
    }
    /* Periodo incompleto: marcador hueco, tramo punteado y banda de fondo. */
    .dot.hueco {
      fill: var(--surface);
      stroke-width: 2;
    }
    .dot.hueco.f-brand {
      stroke: var(--brand);
    }
    .dot.hueco.f-accent {
      stroke: var(--accent);
    }
    .line.parcial {
      stroke-width: 2;
    }
    .s-parcial {
      stroke: var(--muted);
    }
    .banda {
      fill: var(--surface-sunken);
      fill-opacity: 0.7;
    }
    .aviso {
      color: var(--muted);
      font-style: normal;
    }
    .f-brand {
      fill: var(--brand);
    }
    .f-accent {
      fill: var(--accent);
    }
    .tip {
      position: absolute;
      top: 0;
      display: grid;
      gap: 0.125rem;
      min-width: 8rem;
      padding: 0.5rem 0.75rem;
      transform: translateX(-50%);
      border: 1px solid var(--line);
      border-radius: 0.5rem;
      background: var(--surface);
      box-shadow: 0 4px 14px rgb(0 0 0 / 0.14);
      font-size: 0.8125rem;
      line-height: 1.35;
      pointer-events: none;
      white-space: nowrap;
    }
    .data {
      margin-top: 0.75rem;
    }
    .data summary {
      display: inline-block;
      min-height: 2.75rem;
      padding-block: 0.625rem;
      font-size: 0.9375rem;
      font-weight: 600;
      color: var(--brand);
      cursor: pointer;
    }
    .data .data-table {
      min-width: 0;
    }
  `,
  host: { class: 'block min-w-0' },
})
export class TrendChart {
  protected readonly izq = MARGEN.izquierda;
  protected readonly der = MARGEN.derecha;
  protected readonly arriba = MARGEN.arriba;
  protected readonly abajo = MARGEN.abajo;

  readonly nombre = input.required<string>();
  readonly puntos = input.required<PuntoTendencia[]>();
  readonly series = input.required<SerieTendencia[]>();

  private readonly lienzo = viewChild.required<ElementRef<HTMLElement>>('lienzo');
  protected readonly ancho = signal(640);
  protected readonly alto = computed(() => (this.ancho() < 480 ? 220 : 270));
  protected readonly activo = signal<number | null>(null);

  protected readonly activoIdx = computed(() => {
    const i = this.activo();
    return i !== null && i < this.puntos().length ? i : null;
  });

  protected readonly escala = computed(() =>
    escalaY(Math.max(0, ...this.series().flatMap((s) => s.valores))),
  );

  private readonly anchoUtil = computed(() => this.ancho() - MARGEN.izquierda - MARGEN.derecha);
  protected readonly marcadores = computed(() => this.puntos().length <= 24);

  protected readonly etiquetasEje = computed(() => {
    const n = this.puntos().length;
    const paso = Math.max(1, Math.ceil(ANCHO_ETIQUETA / (this.anchoUtil() / Math.max(n, 1))));
    return this.puntos()
      .map((p, i) => ({ i, texto: p.corta }))
      .filter((e) => e.i % paso === 0);
  });

  protected readonly trazos = computed(() =>
    this.series().map((s) => {
      const puntos = s.valores.map((v, i) => ({
        i,
        x: this.x(i),
        y: this.y(v),
        parcial: !!this.puntos()[i]?.parcial,
      }));
      return {
        ...s,
        puntos,
        d: trazo(puntos, false),
        dParcial: trazo(puntos, true),
      };
    }),
  );

  protected readonly hayParcial = computed(() => this.puntos().some((p) => p.parcial));

  protected readonly bandas = computed(() => {
    const n = Math.max(this.puntos().length, 1);
    const w = this.anchoUtil() / n;
    return this.puntos()
      .map((p, i) => ({ i, parcial: !!p.parcial, x: this.x(i) - w / 2, w }))
      .filter((b) => b.parcial);
  });

  protected readonly tooltip = computed(() => {
    const i = this.activoIdx();
    if (i === null) return null;
    const medio = 80;
    return {
      titulo: this.puntos()[i].larga,
      parcial: !!this.puntos()[i].parcial,
      izquierda: Math.min(Math.max(this.x(i), medio), this.ancho() - medio),
      lineas: this.series().map((s) => ({
        nombre: s.nombre,
        valor: formatear(s.valores[i], 'entero'),
      })),
    };
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const el = this.lienzo().nativeElement;
      const medir = () => {
        const w = Math.floor(el.getBoundingClientRect().width);
        if (w > 0) this.ancho.set(w);
      };
      medir();
      if (typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(medir);
      observer.observe(el);
      destroyRef.onDestroy(() => observer.disconnect());
    });
  }

  protected x(i: number): number {
    const n = Math.max(this.puntos().length, 1);
    return MARGEN.izquierda + ((i + 0.5) * this.anchoUtil()) / n;
  }

  protected y(valor: number): number {
    const util = this.alto() - MARGEN.arriba - MARGEN.abajo;
    return MARGEN.arriba + util - (valor / this.escala().tope) * util;
  }

  protected miles(valor: number): string {
    return formatear(valor, 'entero');
  }

  protected mover(event: PointerEvent): void {
    const n = this.puntos().length;
    if (n === 0) return;
    const rect = (event.currentTarget as SVGElement).getBoundingClientRect();
    const rel = (event.clientX - rect.left - MARGEN.izquierda) / (this.anchoUtil() / n);
    this.activo.set(Math.min(n - 1, Math.max(0, Math.floor(rel))));
  }

  protected soltar(): void {
    if (this.lienzo().nativeElement.contains(document.activeElement)) return;
    this.activo.set(null);
  }

  protected enfocar(): void {
    if (this.activo() === null) this.activo.set(this.puntos().length - 1);
  }

  protected teclado(event: KeyboardEvent): void {
    const n = this.puntos().length;
    const actual = this.activoIdx() ?? n - 1;
    const destino =
      event.key === 'ArrowLeft'
        ? actual - 1
        : event.key === 'ArrowRight'
          ? actual + 1
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? n - 1
              : null;
    if (destino === null) return;
    event.preventDefault();
    this.activo.set(Math.min(n - 1, Math.max(0, destino)));
  }
}
