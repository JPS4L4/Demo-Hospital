import { InjectionToken } from '@angular/core';
import { environment } from '../../environments/environment';

/** URL base de la API, sin barra final. Se puede sobrescribir en los tests o en app.config. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl.replace(/\/+$/, ''),
});
