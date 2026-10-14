import { Component, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';
import { LOADING, Remote, toRemote } from '../../core/remote';
import { PageHeader } from '../../shared/ui/page-header';
import { SkeletonCards } from '../../shared/ui/skeleton-cards';
import { StateMessage } from '../../shared/ui/state-message';
import { Noticia } from './noticia.model';
import { NewsCard } from './news-card';
import { NoticiasService } from './noticias.service';

@Component({
  selector: 'app-noticias',
  imports: [PageHeader, SkeletonCards, StateMessage, NewsCard],
  templateUrl: './noticias.html',
  styleUrl: './noticias.css',
})
export class Noticias {
  private readonly service = inject(NoticiasService);
  private readonly reload = signal(0);

  protected readonly state = toSignal(
    toObservable(this.reload).pipe(switchMap(() => toRemote(this.service.listar()))),
    { initialValue: LOADING as Remote<Noticia[]> },
  );

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }
}
