import { Component, ElementRef, Injector, afterNextRender, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { switchMap } from 'rxjs';
import { formatFechaCorta } from '../../../core/dates';
import { applyProblem, focusFirstInvalid, parseApiError, problemMessage, requiredText } from '../../../core/forms';
import { LOADING, Remote, toRemote } from '../../../core/remote';
import { ConfirmDialog } from '../../../shared/ui/confirm-dialog';
import { Field } from '../../../shared/ui/field';
import { Icon } from '../../../shared/ui/icon';
import { StateMessage } from '../../../shared/ui/state-message';
import { Noticia } from '../../noticias/noticia.model';
import { NoticiasService } from '../../noticias/noticias.service';

/** `null` = sin editor; `'nueva'` = creando; una noticia = editándola. */
type Edicion = null | 'nueva' | Noticia;

@Component({
  selector: 'app-admin-noticias',
  imports: [ReactiveFormsModule, ConfirmDialog, Field, Icon, StateMessage],
  templateUrl: './admin-noticias.html',
})
export class AdminNoticias {
  private readonly service = inject(NoticiasService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly reload = signal(0);
  private trigger: HTMLElement | null = null;

  protected readonly state = toSignal(
    toObservable(this.reload).pipe(switchMap(() => toRemote(this.service.listar()))),
    { initialValue: LOADING as Remote<Noticia[]> },
  );

  protected readonly edicion = signal<Edicion>(null);
  protected readonly guardando = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly anuncio = signal('');

  protected readonly eliminando = signal<Noticia | null>(null);
  protected readonly eliminarBusy = signal(false);
  protected readonly eliminarError = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    titulo: ['', [requiredText, Validators.required, Validators.maxLength(200)]],
    contenido: ['', [requiredText, Validators.required, Validators.maxLength(20000)]],
  });

  protected readonly fecha = formatFechaCorta;
  protected readonly esNueva = (e: Edicion) => e === 'nueva';

  protected retry(): void {
    this.reload.update((n) => n + 1);
  }

  protected abrir(edicion: 'nueva' | Noticia, event: Event): void {
    this.trigger = event.currentTarget as HTMLElement;
    this.formError.set(null);
    this.form.reset(
      edicion === 'nueva' ? { titulo: '', contenido: '' } : { titulo: edicion.titulo, contenido: edicion.contenido },
    );
    this.edicion.set(edicion);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#noticia-titulo')?.focus(), {
      injector: this.injector,
    });
  }

  protected cerrar(): void {
    this.edicion.set(null);
    this.restoreFocus();
  }

  protected guardar(): void {
    const edicion = this.edicion();
    if (!edicion || this.guardando()) return;
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const { titulo, contenido } = this.form.getRawValue();
    const datos = { titulo: titulo.trim(), contenido: contenido.trim() };
    this.guardando.set(true);
    const request = edicion === 'nueva' ? this.service.crear(datos) : this.service.actualizar(edicion.id, datos);
    request.subscribe({
      next: () => {
        this.guardando.set(false);
        this.edicion.set(null);
        this.anuncio.set(edicion === 'nueva' ? 'Noticia publicada.' : 'Noticia actualizada.');
        this.reload.update((n) => n + 1);
        this.restoreFocus();
      },
      error: (err: unknown) => {
        this.guardando.set(false);
        this.formError.set(applyProblem(this.form, parseApiError(err)));
        if (this.formError() === null) focusFirstInvalid(this.host.nativeElement);
      },
    });
  }

  protected pedirEliminar(noticia: Noticia, event: Event): void {
    this.trigger = event.currentTarget as HTMLElement;
    this.eliminarError.set(null);
    this.eliminando.set(noticia);
  }

  protected cerrarDialogo(): void {
    if (!this.eliminarBusy()) this.eliminando.set(null);
  }

  protected confirmarEliminar(): void {
    const noticia = this.eliminando();
    if (!noticia || this.eliminarBusy()) return;
    this.eliminarBusy.set(true);
    this.eliminarError.set(null);
    this.service.eliminar(noticia.id).subscribe({
      next: () => {
        this.eliminarBusy.set(false);
        this.eliminando.set(null);
        this.anuncio.set('Noticia eliminada.');
        this.reload.update((n) => n + 1);
        // La fila ya no existirá: el foco pasa al título de la sección.
        this.trigger = null;
        afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('h2')?.focus(), { injector: this.injector });
      },
      error: (err: unknown) => {
        this.eliminarBusy.set(false);
        this.eliminarError.set(problemMessage(parseApiError(err), 'No pudimos eliminar la noticia. Inténtalo de nuevo.'));
      },
    });
  }

  private restoreFocus(): void {
    const target = this.trigger;
    afterNextRender(() => (target?.isConnected ? target : this.host.nativeElement.querySelector<HTMLElement>('h2'))?.focus(), {
      injector: this.injector,
    });
  }
}
