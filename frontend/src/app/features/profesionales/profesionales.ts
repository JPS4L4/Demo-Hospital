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
import { catchError, combineLatest, debounceTime, filter, map, of, switchMap } from 'rxjs';
import { Page, positiveInt } from '../../core/page';
import { LOADING, Remote, keepPrevious, toRemote } from '../../core/remote';
import { Icon } from '../../shared/ui/icon';
import { PageHeader } from '../../shared/ui/page-header';
import { Pagination } from '../../shared/ui/pagination';
import { SkeletonCards } from '../../shared/ui/skeleton-cards';
import { StateMessage } from '../../shared/ui/state-message';
import { EspecialidadesService } from '../especialidades/especialidades.service';
import { SedesService } from '../sedes/sedes.service';
import { ProfesionalCard } from './profesional-card';
import { Profesional } from './profesional.model';
import { ProfesionalesService } from './profesionales.service';

export const PAGE_SIZE = 9;
export const SEARCH_DEBOUNCE_MS = 300;

/** Estado de los filtros; vive en la URL (`?q=&especialidad_id=&sede_id=&pagina=`) para poder compartirlo. */
interface Query {
  q: string;
  especialidadId: number | null;
  sedeId: number | null;
  /** Número de página, desde 1. */
  pagina: number;
}

@Component({
  selector: 'app-profesionales',
  imports: [Icon, PageHeader, Pagination, SkeletonCards, StateMessage, ProfesionalCard],
  templateUrl: './profesionales.html',
  styleUrl: './profesionales.css',
})
export class Profesionales {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ProfesionalesService);
  private readonly reload = signal(0);
  private readonly resultsHeading = viewChild<ElementRef<HTMLElement>>('results');

  protected readonly pageSize = PAGE_SIZE;
  /** Texto que el usuario está escribiendo; `null` = mostrar el de la URL. */
  protected readonly search = signal<string | null>(null);
  private appliedSearch = '';

  protected readonly query = toSignal(
    this.route.queryParamMap.pipe(
      map((p): Query => ({
        q: (p.get('q') ?? '').trim(),
        especialidadId: positiveInt(p.get('especialidad_id')),
        sedeId: positiveInt(p.get('sede_id')),
        pagina: positiveInt(p.get('pagina')) ?? 1,
      })),
    ),
    { requireSync: true },
  );

  /** Las opciones de los filtros son opcionales: si fallan, el filtro queda en "Todas". */
  protected readonly especialidades = toSignal(
    inject(EspecialidadesService)
      .listar()
      .pipe(catchError(() => of([]))),
    { initialValue: [] },
  );
  protected readonly sedes = toSignal(
    inject(SedesService)
      .listar()
      .pipe(catchError(() => of([]))),
    { initialValue: [] },
  );

  private readonly result = toSignal(
    combineLatest([toObservable(this.query), toObservable(this.reload)]).pipe(
      switchMap(([q]) =>
        toRemote(
          this.service.listar({
            q: q.q,
            especialidadId: q.especialidadId,
            sedeId: q.sedeId,
            limit: PAGE_SIZE,
            offset: (q.pagina - 1) * PAGE_SIZE,
          }),
        ),
      ),
    ),
    { initialValue: LOADING as Remote<Page<Profesional>> },
  );

  protected readonly view = keepPrevious(this.result);

  protected readonly hasFilters = computed(() => {
    const q = this.query();
    return q.q !== '' || q.especialidadId !== null || q.sedeId !== null;
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

  protected onEspecialidad(event: Event): void {
    this.update({ especialidadId: positiveInt((event.target as HTMLSelectElement).value) });
  }

  protected onSede(event: Event): void {
    this.update({ sedeId: positiveInt((event.target as HTMLSelectElement).value) });
  }

  protected onOffset(offset: number): void {
    this.update({ pagina: Math.floor(offset / PAGE_SIZE) + 1 });
    this.resultsHeading()?.nativeElement.scrollIntoView?.();
  }

  protected clear(): void {
    this.search.set(null);
    this.update({ q: '', especialidadId: null, sedeId: null });
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
        especialidad_id: next.especialidadId,
        sede_id: next.sedeId,
        pagina: next.pagina > 1 ? next.pagina : null,
      },
      replaceUrl,
      // Evita que el router suba al inicio de la página al filtrar.
      scroll: 'manual',
    });
  }
}
