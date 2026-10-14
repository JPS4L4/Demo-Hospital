import { Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { LOADING, Remote, toRemote } from '../../core/remote';
import { PageHeader } from '../../shared/ui/page-header';
import { SkeletonCards } from '../../shared/ui/skeleton-cards';
import { StateMessage } from '../../shared/ui/state-message';
import { SedeCard } from './sede-card';
import { Sede } from './sede.model';
import { SedesService } from './sedes.service';

@Component({
  selector: 'app-sedes',
  imports: [PageHeader, SkeletonCards, StateMessage, SedeCard],
  templateUrl: './sedes.html',
})
export class Sedes {
  private readonly service = inject(SedesService);
  private readonly reload = signal(0);

  protected readonly state = toSignal(
    toObservable(this.reload).pipe(switchMap(() => toRemote(this.service.listar()))),
    { initialValue: LOADING as Remote<Sede[]> },
  );

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }
}
