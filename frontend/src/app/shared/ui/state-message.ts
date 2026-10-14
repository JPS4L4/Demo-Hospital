import { Component, input, output } from '@angular/core';
import { Icon, IconName } from './icon';

/** Mensaje de estado para listados: vacío o error (con reintento opcional). */
@Component({
  selector: 'app-state-message',
  imports: [Icon],
  template: `
    <div
      class="card mx-auto flex max-w-xl flex-col items-center gap-3 px-6 py-10 text-center"
      [attr.role]="kind() === 'error' ? 'alert' : 'status'"
    >
      <span
        class="icon-tile"
        [style.background]="kind() === 'error' ? 'var(--danger-soft)' : null"
        [style.color]="kind() === 'error' ? 'var(--danger)' : null"
      >
        <app-icon [name]="icon()" [size]="22" />
      </span>
      <h2 class="text-xl">{{ title() }}</h2>
      <p class="text-muted">{{ message() }}</p>
      @if (retryLabel()) {
        <button type="button" class="btn btn-secondary mt-2" (click)="retry.emit()">
          <app-icon name="refresh" [size]="18" />
          {{ retryLabel() }}
        </button>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class StateMessage {
  readonly kind = input<'empty' | 'error'>('empty');
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly icon = input<IconName>('inbox');
  readonly retryLabel = input<string>();
  readonly retry = output<void>();
}
