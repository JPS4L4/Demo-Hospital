import { Component, ElementRef, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, safeReturnUrl } from '../../../core/auth/auth.service';
import { focusFirstInvalid, parseApiError, problemMessage } from '../../../core/forms';
import { Field } from '../../../shared/ui/field';
import { Icon } from '../../../shared/ui/icon';
import { PageHeader } from '../../../shared/ui/page-header';
import { PasswordField } from '../../../shared/ui/password-field';
import { DEMO_ACCOUNTS, DemoAccount } from '../demo-accounts';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, Field, Icon, PageHeader, PasswordField],
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  /** Query params `?returnUrl=&sesion=` (withComponentInputBinding). */
  readonly returnUrl = input<string>();
  readonly sesion = input<string>();

  protected readonly demoAccounts = DEMO_ACCOUNTS;
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  protected submit(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      focusFirstInvalid(this.host.nativeElement);
      return;
    }
    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.auth.login(email.trim(), password).subscribe({
      next: (usuario) => {
        const destino = safeReturnUrl(this.returnUrl()) ?? (usuario.rol === 'admin' ? '/admin' : '/mis-citas');
        void this.router.navigateByUrl(destino);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.formError.set(problemMessage(parseApiError(err), 'No pudimos iniciar sesión. Inténtalo de nuevo.'));
      },
    });
  }

  protected useDemo(account: DemoAccount): void {
    this.form.setValue({ email: account.email, password: account.password });
    this.formError.set(null);
  }
}
