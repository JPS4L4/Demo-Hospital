import {
  Component,
  ElementRef,
  HostListener,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/theme';
import { Icon } from '../../shared/ui/icon';
import { Logo } from '../../shared/ui/logo';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, Icon, Logo],
  templateUrl: './header.html',
  styleUrl: './header.css',
})
export class Header {
  protected readonly themeService = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly userButton = viewChild<ElementRef<HTMLButtonElement>>('userButton');
  private readonly userMenuPanel = viewChild<ElementRef<HTMLElement>>('userMenuPanel');

  navLinks = [
    { path: '/', label: 'Inicio' },
    { path: '/profesionales', label: 'Profesionales' },
    { path: '/medicamentos', label: 'Medicamentos' },
    { path: '/noticias', label: 'Noticias' },
    { path: '/sedes', label: 'Sedes' },
  ];

  menuOpen = signal(false);
  userMenuOpen = signal(false);

  constructor() {
    const navigated = toSignal(this.router.events.pipe(filter((e) => e instanceof NavigationEnd)));
    // Cierra los menús al cambiar de página.
    effect(() => {
      navigated();
      this.menuOpen.set(false);
      this.userMenuOpen.set(false);
    });
  }

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  toggleUserMenu(): void {
    this.userMenuOpen.update((open) => !open);
  }

  /** Esc cierra lo que esté abierto; si era el menú de usuario, el foco vuelve a su botón. */
  @HostListener('document:keydown.escape')
  closeMenu(): void {
    if (this.userMenuOpen()) {
      this.userMenuOpen.set(false);
      this.userButton()?.nativeElement.focus();
    }
    this.menuOpen.set(false);
  }

  /** Un clic fuera del menú de usuario lo cierra. */
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.userMenuOpen()) return;
    const target = event.target as Node;
    const inside =
      this.userButton()?.nativeElement.contains(target) ||
      this.userMenuPanel()?.nativeElement.contains(target);
    if (!inside) this.userMenuOpen.set(false);
  }

  /** Si el foco sale del menú de usuario (Tab), se cierra sin robar el foco. */
  onUserMenuFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    const wrapper = event.currentTarget as HTMLElement;
    if (next && !wrapper.contains(next)) this.userMenuOpen.set(false);
  }

  logout(): void {
    this.auth.logout();
    this.menuOpen.set(false);
    this.userMenuOpen.set(false);
    void this.router.navigateByUrl('/');
  }
}
