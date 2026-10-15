import { Component, input, output } from '@angular/core';
import { Icon } from '../../../../shared/ui/icon';

/**
 * Tarjeta de un gráfico: título, descripción y estados de carga, error y vacío.
 * El contenido proyectado solo se muestra cuando hay datos.
 */
@Component({
  selector: 'app-widget',
  imports: [Icon],
  template: `
    <section
      class="card widget"
      [attr.aria-labelledby]="id"
      [attr.aria-busy]="estado() === 'loading' || stale()"
    >
      <header class="widget-head">
        <div class="min-w-0">
          <h3 class="widget-title" [id]="id">{{ titulo() }}</h3>
          @if (descripcion()) {
            <p class="widget-desc">{{ descripcion() }}</p>
          }
        </div>
        <ng-content select="[widget-actions]" />
      </header>

      @switch (estado()) {
        @case ('loading') {
          <div role="status" class="grid gap-2">
            <span class="sr-only">Cargando {{ titulo().toLowerCase() }}…</span>
            @for (n of [1, 2, 3, 4]; track n) {
              <div class="skeleton h-8" aria-hidden="true"></div>
            }
          </div>
        }
        @case ('error') {
          <div class="notice notice-error" role="alert">
            <app-icon name="alert" [size]="18" class="mt-0.5" />
            <span class="min-w-0 flex-1">No pudimos cargar este gráfico.</span>
            <button type="button" class="btn btn-quiet btn-sm" (click)="retry.emit()">
              Reintentar
            </button>
          </div>
        }
        @default {
          @if (vacio()) {
            <p class="notice" role="status">
              <app-icon name="inbox" [size]="18" class="mt-0.5" />
              Sin citas para estos filtros. Amplía el periodo o quita la sede o la especialidad.
            </p>
          } @else {
            <div [class.widget-stale]="stale()"><ng-content /></div>
          }
        }
      }
    </section>
  `,
  styles: `
    .widget {
      padding: 1.25rem;
      min-width: 0;
    }
    .widget-head {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-start;
      justify-content: space-between;
      gap: 0.75rem 1rem;
      margin-bottom: 1rem;
    }
    .widget-title {
      font-size: 1.25rem;
    }
    .widget-desc {
      margin-top: 0.125rem;
      font-size: 0.9375rem;
      color: var(--muted);
    }
    .widget-stale {
      opacity: 0.55;
      transition: opacity 160ms var(--ease-out-soft) 150ms;
    }
  `,
  host: { class: 'block min-w-0' },
})
export class Widget {
  private static next = 0;
  protected readonly id = `widget-${Widget.next++}`;

  readonly titulo = input.required<string>();
  readonly descripcion = input<string>();
  readonly estado = input.required<'loading' | 'error' | 'ready'>();
  readonly vacio = input(false);
  readonly stale = input(false);
  readonly retry = output<void>();
}
