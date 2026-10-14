import { Component, input } from '@angular/core';

/** Marcadores de posición mientras llega un listado. */
@Component({
  selector: 'app-skeleton-cards',
  template: `
    <div role="status" aria-live="polite" class="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <span class="sr-only">{{ label() }}</span>
      @for (n of items(); track n) {
        <div class="card flex flex-col gap-3 p-6" aria-hidden="true">
          <div class="skeleton h-3 w-24"></div>
          <div class="skeleton h-6 w-11/12"></div>
          <div class="skeleton h-6 w-3/5"></div>
          <div class="skeleton mt-2 h-3 w-full"></div>
          <div class="skeleton h-3 w-4/5"></div>
        </div>
      }
    </div>
  `,
  host: { class: 'block' },
})
export class SkeletonCards {
  readonly count = input(3);
  readonly label = input('Cargando…');

  protected items() {
    return Array.from({ length: this.count() }, (_, i) => i);
  }
}
