import { Component, HostListener, effect, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { ThemeService } from '../../core/theme';
import { Icon } from '../../shared/ui/icon';
import { Logo } from '../../shared/ui/logo';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Icon, Logo],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  protected readonly themeService = inject(ThemeService);

  navLinks = [
    { path: '/', label: 'Inicio' },
    { path: '/profesionales', label: 'Profesionales' },
    { path: '/medicamentos', label: 'Medicamentos' },
    { path: '/noticias', label: 'Noticias' },
    { path: '/sedes', label: 'Sedes' },
  ];

  menuOpen = signal(false);

  constructor() {
    const navigated = toSignal(
      inject(Router).events.pipe(filter((e) => e instanceof NavigationEnd)),
    );
    // Cierra el menú móvil al cambiar de página.
    effect(() => {
      navigated();
      this.menuOpen.set(false);
    });
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  @HostListener('document:keydown.escape')
  closeMenu(): void {
    this.menuOpen.set(false);
  }
}
