import { Component, input } from '@angular/core';

/** Avatar con iniciales (sin fotos). Decorativo: el nombre ya aparece en texto junto a él. */
@Component({
  selector: 'app-avatar',
  template: `{{ initials() }}`,
  styles: `
    :host {
      display: inline-grid;
      place-items: center;
      flex: none;
      width: var(--avatar-size, 3.5rem);
      height: var(--avatar-size, 3.5rem);
      border-radius: 9999px;
      background: var(--brand-soft);
      color: var(--brand);
      font-family: var(--font-display);
      font-size: calc(var(--avatar-size, 3.5rem) * 0.36);
      font-weight: 600;
      letter-spacing: 0.02em;
      line-height: 1;
      user-select: none;
    }
  `,
  host: { 'aria-hidden': 'true' },
})
export class Avatar {
  readonly initials = input.required<string>();
}
