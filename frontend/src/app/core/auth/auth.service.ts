import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, firstValueFrom, map, tap } from 'rxjs';
import { API_BASE_URL } from '../api';
import { RegistroPayload, SesionResponse, Usuario } from './auth.model';

const STORAGE_KEY = 'meridiana.sesion';

interface StoredSession {
  token: string;
  /** Instante (ms desde epoch) en que el token deja de ser válido. */
  expiresAt: number;
}

/** Rutas que exigen sesión: un 401 en ellas devuelve al usuario a `/ingresar`. */
const PROTECTED_PREFIXES = ['/mis-citas', '/admin'];

export function isProtectedUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return PROTECTED_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix + '/'));
}

/** Acepta solo rutas internas (evita redirecciones abiertas) y nunca las propias de acceso. */
export function safeReturnUrl(raw: string | null | undefined): string | null {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null;
  const path = raw.split(/[?#]/)[0];
  return path === '/ingresar' || path === '/registro' ? null : raw;
}

/**
 * Sesión del usuario: token y usuario como señales. El token se guarda en localStorage con su
 * vencimiento y se valida contra `/auth/me` al arrancar; el usuario nunca se persiste.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${inject(API_BASE_URL)}/auth`;

  private readonly tokenState = signal<string | null>(null);
  private readonly usuarioState = signal<Usuario | null>(null);
  private restored?: Promise<void>;

  readonly token = this.tokenState.asReadonly();
  readonly usuario = this.usuarioState.asReadonly();
  /** `true` mientras se valida un token guardado; la cabecera evita parpadear entre "Ingresar" y el menú. */
  readonly restoring = signal(false);

  readonly isAdmin = computed(() => this.usuarioState()?.rol === 'admin');
  readonly isPaciente = computed(() => this.usuarioState()?.rol === 'paciente');
  readonly nombre = computed(() => {
    const u = this.usuarioState();
    if (!u) return '';
    return u.paciente ? `${u.paciente.nombres} ${u.paciente.apellidos}`.trim() : 'Administración';
  });
  readonly iniciales = computed(() => {
    const u = this.usuarioState();
    if (!u) return '';
    const first = (text: string) => text.trim().charAt(0).toLocaleUpperCase('es-CO');
    return u.paciente ? first(u.paciente.nombres) + first(u.paciente.apellidos) : 'AD';
  });

  /** Resuelve cuando se sabe si hay sesión válida; los guards la esperan antes de decidir. */
  whenReady(): Promise<void> {
    return (this.restored ??= this.restore());
  }

  login(email: string, password: string): Observable<Usuario> {
    return this.http
      .post<SesionResponse>(`${this.baseUrl}/login`, { email, password })
      .pipe(this.openSession());
  }

  registro(datos: RegistroPayload): Observable<Usuario> {
    return this.http.post<SesionResponse>(`${this.baseUrl}/registro`, datos).pipe(this.openSession());
  }

  logout(): void {
    this.clear();
  }

  /** Olvida token y usuario (cierre de sesión, token vencido o rechazado con 401). */
  clear(): void {
    this.tokenState.set(null);
    this.usuarioState.set(null);
    this.writeStorage(null);
  }

  private openSession() {
    return (source: Observable<SesionResponse>): Observable<Usuario> =>
      source.pipe(
        tap((res) => {
          this.restored ??= Promise.resolve();
          this.tokenState.set(res.access_token);
          this.usuarioState.set(res.usuario);
          this.writeStorage({ token: res.access_token, expiresAt: Date.now() + res.expires_in * 1000 });
        }),
        map((res) => res.usuario),
      );
  }

  private async restore(): Promise<void> {
    const stored = this.readStorage();
    if (!stored) return;
    this.tokenState.set(stored.token);
    this.restoring.set(true);
    try {
      this.usuarioState.set(await firstValueFrom(this.http.get<Usuario>(`${this.baseUrl}/me`)));
    } catch (err) {
      // 401: el interceptor ya limpió la sesión. Otro fallo (API caída): se conserva el token guardado
      // para el próximo arranque, pero esta sesión queda sin usuario.
      if (!(err instanceof HttpErrorResponse && err.status === 401)) this.tokenState.set(null);
    } finally {
      this.restoring.set(false);
    }
  }

  private readStorage(): StoredSession | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Partial<StoredSession>;
      if (typeof parsed.token === 'string' && typeof parsed.expiresAt === 'number' && parsed.expiresAt > Date.now()) {
        return { token: parsed.token, expiresAt: parsed.expiresAt };
      }
    } catch {
      // JSON corrupto o almacenamiento no disponible: se trata como sin sesión.
    }
    this.writeStorage(null);
    return null;
  }

  private writeStorage(session: StoredSession | null): void {
    try {
      if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Sin almacenamiento: la sesión dura lo que dure la pestaña.
    }
  }
}
