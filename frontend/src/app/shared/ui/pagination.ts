import { Component, computed, input, output } from '@angular/core';
import { Icon } from './icon';

/** Paginación Anterior/Siguiente con el rango visible ("1–9 de 12"). Se oculta si todo cabe en una página. */
@Component({
  selector: 'app-pagination',
  imports: [Icon],
  template: `
    @if (total() > limit()) {
      <nav aria-label="Paginación" class="flex flex-wrap items-center justify-between gap-4 border-t border-line pt-6">
        <p class="text-muted" aria-live="polite">
          <span class="font-semibold text-ink">{{ from() }}–{{ to() }}</span> de {{ total() }}
        </p>
        <div class="flex gap-3">
          <button type="button" class="btn btn-secondary page-btn" [disabled]="offset() <= 0" (click)="go(offset() - limit())">
            <app-icon name="arrow-left" [size]="18" />
            Anterior
          </button>
          <button type="button" class="btn btn-secondary page-btn" [disabled]="to() >= total()" (click)="go(offset() + limit())">
            Siguiente
            <app-icon name="arrow-right" [size]="18" />
          </button>
        </div>
      </nav>
    }
  `,
  styles: `
    .page-btn:disabled {
      opacity: 0.45;
      cursor: not-allowed;
      pointer-events: none;
    }
  `,
  host: { class: 'block' },
})
export class Pagination {
  readonly total = input.required<number>();
  readonly limit = input.required<number>();
  readonly offset = input.required<number>();
  readonly offsetChange = output<number>();

  protected readonly from = computed(() => Math.min(this.offset() + 1, this.total()));
  protected readonly to = computed(() => Math.min(this.offset() + this.limit(), this.total()));

  protected go(offset: number): void {
    this.offsetChange.emit(Math.max(0, offset));
  }
}
