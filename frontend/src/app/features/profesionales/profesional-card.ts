import { Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar } from '../../shared/ui/avatar';
import { Icon } from '../../shared/ui/icon';
import { Profesional, iniciales, nombreCompleto } from './profesional.model';

/** Tarjeta de profesional; el nombre es el enlace y su área clicable cubre toda la tarjeta. */
@Component({
  selector: 'app-profesional-card',
  imports: [RouterLink, Avatar, Icon],
  template: `
    <article class="pro-card card relative flex h-full flex-col gap-4 p-6">
      <div class="flex items-center gap-4">
        <app-avatar [initials]="iniciales()" />
        <div class="min-w-0">
          <p class="text-sm font-semibold text-accent">{{ profesional().especialidad.nombre }}</p>
          <h3 class="mt-0.5 text-xl">
            <a [routerLink]="['/profesionales', profesional().id]" class="pro-link">{{ nombre() }}</a>
          </h3>
        </div>
      </div>
      <ul class="grid gap-2 text-[0.9375rem] text-muted">
        <li class="flex items-start gap-2.5">
          <app-icon name="map-pin" [size]="18" class="mt-0.5 text-brand" />
          <span>{{ profesional().sede.nombre }}, {{ profesional().sede.ciudad }}</span>
        </li>
        <li class="flex items-start gap-2.5">
          <app-icon name="shield-check" [size]="18" class="mt-0.5 text-brand" />
          <span>Registro {{ profesional().registro_profesional }}</span>
        </li>
      </ul>
      <span class="mt-auto inline-flex items-center gap-2 font-semibold text-brand" aria-hidden="true">
        Ver perfil
        <app-icon name="arrow-right" [size]="18" class="arrow" />
      </span>
    </article>
  `,
  styles: `
    .pro-link {
      color: inherit;
      text-decoration: none;
    }
    .pro-link::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
    }
    .pro-link:focus-visible {
      outline: none;
    }
    .pro-card:has(.pro-link:focus-visible) {
      outline: 3px solid var(--ring);
      outline-offset: 3px;
    }
    .pro-card {
      transition: border-color 180ms var(--ease-out-soft);
    }
    .arrow {
      transition: transform 180ms var(--ease-out-soft);
    }
    @media (hover: hover) {
      .pro-card:hover {
        border-color: var(--brand);
      }
      .pro-card:hover .arrow {
        transform: translateX(4px);
      }
    }
  `,
  host: { class: 'block h-full' },
})
export class ProfesionalCard {
  readonly profesional = input.required<Profesional>();

  protected readonly nombre = computed(() => nombreCompleto(this.profesional()));
  protected readonly iniciales = computed(() => iniciales(this.profesional()));
}
