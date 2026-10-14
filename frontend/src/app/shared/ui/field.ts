import { AfterContentChecked, Component, ElementRef, inject, input } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { errorMessage } from '../../core/forms';

/**
 * Campo de formulario: etiqueta, control proyectado, ayuda y error. Vincula el error y la ayuda al
 * control con `aria-describedby` y marca `aria-invalid`, así el lector de pantalla los anuncia al enfocar.
 */
@Component({
  selector: 'app-field',
  template: `
    <label class="field-label" [attr.for]="for()">
      {{ label() }}
      @if (optional()) {
        <span class="font-normal text-muted">(opcional)</span>
      }
    </label>
    <ng-content />
    @if (hint()) {
      <p class="mt-1.5 text-sm text-muted" [id]="for() + '-hint'">{{ hint() }}</p>
    }
    @if (message(); as text) {
      <p class="mt-1.5 flex items-start gap-1.5 text-sm font-semibold text-danger" [id]="for() + '-error'">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" class="mt-0.5 flex-none">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4M12 16h.01" />
        </svg>
        <span>{{ text }}</span>
      </p>
    }
  `,
  host: { class: 'block' },
})
export class Field implements AfterContentChecked {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** `id` del control proyectado. */
  readonly for = input.required<string>();
  readonly label = input.required<string>();
  readonly control = input<AbstractControl | null>(null);
  readonly hint = input<string>();
  readonly optional = input(false);

  protected message(): string | null {
    return errorMessage(this.control());
  }

  ngAfterContentChecked(): void {
    const target = this.host.nativeElement.querySelector<HTMLElement>(`[id="${this.for()}"]`);
    if (!target) return;
    const error = this.message() !== null;
    if (error) target.setAttribute('aria-invalid', 'true');
    else target.removeAttribute('aria-invalid');
    const ids = [this.hint() ? `${this.for()}-hint` : null, error ? `${this.for()}-error` : null].filter(Boolean);
    if (ids.length) target.setAttribute('aria-describedby', ids.join(' '));
    else target.removeAttribute('aria-describedby');
  }
}
