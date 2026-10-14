import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon, IconName } from './icon';
import { PageHeader } from './page-header';

/** Página provisional para secciones cuyo contenido llega en el siguiente bloque. */
@Component({
  selector: 'app-coming-soon',
  imports: [RouterLink, Icon, PageHeader],
  template: `
    <app-page-header [eyebrow]="eyebrow()" [title]="title()" [lead]="lead()" />
    <section class="container-page section">
      <div class="grid gap-10 md:grid-cols-[1.1fr_1fr] md:items-start">
        <div class="card p-6 md:p-8">
          <p class="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent">
            <app-icon name="clock" [size]="16" />
            Próximamente
          </p>
          <h2 class="mt-5 text-2xl">Estamos preparando esta sección</h2>
          <p class="mt-3 text-muted">{{ detail() }}</p>
          <div class="mt-7 flex flex-wrap gap-3">
            <a routerLink="/" class="btn btn-primary">
              <app-icon name="arrow-left" [size]="18" />
              Volver al inicio
            </a>
            <a routerLink="/noticias" class="btn btn-secondary">Ver noticias</a>
          </div>
        </div>
        <ul class="grid gap-4" aria-label="Qué podrás hacer aquí">
          @for (item of items(); track item.title) {
            <li class="flex gap-4">
              <span class="icon-tile"><app-icon [name]="item.icon" [size]="22" /></span>
              <div>
                <h3 class="text-lg">{{ item.title }}</h3>
                <p class="text-muted">{{ item.text }}</p>
              </div>
            </li>
          }
        </ul>
      </div>
    </section>
  `,
  host: { class: 'block' },
})
export class ComingSoon {
  readonly eyebrow = input.required<string>();
  readonly title = input.required<string>();
  readonly lead = input.required<string>();
  readonly detail = input.required<string>();
  readonly items = input.required<{ icon: IconName; title: string; text: string }[]>();
}
