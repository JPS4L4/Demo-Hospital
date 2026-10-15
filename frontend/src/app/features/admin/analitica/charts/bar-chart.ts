import { Component, computed, input } from '@angular/core';
import { FormatoValor, formatear } from '../format';

export interface Barra {
  etiqueta: string;
  valor: number;
}

/**
 * Barras horizontales de una sola serie, ordenadas por quien las llama. El valor va escrito en
 * cada barra (sin tooltips ni ejes) y la lista es el equivalente accesible: un lector de pantalla
 * lee "Cardiología, 412". Base en cero, esquina redondeada solo en el extremo del dato.
 */
@Component({
  selector: 'app-bar-chart',
  template: `
    <ul class="bars" [attr.aria-label]="nombre()">
      @for (b of filas(); track b.etiqueta) {
        <li class="bar-row">
          <span class="bar-label">{{ b.etiqueta }}</span>
          <span class="bar-track" aria-hidden="true">
            <span
              class="bar-fill"
              [class.bar-accent]="tono() === 'accent'"
              [style.width.%]="b.ancho"
            ></span>
          </span>
          <span class="bar-value">{{ b.texto }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    .bars {
      display: grid;
      gap: 0.625rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .bar-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      grid-template-areas: 'label value' 'track track';
      align-items: baseline;
      gap: 0.125rem 0.75rem;
    }
    .bar-label {
      grid-area: label;
      font-size: 0.9375rem;
      overflow-wrap: anywhere;
    }
    .bar-value {
      grid-area: value;
      font-size: 0.9375rem;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }
    .bar-track {
      grid-area: track;
      display: block;
      height: 0.75rem;
    }
    .bar-fill {
      display: block;
      height: 100%;
      min-width: 2px;
      border-radius: 0 4px 4px 0;
      background: var(--brand);
    }
    .bar-accent {
      background: var(--accent);
    }
    @media (min-width: 40rem) {
      .bar-row {
        grid-template-columns: minmax(7rem, 11rem) minmax(0, 1fr) 4.5rem;
        grid-template-areas: 'label track value';
        align-items: center;
        gap: 0.75rem;
      }
      .bar-value {
        text-align: right;
      }
    }
  `,
})
export class BarChart {
  /** Qué mide (para el nombre accesible de la lista). */
  readonly nombre = input.required<string>();
  readonly datos = input.required<Barra[]>();
  readonly formato = input<FormatoValor>('entero');
  readonly tono = input<'brand' | 'accent'>('brand');

  protected readonly filas = computed(() => {
    const datos = this.datos();
    const max = Math.max(...datos.map((d) => d.valor), 0);
    return datos.map((d) => ({
      etiqueta: d.etiqueta,
      texto: formatear(d.valor, this.formato()),
      ancho: max > 0 ? (d.valor / max) * 100 : 0,
    }));
  });
}
