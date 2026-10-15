import { Component, computed, input } from '@angular/core';
import { Icon } from '../../shared/ui/icon';
import { Sede } from './sede.model';

@Component({
  selector: 'app-sede-card',
  imports: [Icon],
  template: `
    <article class="card flex h-full flex-col p-6">
      <p class="eyebrow">{{ sede().ciudad }}</p>
      <h3 class="mt-3 text-2xl">{{ sede().nombre }}</h3>
      <ul class="mt-4 grid gap-3 text-[0.9375rem]">
        <li class="flex items-start gap-3">
          <app-icon name="map-pin" [size]="20" class="mt-0.5 text-brand" />
          <span>{{ sede().direccion }}, {{ sede().ciudad }}</span>
        </li>
        @if (sede().telefono; as tel) {
          <li class="flex items-start gap-3">
            <app-icon name="phone" [size]="20" class="mt-0.5 text-brand" />
            <a [href]="'tel:' + telefonoLimpio()" class="font-semibold hover:underline">{{
              tel
            }}</a>
          </li>
        }
        <li class="flex items-start gap-3">
          <app-icon name="clock" [size]="20" class="mt-0.5 text-brand" />
          <span>Lunes a sábado, 7:00 a 19:00</span>
        </li>
      </ul>
      <a
        class="btn btn-secondary mt-6 self-start"
        [href]="mapaUrl()"
        target="_blank"
        rel="noopener noreferrer"
      >
        Cómo llegar
        <span class="sr-only">a {{ sede().nombre }} (se abre en una pestaña nueva)</span>
        <app-icon name="arrow-right" [size]="18" />
      </a>
    </article>
  `,
  host: { class: 'block' },
})
export class SedeCard {
  readonly sede = input.required<Sede>();

  protected readonly telefonoLimpio = computed(() =>
    (this.sede().telefono ?? '').replace(/[^\d+]/g, ''),
  );

  protected readonly mapaUrl = computed(() => {
    const s = this.sede();
    const q = encodeURIComponent(`${s.direccion}, ${s.ciudad}, Colombia`);
    return `https://www.google.com/maps/search/?api=1&query=${q}`;
  });
}
