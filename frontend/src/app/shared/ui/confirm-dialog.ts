import { Component, ElementRef, effect, input, output, viewChild } from '@angular/core';
import { Icon } from './icon';

/**
 * Confirmación modal sobre `<dialog>` nativo: atrapa el foco, cierra con Esc y devuelve el foco al
 * elemento que la abrió. El padre controla `open`; `confirmed` y `cancelled` indican la decisión.
 */
@Component({
  selector: 'app-confirm-dialog',
  imports: [Icon],
  template: `
    <!-- Clic en el fondo es solo un atajo de ratón; con teclado se cierra con Esc (cancel nativo). -->
    <!-- eslint-disable-next-line @angular-eslint/template/click-events-have-key-events, @angular-eslint/template/interactive-supports-focus -->
    <dialog
      #dialog
      class="confirm"
      [attr.aria-labelledby]="'confirm-title'"
      [attr.aria-describedby]="'confirm-body'"
      (cancel)="onNativeCancel($event)"
      (click)="onBackdrop($event)"
    >
      <div class="confirm-body">
        <span
          class="icon-tile"
          [style.background]="danger() ? 'var(--danger-soft)' : null"
          [style.color]="danger() ? 'var(--danger)' : null"
        >
          <app-icon [name]="danger() ? 'alert' : 'info'" [size]="22" />
        </span>
        <h2 id="confirm-title" class="mt-4 text-xl">{{ title() }}</h2>
        <div id="confirm-body" class="mt-2 text-muted">
          <p>{{ message() }}</p>
          <ng-content />
        </div>
        @if (error()) {
          <p class="mt-4 flex items-start gap-2 text-sm font-semibold text-danger" role="alert">
            <app-icon name="alert" [size]="18" class="mt-0.5" />
            {{ error() }}
          </p>
        }
        <div class="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            class="btn btn-secondary"
            [disabled]="busy()"
            (click)="cancelled.emit()"
          >
            {{ cancelLabel() }}
          </button>
          <button
            type="button"
            class="btn"
            [class.btn-primary]="!danger()"
            [class.btn-danger]="danger()"
            [disabled]="busy()"
            [attr.aria-busy]="busy()"
            (click)="confirmed.emit()"
          >
            {{ busy() ? busyLabel() : confirmLabel() }}
          </button>
        </div>
      </div>
    </dialog>
  `,
  styles: `
    .confirm {
      width: min(28rem, calc(100vw - 2.5rem));
      margin: auto;
      padding: 0;
      border: 1px solid var(--line);
      border-radius: 0.75rem;
      background: var(--surface);
      color: var(--ink);
    }
    .confirm[open] {
      animation: confirm-in 200ms var(--ease-out-soft);
    }
    .confirm::backdrop {
      background: rgb(8 20 17 / 0.55);
    }
    .confirm-body {
      padding: 1.5rem;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-danger {
      background: var(--danger);
      color: var(--surface);
    }
    @media (hover: hover) {
      .btn-danger:not(:disabled):hover {
        filter: brightness(0.9);
      }
    }
    @keyframes confirm-in {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.98);
      }
    }
  `,
  host: { class: 'contents' },
})
export class ConfirmDialog {
  readonly open = input(false);
  readonly title = input.required<string>();
  readonly message = input.required<string>();
  readonly confirmLabel = input('Confirmar');
  readonly cancelLabel = input('Volver');
  readonly busyLabel = input('Procesando…');
  readonly danger = input(false);
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly confirmed = output<void>();
  readonly cancelled = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    effect(() => {
      const el = this.dialog().nativeElement;
      if (this.open()) {
        if (!el.open) {
          // jsdom no implementa showModal; en navegadores reales siempre existe.
          if (typeof el.showModal === 'function') el.showModal();
          else el.setAttribute('open', '');
        }
      } else if (el.open) {
        if (typeof el.close === 'function') el.close();
        else el.removeAttribute('open');
      }
    });
  }

  /** Esc: el padre decide (no se cierra mientras hay una petición en curso). */
  protected onNativeCancel(event: Event): void {
    event.preventDefault();
    if (!this.busy()) this.cancelled.emit();
  }

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement && !this.busy()) this.cancelled.emit();
  }
}
