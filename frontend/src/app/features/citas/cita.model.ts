import { EstadoCita } from '../../shared/ui/estado-badge';

export type { EstadoCita };

export interface Cita {
  id: number;
  paciente_id: number;
  profesional_id: number;
  sede_id: number;
  /** ISO 8601 con zona (-05:00) */
  inicio: string;
  fin: string;
  duracion_min: number;
  motivo: string;
  estado: EstadoCita;
  paciente: { id: number; tipo_documento: string; numero_documento: string; nombres: string; apellidos: string };
  profesional: { id: number; nombres: string; apellidos: string; especialidad: { id: number; nombre: string } };
  sede: { id: number; nombre: string; ciudad: string };
}

export interface Hueco {
  inicio: string;
  fin: string;
}

export interface Disponibilidad {
  profesional_id: number;
  fecha: string;
  duracion_min: number;
  huecos: Hueco[];
}

export interface NuevaCita {
  profesional_id: number;
  inicio: string;
  duracion_min: number;
  motivo: string;
}

/** Duración fija de las citas que se piden en línea. */
export const DURACION_CITA_MIN = 30;
