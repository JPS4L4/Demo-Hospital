import { Component, computed, input } from '@angular/core';
import { Icon, IconName } from './icon';

export type EstadoCita = 'programada' | 'atendida' | 'cancelada';

const VIEW: Record<EstadoCita, { label: string; icon: IconName; style: string }> = {
  programada: { label: 'Programada', icon: 'clock', style: 'background: var(--brand-soft); color: var(--brand)' },
  atendida: { label: 'Atendida', icon: 'check', style: 'background: var(--surface-sunken); color: var(--muted)' },
  cancelada: { label: 'Cancelada', icon: 'ban', style: 'background: var(--danger-soft); color: var(--danger)' },
};

/** Estado de una cita: texto + icono + color, para no depender solo del color. */
@Component({
  selector: 'app-estado-badge',
  imports: [Icon],
  template: `
    <span class="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-semibold" [style]="view().style">
      <app-icon [name]="view().icon" [size]="14" />
      {{ view().label }}
    </span>
  `,
})
export class EstadoBadge {
  readonly estado = input.required<EstadoCita>();
  protected readonly view = computed(() => VIEW[this.estado()]);
}
