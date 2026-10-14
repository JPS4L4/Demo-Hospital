import { Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin, map, switchMap } from 'rxjs';
import { horaBogota, hoyBogota } from '../../../core/dates';
import { LOADING, Remote, toRemote } from '../../../core/remote';
import { Icon, IconName } from '../../../shared/ui/icon';
import { StateMessage } from '../../../shared/ui/state-message';
import { CitasService } from '../../citas/citas.service';
import { PacientesService } from '../../pacientes/pacientes.service';
import { ProfesionalesService } from '../../profesionales/profesionales.service';

interface Conteos {
  hoy: number;
  proximas: number;
  profesionales: number;
  pacientes: number;
}

@Component({
  selector: 'app-admin-resumen',
  imports: [RouterLink, Icon, StateMessage],
  templateUrl: './resumen.html',
  styleUrl: './resumen.css',
})
export class AdminResumen {
  private readonly citas = inject(CitasService);
  private readonly profesionales = inject(ProfesionalesService);
  private readonly pacientes = inject(PacientesService);
  private readonly reload = signal(0);

  protected readonly state = toSignal(
    toObservable(this.reload).pipe(
      switchMap(() => {
        const ahora = new Date();
        const hoy = hoyBogota(ahora);
        // Los límites van sin zona: la API los interpreta en hora de Bogotá.
        const solo = <T extends { total: number }>(page: T) => page.total;
        return toRemote(
          forkJoin({
            hoy: this.citas
              .listar({ estado: 'programada', desde: `${hoy}T00:00:00`, hasta: `${hoy}T23:59:59`, limit: 1 })
              .pipe(map(solo)),
            proximas: this.citas
              .listar({ estado: 'programada', desde: `${hoy}T${horaBogota(ahora)}:00`, limit: 1 })
              .pipe(map(solo)),
            profesionales: this.profesionales.listar({ limit: 1 }).pipe(map(solo)),
            pacientes: this.pacientes.total(),
          }),
        );
      }),
    ),
    { initialValue: LOADING as Remote<Conteos> },
  );

  protected readonly tarjetas: { key: keyof Conteos; label: string; icon: IconName; link: string; hint: string }[] = [
    { key: 'hoy', label: 'Por atender hoy', icon: 'calendar-check', link: '/admin/agenda', hint: 'Citas programadas para hoy' },
    { key: 'proximas', label: 'Citas próximas', icon: 'clock', link: '/admin/agenda', hint: 'Programadas desde este momento' },
    { key: 'profesionales', label: 'Profesionales activos', icon: 'users', link: '/admin/profesionales', hint: 'Atendiendo citas' },
    { key: 'pacientes', label: 'Pacientes', icon: 'heart-pulse', link: '/admin/agenda', hint: 'Registrados en el sistema' },
  ];

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }
}
