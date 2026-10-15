export interface Resumen {
  total: number;
  atendidas: number;
  canceladas: number;
  programadas: number;
  /** Fracción 0-1; `null` si no hay citas en el periodo. */
  tasa_cancelacion: number | null;
  duracion_media_min: number | null;
  pacientes_distintos: number;
}

export type Medida = 'total' | 'canceladas' | 'atendidas' | 'tasa_cancelacion' | 'duracion_media';

export type NivelFecha = 'anio' | 'trimestre' | 'mes' | 'semana';

export interface FilaAnalitica {
  /** Valor por dimensión pedida, p. ej. `{ 'fecha.mes': '2026-03' }`. */
  dimensiones: Record<string, string | number>;
  valor: number | null;
}

export interface ConsultaAnalitica {
  medida: Medida;
  agrupar: string[];
  filas: FilaAnalitica[];
}

export interface EstadoAnalitica {
  refrescado_en: string | null;
  citas_oltp: number;
  citas_analitica: number;
  actualizada: boolean;
}

export interface FiltrosAnalitica {
  /** YYYY-MM-DD, inclusivo, hora de Bogotá. */
  desde: string;
  hasta: string;
  sedeId: number | null;
  especialidadId: number | null;
}
