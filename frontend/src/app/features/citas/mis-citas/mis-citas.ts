import {
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { switchMap } from 'rxjs';
import { AuthService } from '../../../core/auth/auth.service';
import { etiquetaDia, fechaBogota, formatFechaLarga, formatHora } from '../../../core/dates';
import { parseApiError, problemMessage } from '../../../core/forms';
import { Page } from '../../../core/page';
import { LOADING, Remote, toRemote } from '../../../core/remote';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { EstadoBadge } from '../../../shared/ui/estado-badge';
import { Icon } from '../../../shared/ui/icon';
import { PageHeader } from '../../../shared/ui/page-header';
import { SkeletonCards } from '../../../shared/ui/skeleton-cards';
import { StateMessage } from '../../../shared/ui/state-message';
import { Cita } from '../cita.model';
import { CitasService } from '../citas.service';

type Vista = 'proximas' | 'anteriores';

@Component({
  selector: 'app-mis-citas',
  imports: [RouterLink, ConfirmDialog, EstadoBadge, Icon, PageHeader, SkeletonCards, StateMessage],
  templateUrl: './mis-citas.html',
  styleUrl: './mis-citas.css',
})
export class MisCitas {
  private readonly citas = inject(CitasService);
  private readonly injector = inject(Injector);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly auth = inject(AuthService);

  private readonly reload = signal(0);
  /** Citas ya actualizadas por el servidor (p. ej. canceladas) que sustituyen a las listadas. */
  private readonly actualizadas = signal<Record<number, Cita>>({});

  protected readonly state = toSignal(
    toObservable(this.reload).pipe(switchMap(() => toRemote(this.citas.listar({ limit: 100 })))),
    { initialValue: LOADING as Remote<Page<Cita>> },
  );

  protected readonly vista = signal<Vista>('proximas');

  /** Próximas: programadas que aún no terminan, la más cercana primero. Anteriores: el resto, la más reciente primero. */
  protected readonly grupos = computed(() => {
    const s = this.state();
    if (s.status !== 'ready') return null;
    const ahora = Date.now();
    const todas = s.data.items.map((c) => this.actualizadas()[c.id] ?? c);
    const porInicio = (a: Cita, b: Cita) =>
      new Date(a.inicio).getTime() - new Date(b.inicio).getTime();
    const proximas = todas.filter(
      (c) => c.estado === 'programada' && new Date(c.fin).getTime() > ahora,
    );
    const anteriores = todas.filter((c) => !proximas.includes(c));
    return {
      proximas: proximas.sort(porInicio),
      anteriores: anteriores.sort((a, b) => porInicio(b, a)),
    };
  });

  protected readonly visibles = computed(() => this.grupos()?.[this.vista()] ?? []);

  protected readonly cancelando = signal<Cita | null>(null);
  protected readonly mensajeCancelar = computed(() => {
    const c = this.cancelando();
    if (!c) return '';
    // The time ends in "a. m."/"p. m.", so it must not be followed by a period.
    return `Tu cita con ${c.profesional.nombres} ${c.profesional.apellidos} del ${formatFechaLarga(c.inicio)} a las ${formatHora(c.inicio)} quedará libre para otras personas.`;
  });
  protected readonly cancelBusy = signal(false);
  protected readonly cancelError = signal<string | null>(null);
  /** Mensaje para lectores de pantalla tras una acción. */
  protected readonly anuncio = signal('');

  protected readonly vistas: { value: Vista; label: string }[] = [
    { value: 'proximas', label: 'Próximas' },
    { value: 'anteriores', label: 'Anteriores' },
  ];

  protected readonly fechaLarga = formatFechaLarga;
  protected readonly hora = formatHora;
  protected readonly dia = (c: Cita) => etiquetaDia(fechaBogota(c.inicio));
  protected readonly puedeCancelar = (c: Cita) =>
    c.estado === 'programada' && new Date(c.inicio).getTime() > Date.now();

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  protected pedirCancelar(cita: Cita): void {
    this.cancelError.set(null);
    this.cancelando.set(cita);
  }

  protected cerrarDialogo(): void {
    if (!this.cancelBusy()) this.cancelando.set(null);
  }

  /** La cita solo cambia en pantalla cuando el servidor confirma; mientras tanto el diálogo queda ocupado. */
  protected confirmarCancelacion(): void {
    const cita = this.cancelando();
    if (!cita || this.cancelBusy()) return;
    this.cancelBusy.set(true);
    this.cancelError.set(null);
    this.citas.cancelar(cita.id).subscribe({
      next: (actualizada) => {
        this.actualizadas.update((m) => ({ ...m, [actualizada.id]: actualizada }));
        this.cancelBusy.set(false);
        this.cancelando.set(null);
        this.anuncio.set('Cita cancelada.');
        afterNextRender(
          () => this.host.nativeElement.querySelector<HTMLElement>('#resultados')?.focus(),
          {
            injector: this.injector,
          },
        );
      },
      error: (err: unknown) => {
        this.cancelBusy.set(false);
        const problem = parseApiError(err);
        this.cancelError.set(
          problemMessage(problem, 'No pudimos cancelar la cita. Inténtalo de nuevo.'),
        );
        // Si el servidor ya la tenía cancelada o atendida, se refresca la lista.
        if (problem.status === 409) this.reload.update((n) => n + 1);
      },
    });
  }
}
