/** Fechas de la agenda: la clínica trabaja en hora de Bogotá (UTC-5, sin horario de verano). */
export const TZ = 'America/Bogota';
const LOCALE = 'es-CO';

const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

function parts(value: Date | string): Record<string, string> {
  const date = typeof value === 'string' ? new Date(value) : value;
  return Object.fromEntries(partsFormat.formatToParts(date).map((p) => [p.type, p.value]));
}

/** YYYY-MM-DD de hoy en Bogotá. */
export function hoyBogota(now: Date = new Date()): string {
  return fechaBogota(now);
}

/** YYYY-MM-DD de un instante, en Bogotá. */
export function fechaBogota(value: Date | string): string {
  const p = parts(value);
  return `${p['year']}-${p['month']}-${p['day']}`;
}

/** HH:mm (24 h) de un instante, en Bogotá. */
export function horaBogota(value: Date | string): string {
  const p = parts(value);
  return `${p['hour']}:${p['minute']}`;
}

/** Suma días a una fecha YYYY-MM-DD. */
export function addDays(fecha: string, days: number): string {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Día de la semana de una fecha YYYY-MM-DD (0 = domingo). */
export function diaSemana(fecha: string): number {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay();
}

/** Instante ISO con la zona de Bogotá a partir de fecha y hora locales. */
export function inicioIso(fecha: string, hora: string): string {
  return `${fecha}T${hora}:00-05:00`;
}

function atNoon(fecha: string): Date {
  return new Date(`${fecha}T12:00:00-05:00`);
}

/** "jueves, 15 de octubre de 2026" (acepta YYYY-MM-DD o un instante ISO). */
export function formatFechaLarga(value: string): string {
  const date = value.length === 10 ? atNoon(value) : new Date(value);
  return new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, dateStyle: 'full' }).format(date);
}

/** "15 oct 2026" */
export function formatFechaCorta(value: string): string {
  const date = value.length === 10 ? atNoon(value) : new Date(value);
  const p = Object.fromEntries(
    new Intl.DateTimeFormat(LOCALE, {
      timeZone: TZ,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${p['day']} ${p['month'].replace(/\./g, '')} ${p['year']}`;
}

/** "9:00 a. m." */
export function formatHora(value: string): string {
  return new Intl.DateTimeFormat(LOCALE, {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(value));
}

/** Etiquetas de un día para el selector: { semana: 'jue', dia: '15', mes: 'oct' }. */
export function etiquetaDia(fecha: string): { semana: string; dia: string; mes: string } {
  const d = atNoon(fecha);
  const f = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, ...options }).format(d).replace(/\./g, '');
  return {
    semana: f({ weekday: 'short' }),
    dia: f({ day: 'numeric' }),
    mes: f({ month: 'short' }),
  };
}
