import {
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { combineLatest, debounceTime, filter, map, switchMap } from 'rxjs';
import { Page, positiveInt } from '../../core/page';
import { LOADING, Remote, keepPrevious, toRemote } from '../../core/remote';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { SkeletonCards } from '../../shared/ui/skeleton-cards';
import { StateMessage } from '../../shared/ui/state-message';
import { MedicamentoCard } from './medicamento-card';
import { Medicamento } from './medicamento.model';
import { MedicamentosService } from './medicamentos.service';

export const PAGE_SIZE = 12;
export const SEARCH_DEBOUNCE_MS = 300;

type Formula = 'todos' | 'si' | 'no';

/** Estado de los filtros; vive en la URL (`?q=&formula=si|no&pagina=`) para poder compartirlo. */
interface Query {
  q: string;
  formula: Formula;
  /** Número de página, desde 1. */
  pagina: number;
}

const OPCIONES_FORMULA: { value: Formula; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'si', label: 'Sí' },
  { value: 'no', label: 'No' },
];

@Component({
  selector: 'app-medicamentos',
  imports: [Icon, PageHeader, Pagination, SkeletonCards, StateMessage, MedicamentoCard],
  templateUrl: './medicamentos.html',
  styleUrl: './medicamentos.css',
})
export class Medicamentos {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(MedicamentosService);
  private readonly reload = signal(0);
  private readonly resultsHeading = viewChild<ElementRef<HTMLElement>>('results');

  protected readonly pageSize = PAGE_SIZE;
  protected readonly opcionesFormula = OPCIONES_FORMULA;
  /** Texto que el usuario está escribiendo; `null` = mostrar el de la URL. */
  protected readonly search = signal<string | null>(null);
  private appliedSearch = '';

  protected readonly query = toSignal(
    this.route.queryParamMap.pipe(
      map((p): Query => {
        const formula = p.get('formula');
        return {
          q: (p.get('q') ?? '').trim(),
          formula: formula === 'si' || formula === 'no' ? formula : 'todos',
          pagina: positiveInt(p.get('pagina')) ?? 1,
        };
      }),
    ),
    { requireSync: true },
  );

  private readonly result = toSignal(
    combineLatest([toObservable(this.query), toObservable(this.reload)]).pipe(
      switchMap(([q]) =>
        toRemote(
          this.service.listar({
            q: q.q,
            requiereFormula: q.formula === 'todos' ? null : q.formula === 'si',
            limit: PAGE_SIZE,
            offset: (q.pagina - 1) * PAGE_SIZE,
          }),
        ),
      ),
    ),
    { initialValue: LOADING as Remote<Page<Medicamento>> },
  );

  protected readonly view = keepPrevious(this.result);

  protected readonly hasFilters = computed(() => {
    const q = this.query();
    return q.q !== '' || q.formula !== 'todos';
  });

  constructor() {
    // Si la URL cambia por otra vía (atrás/adelante, enlace), el cuadro vuelve a reflejarla.
    effect(() => {
      const q = this.query().q;
      untracked(() => {
        if (q !== this.appliedSearch) this.search.set(null);
        this.appliedSearch = q;
      });
    });

    // El texto se aplica a la URL tras una pausa al escribir; sin apilar entradas en el historial.
    toObservable(this.search)
      .pipe(
        filter((text): text is string => text !== null),
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((text) => text.trim()),
        filter((text) => text !== this.query().q),
        takeUntilDestroyed(),
      )
      .subscribe((q) => {
        this.appliedSearch = q;
        this.update({ q }, true);
      });
  }

  protected onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  protected onFormula(formula: Formula): void {
    this.update({ formula });
  }

  protected onOffset(offset: number): void {
    this.update({ pagina: Math.floor(offset / PAGE_SIZE) + 1 });
    this.resultsHeading()?.nativeElement.scrollIntoView?.();
  }

  protected clear(): void {
    this.search.set(null);
    this.update({ q: '', formula: 'todos' });
  }

  protected goFirstPage(): void {
    this.update({ pagina: 1 });
  }

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  /** Cambiar un filtro vuelve a la primera página; `pagina` explícito la conserva. */
  private update(patch: Partial<Query>, replaceUrl = false): void {
    const next = { ...this.query(), pagina: 1, ...patch };
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: next.q || null,
        formula: next.formula === 'todos' ? null : next.formula,
        pagina: next.pagina > 1 ? next.pagina : null,
      },
      replaceUrl,
      // Evita que el router suba al inicio de la página al filtrar.
      scroll: 'manual',
    });
  }
}
