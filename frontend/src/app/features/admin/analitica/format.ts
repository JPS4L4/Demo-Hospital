import { addDays, diaSemana } from '../../../core/dates';
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

const pad = (n: number): string => String(n).padStart(2, '0');

/** Último día (YYYY-MM-DD) del mes `mes` (1-12) de `anio`. */
function ultimoDiaMes(anio: number, mes: number): string {
  return `${anio}-${pad(mes)}-${pad(new Date(Date.UTC(anio, mes, 0)).getUTCDate())}`;
}

/** Primer día (lunes) de la semana ISO `semana` del año ISO `anio`. */
function lunesIso(anio: number, semana: number): string {
  const cuatroEnero = `${anio}-01-04`; // siempre cae en la semana 1
  const desdeLunes = (diaSemana(cuatroEnero) + 6) % 7;
  return addDays(cuatroEnero, -desdeLunes + (semana - 1) * 7);
}

/**
 * Límites calendario (YYYY-MM-DD, inclusivos) del periodo que identifica `valor` en ese nivel:
 * "2026" (año), "2026-T1" (trimestre), "2026-03" (mes), "2026-S10" (semana ISO, lunes a domingo).
 * `null` si la clave no tiene el formato esperado.
 */
export function limitesPeriodo(
  nivel: NivelFecha,
  valor: string,
): { inicio: string; fin: string } | null {
  const [a, resto = ''] = valor.split('-');
  const anio = Number(a);
  if (!Number.isInteger(anio)) return null;
  switch (nivel) {
    case 'anio':
      return { inicio: `${anio}-01-01`, fin: `${anio}-12-31` };
    case 'trimestre': {
      const t = Number(resto.replace(/^T/, ''));
      if (![1, 2, 3, 4].includes(t)) return null;
      const primero = (t - 1) * 3 + 1;
      return { inicio: `${anio}-${pad(primero)}-01`, fin: ultimoDiaMes(anio, primero + 2) };
    }
    case 'mes': {
      const m = Number(resto);
      if (!Number.isInteger(m) || m < 1 || m > 12) return null;
      return { inicio: `${anio}-${pad(m)}-01`, fin: ultimoDiaMes(anio, m) };
    }
    case 'semana': {
      const s = Number(resto.replace(/^S/, ''));
      if (!Number.isInteger(s) || s < 1 || s > 53) return null;
      const inicio = lunesIso(anio, s);
      return { inicio, fin: addDays(inicio, 6) };
    }
  }
}

/**
 * Un periodo es parcial cuando el rango consultado no lo cubre entero: el primero empieza a mitad
 * de periodo o el último aún no ha terminado. Comparar contra eso y no contra el resto de la serie
 * evita tomar por caída real lo que es solo menos días de datos.
 */
export function esPeriodoParcial(
  nivel: NivelFecha,
  valor: string,
  desde: string,
  hasta: string,
): boolean {
  const l = limitesPeriodo(nivel, valor);
  return l !== null && (desde > l.inicio || hasta < l.fin);
}
