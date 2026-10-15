import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Icon, IconName } from '../../shared/ui/icon';

/** Carcasa del panel: encabezado, sub-navegación (lateral en pantallas anchas, en fila en las angostas) y contenido. */
@Component({
  selector: 'app-admin',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './admin.html',
  styleUrl: './admin.css',
})
export class Admin {
  protected readonly auth = inject(AuthService);

  protected readonly sections: { path: string; label: string; icon: IconName; exact: boolean }[] = [
    { path: '/admin', label: 'Resumen', icon: 'layout-dashboard', exact: true },
    { path: '/admin/agenda', label: 'Agenda', icon: 'calendar-check', exact: false },
    { path: '/admin/analitica', label: 'Analítica', icon: 'activity', exact: false },
    { path: '/admin/noticias', label: 'Noticias', icon: 'newspaper', exact: false },
    { path: '/admin/profesionales', label: 'Profesionales', icon: 'users', exact: false },
  ];
}
