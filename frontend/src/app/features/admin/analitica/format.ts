import { NivelFecha } from './analitica.model';

const LOCALE = 'es-CO';
const entero = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 });
const porcentaje = new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 1 });

export type FormatoValor = 'entero' | 'porcentaje' | 'minutos';

export function formatear(valor: number, formato: FormatoValor): string {
  switch (formato) {
    case 'porcentaje':
      return porcentaje.format(valor).replace(/\s/g, ' ');
    case 'minutos':
      return `${entero.format(valor)} min`;
    default:
      return entero.format(valor);
  }
}

const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

export const DIAS_SEMANA = [
  'lunes',
  'martes',
  'miércoles',
  'jueves',
  'viernes',
  'sábado',
  'domingo',
];

/** Etiqueta breve de un periodo para el eje: "mar 26", "T1 26", "S10". */
export function periodoCorto(nivel: NivelFecha, valor: string): string {
  const [anio, resto = ''] = valor.split('-');
  const aa = anio.slice(-2);
  switch (nivel) {
    case 'mes':
      return `${MESES[Number(resto) - 1]?.slice(0, 3) ?? resto} ${aa}`;
    case 'trimestre':
      return `${resto} ${aa}`;
    case 'semana':
      return resto;
    default:
      return anio;
  }
}

/** Etiqueta completa de un periodo para tooltips y tablas: "marzo de 2026", "T1 de 2026". */
export function periodoLargo(nivel: NivelFecha, valor: string): string {
  const [anio, resto = ''] = valor.split('-');
  switch (nivel) {
    case 'mes':
      return `${MESES[Number(resto) - 1] ?? resto} de ${anio}`;
    case 'trimestre':
      return `${resto} de ${anio}`;
    case 'semana':
      return `Semana ${resto.replace(/^S/, '')} de ${anio}`;
    default:
      return anio;
  }
}
