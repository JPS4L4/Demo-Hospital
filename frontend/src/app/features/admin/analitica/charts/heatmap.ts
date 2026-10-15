import { Component, computed, input } from '@angular/core';
import { DIAS_SEMANA, formatear } from '../format';

export interface Celda {
  dia: string;
  hora: number;
  valor: number;
}

/**
 * Mapa de calor día de la semana × hora. Es una tabla HTML real: cada celda lleva su valor
 * escrito, así que el color es un refuerzo y no la única vía; el contraste del texto cambia
 * con la intensidad. Una sola rampa (la del color de marca, de claro a intenso).
 */
@Component({
  selector: 'app-heatmap',
  template: `
    <div class="wrap">
      <table class="heat">
        <caption class="sr-only">
          {{
            nombre()
          }}. Filas: día de la semana. Columnas: hora de inicio.
        </caption>
        <thead>
          <tr>
            <td></td>
            @for (h of horas(); track h) {
              <th scope="col">{{ h }}</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (f of filas(); track f.dia) {
            <tr>
              <th scope="row">
                <span aria-hidden="true">{{ f.dia.slice(0, 3) }}</span>
                <span class="sr-only">{{ f.dia }}</span>
              </th>
              @for (c of f.celdas; track c.hora) {
                <td
                  [class.l-hi]="c.intensidad >= 0.8"
                  [class.d-hi]="c.intensidad >= 0.5"
                  [style.background]="c.fondo"
                  [attr.title]="f.dia + ', ' + c.hora + ' h: ' + c.texto"
                >
                  {{ c.texto }}
                </td>
              }
            </tr>
          }
        </tbody>
      </table>
    </div>
    <p class="axis">Hora de inicio (formato 24 h). Más intenso, más citas.</p>
  `,
  styles: `
    .wrap {
      position: relative;
      overflow-x: auto;
    }
    .heat {
      width: 100%;
      min-width: 26rem;
      border-collapse: separate;
      border-spacing: 2px;
      table-layout: fixed;
      font-variant-numeric: tabular-nums;
    }
    .heat th {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--muted);
    }
    .heat tbody th {
      width: 2.5rem;
      padding-right: 0.25rem;
      text-align: right;
      text-transform: capitalize;
    }
    .heat td {
      height: 2rem;
      padding: 0;
      border-radius: 4px;
      text-align: center;
      font-size: 0.6875rem;
      color: var(--ink);
      box-shadow: inset 0 0 0 1px var(--line);
    }
    .heat thead td {
      width: 2.5rem;
      box-shadow: none;
    }
    .axis {
      margin-top: 0.5rem;
      font-size: 0.8125rem;
      color: var(--muted);
    }
    :root:not([data-theme='dark']) .l-hi {
      color: var(--on-brand);
    }
    :root[data-theme='dark'] .d-hi {
      color: var(--on-brand);
    }
    @media (min-width: 48rem) {
      .heat td {
        height: 2.25rem;
        font-size: 0.8125rem;
      }
    }
  `,
  host: { class: 'block min-w-0' },
})
export class Heatmap {
  readonly nombre = input.required<string>();
  readonly celdas = input.required<Celda[]>();

  private readonly rango = computed(() => {
    const horas = this.celdas().map((c) => c.hora);
    return horas.length ? { min: Math.min(...horas), max: Math.max(...horas) } : null;
  });

  protected readonly horas = computed(() => {
    const r = this.rango();
    return r ? Array.from({ length: r.max - r.min + 1 }, (_, i) => r.min + i) : [];
  });

  protected readonly filas = computed(() => {
    const celdas = this.celdas();
    const max = Math.max(0, ...celdas.map((c) => c.valor));
    const valores = new Map(celdas.map((c) => [`${c.dia}|${c.hora}`, c.valor]));
    // Orden de lunes a domingo; un día desconocido de la API se añade al final.
    const extra = [...new Set(celdas.map((c) => c.dia))].filter((d) => !DIAS_SEMANA.includes(d));
    return [...DIAS_SEMANA, ...extra].map((dia) => ({
      dia,
      celdas: this.horas().map((hora) => {
        const valor = valores.get(`${dia}|${hora}`) ?? 0;
        const intensidad = max > 0 ? valor / max : 0;
        return {
          hora,
          intensidad,
          texto: formatear(valor, 'entero'),
          fondo: `color-mix(in srgb, var(--brand) ${Math.round(intensidad * 100)}%, var(--surface))`,
        };
      }),
    }));
  });
}
