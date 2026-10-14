import { Component, computed, inject, linkedSignal, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, switchMap } from 'rxjs';
import { addDays, formatFechaLarga, formatHora, hoyBogota } from '../../../core/dates';
import { parseApiError, problemMessage } from '../../../core/forms';
import { Page, positiveInt } from '../../../core/page';
import { LOADING, Remote, keepPrevious, toRemote } from '../../../core/remote';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { EstadoBadge } from '../../../shared/ui/estado-badge';
import { Icon } from '../../../shared/ui/icon';
import { StateMessage } from '../../../shared/ui/state-message';
import { Cita } from '../../citas/cita.model';
import { CitasService } from '../../citas/citas.service';
import { nombreCompleto } from '../../profesionales/profesional.model';
import { ProfesionalesService } from '../../profesionales/profesionales.service';

@Component({
  selector: 'app-admin-agenda',
  imports: [ConfirmDialog, EstadoBadge, Icon, StateMessage],
  templateUrl: './agenda.html',
})
export class AdminAgenda {
  private readonly citas = inject(CitasService);

  protected readonly hoy = hoyBogota();
  protected readonly fecha = signal(this.hoy);
  protected readonly profesionalId = signal<number | null>(null);
  private readonly reload = signal(0);

  /** Todos los profesionales (también inactivos: pueden tener citas históricas) para filtrar. */
  protected readonly profesionales = toSignal(
    inject(ProfesionalesService)
      .listar({ activo: null, limit: 100 })
      .pipe(
        map((page) => page.items),
        catchError(() => of([])),
      ),
    { initialValue: [] },
  );

  private readonly result = toSignal(
    combineLatest([toObservable(this.fecha), toObservable(this.profesionalId), toObservable(this.reload)]).pipe(
      switchMap(([fecha, profesionalId]) =>
        toRemote(
          // Sin zona: la API interpreta los límites en hora de Bogotá.
          this.citas.listar({ desde: `${fecha}T00:00:00`, hasta: `${fecha}T23:59:59`, profesionalId, limit: 100 }),
        ),
      ),
    ),
    { initialValue: LOADING as Remote<Page<Cita>> },
  );

  protected readonly view = keepPrevious(this.result);

  /** Copia local de las citas del día; las acciones la actualizan con la respuesta del servidor. */
  protected readonly items = linkedSignal<Cita[]>(() => {
    const v = this.view();
    return v.status === 'ready' ? v.data.items : [];
  });

  protected readonly conteo = computed(() => {
    const list = this.items();
    return {
      total: list.length,
      programadas: list.filter((c) => c.estado === 'programada').length,
      atendidas: list.filter((c) => c.estado === 'atendida').length,
    };
  });

  protected readonly busyId = signal<number | null>(null);
  protected readonly actionError = signal<string | null>(null);
  protected readonly anuncio = signal('');

  protected readonly cancelando = signal<Cita | null>(null);
  protected readonly cancelError = signal<string | null>(null);
  protected readonly mensajeCancelar = computed(() => {
    const c = this.cancelando();
    if (!c) return '';
    // The time ends in "a. m."/"p. m.", so it must not be followed by a period.
    return `El horario de ${c.paciente.nombres} ${c.paciente.apellidos} con ${c.profesional.nombres} ${c.profesional.apellidos} (${formatHora(c.inicio)}) quedará libre.`;
  });

  protected readonly fechaLarga = formatFechaLarga;
  protected readonly hora = formatHora;
  protected readonly nombre = nombreCompleto;

  protected onFecha(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) this.fecha.set(value);
  }

  protected mover(dias: number): void {
    this.fecha.update((f) => addDays(f, dias));
  }

  protected irAHoy(): void {
    this.fecha.set(this.hoy);
  }

  protected onProfesional(event: Event): void {
    this.profesionalId.set(positiveInt((event.target as HTMLSelectElement).value));
  }

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  protected marcarAtendida(cita: Cita): void {
    this.actionError.set(null);
    this.busyId.set(cita.id);
    this.citas.marcarAtendida(cita.id).subscribe({
      next: (actualizada) => {
        this.reemplazar(actualizada);
        this.busyId.set(null);
        this.anuncio.set('Cita marcada como atendida.');
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.actionError.set(problemMessage(parseApiError(err), 'No pudimos actualizar la cita. Inténtalo de nuevo.'));
      },
    });
  }

  protected pedirCancelar(cita: Cita): void {
    this.cancelError.set(null);
    this.cancelando.set(cita);
  }

  protected cerrarDialogo(): void {
    if (this.busyId() === null) this.cancelando.set(null);
  }

  protected confirmarCancelacion(): void {
    const cita = this.cancelando();
    if (!cita || this.busyId() !== null) return;
    this.cancelError.set(null);
    this.busyId.set(cita.id);
    this.citas.cancelar(cita.id).subscribe({
      next: (actualizada) => {
        this.reemplazar(actualizada);
        this.busyId.set(null);
        this.cancelando.set(null);
        this.anuncio.set('Cita cancelada.');
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.cancelError.set(problemMessage(parseApiError(err), 'No pudimos cancelar la cita. Inténtalo de nuevo.'));
      },
    });
  }

  private reemplazar(cita: Cita): void {
    this.items.update((list) => list.map((c) => (c.id === cita.id ? cita : c)));
  }
}
