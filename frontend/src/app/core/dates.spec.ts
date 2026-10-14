import { addDays, diaSemana, etiquetaDia, fechaBogota, formatFechaCorta, formatFechaLarga, formatHora, horaBogota, hoyBogota, inicioIso } from './dates';

describe('dates (America/Bogota)', () => {
  it('reads the local day and hour of an instant, not the UTC one', () => {
    // 02:30 UTC del 15 es todavía las 21:30 del 14 en Bogotá.
    expect(fechaBogota('2026-10-15T02:30:00Z')).toBe('2026-10-14');
    expect(horaBogota('2026-10-15T02:30:00Z')).toBe('21:30');
    expect(hoyBogota(new Date('2026-10-15T02:30:00Z'))).toBe('2026-10-14');
  });

  it('adds days across month ends and finds Sundays', () => {
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
    expect(addDays('2026-10-14', -14)).toBe('2026-09-30');
    expect(diaSemana('2026-10-18')).toBe(0);
    expect(diaSemana('2026-10-14')).toBe(3);
  });

  it('builds an instant with the Bogota offset', () => {
    expect(inicioIso('2026-10-15', '09:30')).toBe('2026-10-15T09:30:00-05:00');
  });

  it('formats in Spanish (Colombia)', () => {
    expect(formatFechaLarga('2026-10-15')).toBe('jueves, 15 de octubre de 2026');
    expect(formatHora('2026-10-15T09:00:00-05:00').replace(/\s/g, ' ')).toMatch(/^9:00 a\. ?m\.$/);
    expect(formatFechaCorta('2026-10-01')).toBe('1 oct 2026');
    expect(etiquetaDia('2026-10-15')).toEqual({ semana: 'jue', dia: '15', mes: 'oct' });
  });
});
