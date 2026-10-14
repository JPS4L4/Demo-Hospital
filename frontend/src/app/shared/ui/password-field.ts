import { Component, input, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { Field } from './field';
import { Icon } from './icon';

/** Campo de contraseña con botón para mostrarla u ocultarla (el foco se queda en el campo). */
@Component({
  selector: 'app-password-field',
  imports: [ReactiveFormsModule, Field, Icon],
  template: `
    <app-field [for]="inputId()" [label]="label()" [control]="control()" [hint]="hint()">
      <div class="relative">
        <input
          [id]="inputId()"
          class="field-control pw-input"
          [type]="visible() ? 'text' : 'password'"
          [formControl]="control()"
          [attr.autocomplete]="autocomplete()"
          autocapitalize="none"
          spellcheck="false"
        />
        <button
          type="button"
          class="pw-toggle"
          [attr.aria-pressed]="visible()"
          [attr.aria-label]="visible() ? 'Ocultar contraseña' : 'Mostrar contraseña'"
          (click)="visible.set(!visible())"
        >
          <app-icon [name]="visible() ? 'eye-off' : 'eye'" [size]="20" />
        </button>
      </div>
    </app-field>
  `,
  styles: `
    .pw-input {
      padding-right: 3rem;
    }
    .pw-toggle {
      position: absolute;
      top: 50%;
      right: 0.25rem;
      display: grid;
      place-items: center;
      width: 2.5rem;
      height: 2.5rem;
      transform: translateY(-50%);
      border: 0;
      border-radius: 0.375rem;
      background: transparent;
      color: var(--muted);
      cursor: pointer;
      transition: color 160ms var(--ease-out-soft);
    }
    @media (hover: hover) {
      .pw-toggle:hover {
        color: var(--ink);
      }
    }
  `,
  host: { class: 'block' },
})
export class PasswordField {
  readonly inputId = input.required<string>();
  readonly label = input('Contraseña');
  readonly control = input.required<FormControl<string>>();
  readonly autocomplete = input<'current-password' | 'new-password'>('current-password');
  readonly hint = input<string>();

  protected readonly visible = signal(false);
}
