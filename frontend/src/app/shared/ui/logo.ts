import { Component } from '@angular/core';

@Component({
  selector: 'app-logo',
  template: `
    <svg viewBox="0 0 32 32" width="34" height="34" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M13.5 7h5v6.5H25v5h-6.5V25h-5v-6.5H7v-5h6.5z" fill="var(--on-brand)" />
      <circle cx="25" cy="7" r="2.5" fill="var(--accent)" />
    </svg>
    <span class="font-display text-xl font-semibold tracking-tight">Meridiana</span>
  `,
  host: { class: 'inline-flex items-center gap-2.5' },
})
export class Logo {}
