import { HttpErrorResponse } from '@angular/common/http';
import { AbstractControl, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';

/** Texto obligatorio que no sea solo espacios (la API recorta los espacios y exige al menos un carácter). */
export const requiredText: ValidatorFn = (control) =>
  typeof control.value === 'string' && control.value.trim() === '' ? { required: true } : null;

/** Mismas reglas que la API para el teléfono: 7–15 dígitos, `+` inicial opcional; admite espacios y guiones. */
export const telefonoValido: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return /^\+?\d{7,15}$/.test(value.replace(/[\s\-().]/g, ''))
    ? null
    : { message: 'Escribe un teléfono de 7 a 15 dígitos, por ejemplo 300 123 4567.' };
};

/** Documento: 4–30 letras o dígitos, sin espacios ni tildes (la API lo pasa a mayúsculas). */
export const documentoValido: ValidatorFn = (control) => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  return /^[A-Za-z0-9]{4,30}$/.test(value)
    ? null
    : { message: 'Usa entre 4 y 30 letras o dígitos, sin espacios.' };
};

/** Fecha de nacimiento (YYYY-MM-DD) anterior a hoy y desde 1900. */
export function nacimientoValido(today: () => string): ValidatorFn {
  return (control): ValidationErrors | null => {
    const value = String(control.value ?? '');
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1900) {
      return { message: 'Escribe una fecha de nacimiento válida.' };
    }
    return value >= today() ? { message: 'La fecha de nacimiento debe ser anterior a hoy.' } : null;
  };
}

/** Mensaje de error para mostrar bajo un campo; `null` mientras el usuario no lo haya tocado. */
export function errorMessage(control: AbstractControl | null): string | null {
  if (!control || !control.errors || !(control.touched || control.dirty)) return null;
  const e = control.errors;
  if (typeof e['server'] === 'string') return e['server'];
  if (typeof e['message'] === 'string') return e['message'];
  if (e['required']) return 'Este campo es obligatorio.';
  if (e['email']) return 'Escribe un correo válido, por ejemplo nombre@correo.com.';
  if (e['minlength']) return `Usa al menos ${e['minlength'].requiredLength} caracteres.`;
  if (e['maxlength']) return `Usa como máximo ${e['maxlength'].requiredLength} caracteres.`;
  return 'Revisa este campo.';
}

export interface ApiProblem {
  status: number;
  /** Mensaje general (`{detail: "..."}`) o `null` si el error es por campos. */
  detail: string | null;
  /** Errores de validación 422 por nombre de campo. */
  fields: Record<string, string>;
}

/** Normaliza un error HTTP de la API (`{detail}` texto o lista de FastAPI) a un formato manejable. */
export function parseApiError(err: unknown): ApiProblem {
  if (!(err instanceof HttpErrorResponse)) return { status: 0, detail: null, fields: {} };
  const body = err.error as { detail?: unknown } | null;
  const detail = body?.detail;
  if (typeof detail === 'string') return { status: err.status, detail, fields: {} };

  const fields: Record<string, string> = {};
  if (Array.isArray(detail)) {
    for (const item of detail as { loc?: unknown[]; msg?: string }[]) {
      const field = String(item.loc?.[item.loc.length - 1] ?? '');
      const msg = item.msg ?? '';
      // Los validadores propios de la API traen su texto en español tras "Value error, ".
      const clean = msg.replace(/^Value error, /, '');
      fields[field] =
        clean !== msg || /[áéíóúñ]|^(El|La|Los|Las|Ya) /.test(clean) ? clean : 'Revisa este campo.';
    }
  }
  return { status: err.status, detail: null, fields };
}

/** Texto general para mostrar cuando un error no se asigna a un campo. */
export function problemMessage(
  problem: ApiProblem,
  fallback = 'Algo salió mal. Inténtalo de nuevo.',
): string {
  if (problem.status === 0)
    return 'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  return problem.detail ?? fallback;
}

/**
 * Pone los errores del servidor en sus controles. Devuelve el mensaje que no se pudo asignar a un
 * campo (para mostrarlo como alerta del formulario) o `null` si todo quedó en su campo.
 */
export function applyProblem(
  form: FormGroup,
  problem: ApiProblem,
  fieldFor: (detail: string) => string | null = () => null,
): string | null {
  const unmatched: string[] = [];
  for (const [name, message] of Object.entries(problem.fields)) {
    const control = form.get(name);
    if (control) {
      control.setErrors({ server: message });
      control.markAsTouched();
    } else unmatched.push(message);
  }
  if (problem.detail !== null) {
    const name = fieldFor(problem.detail);
    const control = name ? form.get(name) : null;
    if (control) {
      control.setErrors({ server: problem.detail });
      control.markAsTouched();
    } else unmatched.push(problem.detail);
  }
  const nothingToShow = problem.detail === null && Object.keys(problem.fields).length === 0;
  if (problem.status === 0 || nothingToShow) return problemMessage(problem);
  return unmatched.length ? unmatched.join(' ') : null;
}

/** Lleva el foco al primer campo inválido (los campos marcan `aria-invalid="true"`). */
export function focusFirstInvalid(root: HTMLElement): void {
  root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
