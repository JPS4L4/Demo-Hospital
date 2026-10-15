import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { LOADING, Remote, toRemote } from '../../core/remote';
import { Icon, IconName } from '../../shared/ui/icon';
import { SkeletonCards } from '../../shared/ui/skeleton-cards';
import { StateMessage } from '../../shared/ui/state-message';
import { EspecialidadesService } from '../especialidades/especialidades.service';
import { NewsCard } from '../noticias/news-card';
import { Noticia } from '../noticias/noticia.model';
import { NoticiasService } from '../noticias/noticias.service';
import { Sede } from '../sedes/sede.model';
import { SedesService } from '../sedes/sedes.service';

interface EspecialidadDestacada {
  icon: IconName;
  nombre: string;
  descripcion: string;
}

function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim();
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, Icon, SkeletonCards, StateMessage, NewsCard],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  private readonly noticiasService = inject(NoticiasService);
  private readonly sedesService = inject(SedesService);
  private readonly especialidadesService = inject(EspecialidadesService);
  private readonly reloadNoticias = signal(0);
  private readonly reloadSedes = signal(0);

  protected readonly especialidades: EspecialidadDestacada[] = [
    {
      icon: 'heart-pulse',
      nombre: 'Cardiología',
      descripcion: 'Control de la presión, ecocardiografía y rehabilitación cardiaca.',
    },
    {
      icon: 'smile',
      nombre: 'Pediatría',
      descripcion: 'Seguimiento del crecimiento, vacunación y urgencias infantiles.',
    },
    {
      icon: 'activity',
      nombre: 'Medicina interna',
      descripcion: 'Una mirada integral para adultos con una o varias condiciones.',
    },
    {
      icon: 'flask',
      nombre: 'Laboratorio clínico',
      descripcion: 'Resultados de rutina el mismo día y toma de muestras a domicilio.',
    },
    {
      icon: 'shield-check',
      nombre: 'Medicina preventiva',
      descripcion: 'Chequeos, vacunación y programas para evitar enfermedades.',
    },
    {
      icon: 'clock',
      nombre: 'Urgencias 24 horas',
      descripcion: 'Atención inmediata, todos los días del año, en cada sede.',
    },
  ];

  /** Las tres noticias más recientes (la API ya las entrega ordenadas). */
  protected readonly noticias = toSignal(
    toObservable(this.reloadNoticias).pipe(
      switchMap(() => toRemote(this.noticiasService.listar().pipe(map((n) => n.slice(0, 3))))),
    ),
    { initialValue: LOADING as Remote<Noticia[]> },
  );

  protected readonly sedes = toSignal(
    toObservable(this.reloadSedes).pipe(switchMap(() => toRemote(this.sedesService.listar()))),
    { initialValue: LOADING as Remote<Sede[]> },
  );

  /** Especialidades reales de la API; si falla, la portada sigue con su lista fija y sin enlaces filtrados. */
  private readonly catalogo = toSignal(
    this.especialidadesService.listar().pipe(catchError(() => of(null))),
    { initialValue: null },
  );

  /** Id real de cada especialidad destacada (por nombre, sin tildes ni mayúsculas) para enlazar al listado. */
  protected readonly ids = computed(() => {
    const ids = new Map<string, number>();
    for (const e of this.catalogo() ?? []) ids.set(normalizar(e.nombre), e.id);
    return ids;
  });

  protected readonly totalEspecialidades = computed(() => this.catalogo()?.length ?? null);

  protected idDe(nombre: string): number | null {
    return this.ids().get(normalizar(nombre)) ?? null;
  }

  protected readonly totalSedes = computed(() => {
    const s = this.sedes();
    return s.status === 'ready' ? s.data.length : null;
  });

  protected retryNoticias(): void {
    this.reloadNoticias.update((n) => n + 1);
  }

  protected retrySedes(): void {
    this.reloadSedes.update((n) => n + 1);
  }
}
