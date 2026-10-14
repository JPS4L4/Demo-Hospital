import { Component, input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  template: `
    <div class="container-page py-12 md:py-16">
      @if (eyebrow()) {
        <p class="eyebrow rise">{{ eyebrow() }}</p>
      }
      <h1 class="rise mt-4 max-w-3xl text-4xl md:text-5xl" style="--delay: 60ms">{{ title() }}</h1>
      @if (lead()) {
        <p class="lead rise mt-5" style="--delay: 120ms">{{ lead() }}</p>
      }
    </div>
  `,
  host: { class: 'block border-b border-line bg-sunken' },
})
export class PageHeader {
  readonly title = input.required<string>();
  readonly eyebrow = input<string>();
  readonly lead = input<string>();
}
