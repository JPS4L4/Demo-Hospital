import { DatePipe } from '@angular/common';
import { Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { combineLatest, switchMap } from 'rxjs';
import { LOADING, Remote, toRemote } from '../../../core/remote';
import { Icon } from '../../../shared/ui/icon';
import { StateMessage } from '../../../shared/ui/state-message';
import { Noticia } from '../noticia.model';
import { NoticiasService } from '../noticias.service';

@Component({
  selector: 'app-noticia-detalle',
  imports: [DatePipe, RouterLink, Icon, StateMessage],
  templateUrl: './noticia-detalle.html',
})
export class NoticiaDetalle {
  private readonly service = inject(NoticiasService);
  private readonly reload = signal(0);

  /** Parámetro de ruta `:id` (withComponentInputBinding). */
  readonly id = input.required<string>();

  protected readonly state = toSignal(
    combineLatest([toObservable(this.id), toObservable(this.reload)]).pipe(
      switchMap(([id]) => toRemote(this.service.obtener(id))),
    ),
    { initialValue: LOADING as Remote<Noticia> },
  );

  protected readonly parrafos = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data.contenido.split(/\n{2,}/).filter((p) => p.trim()) : [];
  });

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }
}
