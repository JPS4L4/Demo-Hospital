import { PacienteFicha, SesionResponse, Usuario } from './auth.model';

export const API = 'http://localhost:8000';

export const pacienteFicha: PacienteFicha = {
  id: 7,
  tipo_documento: 'CC',
  numero_documento: '1020304050',
  nombres: 'Paula',
  apellidos: 'Herrera',
  fecha_nacimiento: '1990-05-17',
  email: 'paula.herrera@example.com',
  telefono: '+573001234567',
  eps: null,
};

export const usuarioPaciente: Usuario = {
  id: 2,
  email: 'paula.herrera@example.com',
  rol: 'paciente',
  activo: true,
  paciente: pacienteFicha,
};

export const usuarioAdmin: Usuario = {
  id: 1,
  email: 'admin@meridiana.example',
  rol: 'admin',
  activo: true,
  paciente: null,
};

export function sesion(usuario: Usuario, token = 'tok-123'): SesionResponse {
  return { access_token: token, token_type: 'bearer', expires_in: 3600, usuario };
}

export const STORAGE_KEY = 'meridiana.sesion';
