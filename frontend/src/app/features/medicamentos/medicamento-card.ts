import { CurrencyPipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { Medicamento, disponibilidad } from './medicamento.model';

const ETIQUETAS = {
  disponible: 'Disponible',
  pocas: 'Pocas unidades',
  agotado: 'Agotado',
} as const;

@Component({
  selector: 'app-medicamento-card',
  imports: [CurrencyPipe, Icon],
  template: `
    <article class="card flex h-full flex-col gap-4 p-6">
      <div class="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        @if (medicamento().requiere_formula) {
          <p class="badge badge-formula">
            <app-icon name="file-text" [size]="16" />
            Requiere fórmula médica
          </p>
        } @else {
          <p class="badge badge-libre">Venta libre</p>
        }
        <p class="status" [attr.data-estado]="estado()">
          <span class="dot" aria-hidden="true"></span>
          {{ etiqueta() }}
        </p>
      </div>

      <div>
        <h3 class="text-xl">{{ medicamento().nombre }}</h3>
        <p class="mt-1 text-muted">{{ medicamento().principio_activo }}</p>
      </div>

      <dl class="grid grid-cols-2 gap-x-4 gap-y-1 text-[0.9375rem]">
        <dt class="text-muted">Concentración</dt>
        <dd class="font-semibold">{{ medicamento().concentracion }}</dd>
        <dt class="text-muted">Presentación</dt>
        <dd class="font-semibold">{{ medicamento().presentacion }}</dd>
      </dl>

      <p class="mt-auto border-t border-line pt-4 font-display text-2xl font-semibold">
        {{ medicamento().precio | currency: 'COP' : 'symbol-narrow' : '1.0-0' }}
      </p>
    </article>
  `,
  styles: `
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.375rem;
      padding: 0.25rem 0.625rem;
      border-radius: 9999px;
      font-size: 0.8125rem;
      font-weight: 600;
      line-height: 1.3;
    }
    .badge-formula {
      background: var(--accent-soft);
      color: var(--accent);
    }
    .badge-libre {
      background: var(--surface-sunken);
      color: var(--muted);
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
    }
    .dot {
      width: 0.5rem;
      height: 0.5rem;
      border-radius: 9999px;
      background: currentColor;
    }
    .status[data-estado='disponible'] {
      color: var(--brand);
    }
    .status[data-estado='pocas'] {
      color: var(--accent);
    }
    .status[data-estado='agotado'] {
      color: var(--danger);
    }
  `,
  host: { class: 'block' },
})
export class MedicamentoCard {
  readonly medicamento = input.required<Medicamento>();

  protected readonly estado = computed(() => disponibilidad(this.medicamento().stock));
  protected readonly etiqueta = computed(() => ETIQUETAS[this.estado()]);
}
