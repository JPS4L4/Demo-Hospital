import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { Noticia } from './noticia.model';

/** Tarjeta de noticia; el título es el enlace y su área clicable cubre toda la tarjeta. */
@Component({
  selector: 'app-news-card',
  imports: [DatePipe, RouterLink, Icon],
  template: `
    <article class="news-card card relative flex h-full flex-col p-6" [class.featured]="featured()">
      <time class="text-sm font-semibold text-accent" [attr.datetime]="noticia().fecha_publicacion">
        {{ noticia().fecha_publicacion | date: 'd MMM y' }}
      </time>
      <h3 class="mt-3" [class]="featured() ? 'text-3xl md:text-4xl' : 'text-xl'">
        <a [routerLink]="['/noticias', noticia().id]" class="news-link">{{ noticia().titulo }}</a>
      </h3>
      <p class="mt-3 text-muted" [class.md:text-lg]="featured()">{{ resumen() }}</p>
      <span class="mt-auto inline-flex items-center gap-2 pt-5 font-semibold text-brand" aria-hidden="true">
        Leer noticia
        <app-icon name="arrow-right" [size]="18" class="arrow" />
      </span>
    </article>
  `,
  styles: `
    .news-link {
      color: inherit;
      text-decoration: none;
    }
    .news-link::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    .news-link:focus-visible {
      outline: none;
    }
    .news-card:has(.news-link:focus-visible) {
      outline: 3px solid var(--ring);
      outline-offset: 3px;
    }
    .news-card {
      transition:
        border-color 180ms var(--ease-out-soft),
        transform 180ms var(--ease-out-soft);
    }
    .arrow {
      transition: transform 180ms var(--ease-out-soft);
    }
    @media (hover: hover) {
      .news-card:hover {
        border-color: var(--brand);
      }
      .news-card:hover .arrow {
        transform: translateX(4px);
      }
    }
    .featured {
      background: var(--brand-soft);
      border-color: transparent;
    }
  `,
  host: { class: 'block' },
})
export class NewsCard {
  readonly noticia = input.required<Noticia>();
  readonly featured = input(false);

  protected readonly resumen = computed(() => {
    const texto = this.noticia().contenido.replace(/\s+/g, ' ').trim();
    const max = this.featured() ? 230 : 140;
    if (texto.length <= max) return texto;
    return texto.slice(0, max).replace(/\s+\S*$/, '') + '…';
  });
}
