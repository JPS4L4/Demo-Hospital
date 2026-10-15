import { esPeriodoParcial, limitesPeriodo } from './format';

describe('limitesPeriodo', () => {
  it('returns the calendar bounds of a year, quarter and month', () => {
    expect(limitesPeriodo('anio', '2026')).toEqual({ inicio: '2026-01-01', fin: '2026-12-31' });
    expect(limitesPeriodo('trimestre', '2026-T3')).toEqual({
      inicio: '2026-07-01',
      fin: '2026-09-30',
    });
    expect(limitesPeriodo('mes', '2026-02')).toEqual({ inicio: '2026-02-01', fin: '2026-02-28' });
    expect(limitesPeriodo('mes', '2028-02')).toEqual({ inicio: '2028-02-01', fin: '2028-02-29' });
  });

  it('returns Monday to Sunday for ISO weeks, including the year boundaries', () => {
    expect(limitesPeriodo('semana', '2026-S10')).toEqual({
      inicio: '2026-03-02',
      fin: '2026-03-08',
    });
    // La semana 1 de 2026 empieza el lunes 29 de diciembre de 2025.
    expect(limitesPeriodo('semana', '2026-S01')).toEqual({
      inicio: '2025-12-29',
      fin: '2026-01-04',
    });
    // 2020 tiene 53 semanas ISO; la última termina ya en 2021.
    expect(limitesPeriodo('semana', '2020-S53')).toEqual({
      inicio: '2020-12-28',
      fin: '2021-01-03',
    });
  });

  it('returns null for keys it does not understand', () => {
    expect(limitesPeriodo('mes', '2026-13')).toBeNull();
    expect(limitesPeriodo('trimestre', '2026-T5')).toBeNull();
    expect(limitesPeriodo('semana', 'x-S1')).toBeNull();
  });
});

describe('esPeriodoParcial', () => {
  const desde = '2025-10-15';
  const hasta = '2026-10-15';

  it('marks the month where the range starts mid-month and the month still in progress', () => {
    expect(esPeriodoParcial('mes', '2025-10', desde, hasta)).toBe(true);
    expect(esPeriodoParcial('mes', '2025-11', desde, hasta)).toBe(false);
    expect(esPeriodoParcial('mes', '2026-09', desde, hasta)).toBe(false);
    expect(esPeriodoParcial('mes', '2026-10', desde, hasta)).toBe(true);
  });

  it('treats a range that exactly covers the period as complete', () => {
    expect(esPeriodoParcial('mes', '2026-03', '2026-03-01', '2026-03-31')).toBe(false);
    expect(esPeriodoParcial('mes', '2026-03', '2026-03-02', '2026-03-31')).toBe(true);
    expect(esPeriodoParcial('mes', '2026-03', '2026-03-01', '2026-03-30')).toBe(true);
  });

  it('applies the same rule at year, quarter and week level', () => {
    expect(esPeriodoParcial('anio', '2025', desde, hasta)).toBe(true);
    expect(esPeriodoParcial('anio', '2026', desde, hasta)).toBe(true);
    expect(esPeriodoParcial('trimestre', '2025-T4', desde, hasta)).toBe(true);
    expect(esPeriodoParcial('trimestre', '2026-T1', desde, hasta)).toBe(false);
    expect(esPeriodoParcial('trimestre', '2026-T4', desde, hasta)).toBe(true);
    // 15 oct 2025 es miércoles: la semana 42 empezó el lunes 13.
    expect(esPeriodoParcial('semana', '2025-S42', desde, hasta)).toBe(true);
    expect(esPeriodoParcial('semana', '2025-S43', desde, hasta)).toBe(false);
    // 15 oct 2026 es jueves: la semana 42 acaba el domingo 18.
    expect(esPeriodoParcial('semana', '2026-S42', desde, hasta)).toBe(true);
    expect(esPeriodoParcial('semana', '2026-S41', desde, hasta)).toBe(false);
  });

  it('never flags a key it cannot parse', () => {
    expect(esPeriodoParcial('mes', 'raro', '2026-01-01', '2026-02-01')).toBe(false);
  });
});
