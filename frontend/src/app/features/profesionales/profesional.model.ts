export interface Profesional {
  id: number;
  nombres: string;
  apellidos: string;
  especialidad_id: number;
  sede_id: number;
  registro_profesional: string;
  email: string;
  telefono: string | null;
  bio: string;
  activo: boolean;
  especialidad: { id: number; nombre: string };
  sede: { id: number; nombre: string; ciudad: string };
}

/** Cuerpo de `POST/PUT /profesionales`. */
export type ProfesionalInput = Pick<
  Profesional,
  'nombres' | 'apellidos' | 'especialidad_id' | 'sede_id' | 'registro_profesional' | 'email' | 'telefono' | 'activo'
> & { bio: string | null };

export function nombreCompleto(p: Pick<Profesional, 'nombres' | 'apellidos'>): string {
  return `${p.nombres} ${p.apellidos}`.trim();
}

/** Primera letra del nombre y del primer apellido, para el avatar. */
export function iniciales(p: Pick<Profesional, 'nombres' | 'apellidos'>): string {
  const first = (text: string) => text.trim().charAt(0).toLocaleUpperCase('es-CO');
  return first(p.nombres) + first(p.apellidos);
}
