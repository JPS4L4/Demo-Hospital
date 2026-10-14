export type Rol = 'paciente' | 'admin';
export type TipoDocumento = 'CC' | 'TI' | 'CE' | 'PA';

export interface PacienteFicha {
  id: number;
  tipo_documento: TipoDocumento;
  numero_documento: string;
  nombres: string;
  apellidos: string;
  /** YYYY-MM-DD */
  fecha_nacimiento: string;
  email: string;
  telefono: string;
  eps: string | null;
}

export interface Usuario {
  id: number;
  email: string;
  rol: Rol;
  activo: boolean;
  paciente: PacienteFicha | null;
}

/** Respuesta de `POST /auth/login` y `POST /auth/registro`. */
export interface SesionResponse {
  access_token: string;
  token_type: 'bearer';
  /** Segundos de vigencia. */
  expires_in: number;
  usuario: Usuario;
}

export interface RegistroPayload extends Omit<PacienteFicha, 'id' | 'eps'> {
  eps?: string | null;
  password: string;
}
