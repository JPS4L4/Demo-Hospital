import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { combineLatest, switchMap } from 'rxjs';
import { LOADING, Remote, toRemote } from '../../../core/remote';
import { Avatar } from '../../../shared/ui/avatar';
import { Icon } from '../../../shared/ui/icon';
import { StateMessage } from '../../../shared/ui/state-message';
import { Profesional, iniciales, nombreCompleto } from '../profesional.model';
import { ProfesionalesService } from '../profesionales.service';

@Component({
  selector: 'app-profesional-detalle',
  imports: [RouterLink, Avatar, Icon, StateMessage],
  templateUrl: './profesional-detalle.html',
})
export class ProfesionalDetalle {
  private readonly service = inject(ProfesionalesService);
  private readonly reload = signal(0);

  /** Parámetro de ruta `:id` (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly state = toSignal(
    combineLatest([toObservable(this.id), toObservable(this.reload)]).pipe(
      switchMap(([id]) => toRemote(this.service.obtener(id))),
    ),
    { initialValue: LOADING as Remote<Profesional> },
  );

  protected readonly nombre = (p: Profesional) => nombreCompleto(p);
  protected readonly iniciales = (p: Profesional) => iniciales(p);
  protected readonly telefonoLimpio = (p: Profesional) => (p.telefono ?? '').replace(/[^\d+]/g, '');
  protected readonly parrafos = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data.bio.split(/\n{2,}/).filter((p) => p.trim()) : [];
  });

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }
}
