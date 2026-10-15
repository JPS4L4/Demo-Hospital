import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TipoDocumento } from '../../../core/auth/auth.model';
import { AuthService, safeReturnUrl } from '../../../core/auth/auth.service';
import { addDays, hoyBogota } from '../../../core/dates';
import {
  applyProblem,
  documentoValido,
  focusFirstInvalid,
  nacimientoValido,
  parseApiError,
  requiredText,
  telefonoValido,
} from '../../../core/forms';
import { Field } from '../../../shared/ui/field';
import { Icon } from '../../../shared/ui/icon';
import { PageHeader } from '../../../shared/ui/page-header';
import { PasswordField } from '../../../shared/ui/password-field';

@Component({
  selector: 'app-registro',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon, PageHeader, PasswordField],
  templateUrl: './registro.html',
})
export class Registro {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Query param `?returnUrl=` (withComponentInputBinding). */
  readonly returnUrl = input<string>();

  protected readonly tiposDocumento: { value: TipoDocumento; label: string }[] = [
    { value: 'CC', label: 'Cédula de ciudadanía' },
    { value: 'TI', label: 'Tarjeta de identidad' },
    { value: 'CE', label: 'Cédula de extranjería' },
    { value: 'PA', label: 'Pasaporte' },
  ];
  /** Último día válido para nacer: ayer (la API exige una fecha anterior a hoy). */
  protected readonly maxNacimiento = addDays(hoyBogota(), -1);

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    tipo_documento: ['CC' as TipoDocumento, [Validators.required]],
    numero_documento: ['', [Validators.required, documentoValido]],
    nombres: ['', [requiredText, Validators.required, Validators.maxLength(120)]],
    apellidos: ['', [requiredText, Validators.required, Validators.maxLength(120)]],
    fecha_nacimiento: ['', [Validators.required, nacimientoValido(hoyBogota)]],
    telefono: ['', [Validators.required, telefonoValido]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
    eps: ['', [Validators.maxLength(120)]],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
  });

  protected submit(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const v = this.form.getRawValue();
    this.submitting.set(true);
    this.auth
      .registro({
        tipo_documento: v.tipo_documento,
        numero_documento: v.numero_documento.trim(),
        nombres: v.nombres.trim(),
        apellidos: v.apellidos.trim(),
        fecha_nacimiento: v.fecha_nacimiento,
        telefono: v.telefono.trim(),
        email: v.email.trim(),
        eps: v.eps.trim() || null,
        password: v.password,
      })
      .subscribe({
        next: () => void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()) ?? '/mis-citas'),
        error: (err: unknown) => {
          this.submitting.set(false);
          // 409: la API explica qué dato está repetido; se asigna a su campo.
          const message = applyProblem(this.form, parseApiError(err), (detail) =>
            /documento/i.test(detail)
              ? 'numero_documento'
              : /correo/i.test(detail)
                ? 'email'
                : null,
          );
          this.formError.set(message);
          if (message === null) focusFirstInvalid(this.host.nativeElement);
        },
      });
  }
}
