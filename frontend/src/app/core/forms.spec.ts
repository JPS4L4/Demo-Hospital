import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup } from '@angular/forms';
import { applyProblem, documentoValido, errorMessage, nacimientoValido, parseApiError, requiredText, telefonoValido } from './forms';

const http = (status: number, error: unknown) => new HttpErrorResponse({ status, error });

describe('validators', () => {
  it('requiredText rejects blank strings', () => {
    expect(requiredText(new FormControl('   '))).toEqual({ required: true });
    expect(requiredText(new FormControl('a'))).toBeNull();
  });

  it('telefonoValido accepts formatted numbers and rejects short ones', () => {
    expect(telefonoValido(new FormControl('+57 300-123 4567'))).toBeNull();
    expect(telefonoValido(new FormControl('(601) 555 0100'))).toBeNull();
    expect(telefonoValido(new FormControl('12345'))).not.toBeNull();
    expect(telefonoValido(new FormControl(''))).toBeNull();
  });

  it('documentoValido wants 4-30 letters or digits', () => {
    expect(documentoValido(new FormControl('AB12'))).toBeNull();
    expect(documentoValido(new FormControl('abc'))).not.toBeNull();
    expect(documentoValido(new FormControl('12 34'))).not.toBeNull();
    expect(documentoValido(new FormControl('Ñ1234'))).not.toBeNull();
  });

  it('nacimientoValido wants a past date from 1900', () => {
    const validator = nacimientoValido(() => '2026-10-14');
    expect(validator(new FormControl('2026-10-13'))).toBeNull();
    expect(validator(new FormControl('2026-10-14'))).not.toBeNull();
    expect(validator(new FormControl('1899-12-31'))).not.toBeNull();
  });
});

describe('errorMessage', () => {
  it('stays quiet until the control is touched', () => {
    const control = new FormControl('', { validators: requiredText });
    control.setErrors({ required: true });
    expect(errorMessage(control)).toBeNull();
    control.markAsTouched();
    expect(errorMessage(control)).toBe('Este campo es obligatorio.');
  });
});

describe('parseApiError / applyProblem', () => {
  it('reads a string detail', () => {
    expect(parseApiError(http(409, { detail: 'Ya existe' }))).toEqual({ status: 409, detail: 'Ya existe', fields: {} });
  });

  it('reads FastAPI validation lists, keeping Spanish messages and generic-izing English ones', () => {
    const problem = parseApiError(
      http(422, {
        detail: [
          { loc: ['body', 'email'], msg: 'Value error, El correo no es válido' },
          { loc: ['body', 'password'], msg: 'String should have at least 8 characters' },
        ],
      }),
    );
    expect(problem.fields).toEqual({ email: 'El correo no es válido', password: 'Revisa este campo.' });
  });

  it('puts field errors on their controls and returns the rest as a form message', () => {
    const form = new FormGroup({ email: new FormControl(''), nombres: new FormControl('') });
    const message = applyProblem(form, {
      status: 422,
      detail: null,
      fields: { email: 'Correo inválido', otro: 'Algo más' },
    });
    expect(form.controls.email.errors).toEqual({ server: 'Correo inválido' });
    expect(message).toBe('Algo más');
  });

  it('clears the server error once the user edits the field', () => {
    const form = new FormGroup({ email: new FormControl('') });
    applyProblem(form, { status: 409, detail: 'Ya existe una cuenta con ese correo', fields: {} }, () => 'email');
    expect(form.controls.email.errors).toEqual({ server: 'Ya existe una cuenta con ese correo' });
    form.controls.email.setValue('otro@correo.co');
    expect(form.controls.email.errors).toBeNull();
  });

  it('reports connectivity failures as a form message', () => {
    const form = new FormGroup({});
    expect(applyProblem(form, parseApiError(new HttpErrorResponse({ status: 0 })))).toContain('No pudimos conectar');
  });
});
