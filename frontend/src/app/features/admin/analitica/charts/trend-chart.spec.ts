import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrendChart, escalaY, trazo } from './trend-chart';

describe('escalaY', () => {
  it('rounds the top to a clean step with four divisions', () => {
    expect(escalaY(0).tope).toBe(4);
    expect(escalaY(87).marcas).toEqual([0, 25, 50, 75, 100]);
    expect(escalaY(412).tope).toBe(600);
  });
});

describe('trazo', () => {
  const p = (x: number, parcial = false) => ({ x, y: 10, parcial });

  it('joins complete segments and leaves out those touching an incomplete period', () => {
    const puntos = [p(0, true), p(10), p(20), p(30, true)];
    expect(trazo(puntos, false)).toBe('M10.0 10.0 L20.0 10.0');
    expect(trazo(puntos, true)).toBe('M0.0 10.0 L10.0 10.0 M20.0 10.0 L30.0 10.0');
  });

  it('is empty when nothing applies', () => {
    expect(trazo([p(0), p(10)], true)).toBe('');
    expect(trazo([p(0, true)], false)).toBe('');
  });
});

describe('TrendChart', () => {
  let fixture: ComponentFixture<TrendChart>;
  let el: HTMLElement;

  const puntos = [
    { corta: 'ene 26', larga: 'enero de 2026' },
    { corta: 'feb 26', larga: 'febrero de 2026' },
    { corta: 'mar 26', larga: 'marzo de 2026' },
  ];

  beforeEach(() => {
    fixture = TestBed.createComponent(TrendChart);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('nombre', 'Citas por mes');
    fixture.componentRef.setInput('puntos', puntos);
    fixture.componentRef.setInput('series', [
      { nombre: 'Citas', valores: [100, 120, 90], tono: 'brand' },
      { nombre: 'Canceladas', valores: [12, 15, 10], tono: 'accent', discontinua: true },
    ]);
    fixture.detectChanges();
  });

  it('draws one line and one marker per point for each series, the second one dashed', () => {
    const paths = el.querySelectorAll('svg path.line');
    expect(paths.length).toBe(2);
    expect(paths[0].hasAttribute('stroke-dasharray')).toBe(false);
    expect(paths[1].getAttribute('stroke-dasharray')).toBeTruthy();
    expect(el.querySelectorAll('svg circle').length).toBe(6);
    expect(Array.from(el.querySelectorAll('.legend li')).map((l) => l.textContent?.trim())).toEqual(
      ['Citas', 'Canceladas'],
    );
  });

  it('offers every value in a table as well', () => {
    const rows = Array.from(el.querySelectorAll('tbody tr')).map((r) =>
      Array.from(r.children).map((c) => c.textContent?.trim()),
    );
    expect(rows).toEqual([
      ['enero de 2026', '100', '12'],
      ['febrero de 2026', '120', '15'],
      ['marzo de 2026', '90', '10'],
    ]);
  });

  it('shows the detail of a period with the keyboard', () => {
    const svg = el.querySelector('svg[role="group"]') as SVGElement;
    expect(el.querySelector('.tip')).toBeNull();

    svg.dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(el.querySelector('.tip')?.textContent).toContain('marzo de 2026');

    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    fixture.detectChanges();
    const tip = el.querySelector('.tip')?.textContent ?? '';
    expect(tip).toContain('febrero de 2026');
    expect(tip).toContain('Citas: 120');
    expect(tip).toContain('Canceladas: 15');

    svg.dispatchEvent(new Event('blur'));
    fixture.detectChanges();
    expect(el.querySelector('.tip')).toBeNull();
  });

  it('copes with a single period', () => {
    fixture.componentRef.setInput('puntos', [puntos[0]]);
    fixture.componentRef.setInput('series', [{ nombre: 'Citas', valores: [100], tono: 'brand' }]);
    fixture.detectChanges();
    expect(el.querySelectorAll('svg circle').length).toBe(1);
  });

  it('adds no incomplete-period marks when every period is complete', () => {
    expect(el.querySelector('svg circle.hueco')).toBeNull();
    expect(el.querySelector('svg rect.banda')).toBeNull();
    expect(el.querySelector('.legend')?.textContent).not.toContain('incompleto');
  });

  describe('with incomplete periods', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('puntos', [
        { ...puntos[0], parcial: true },
        puntos[1],
        { ...puntos[2], parcial: true },
      ]);
      fixture.detectChanges();
    });

    it('draws hollow markers, dotted segments, a band and a legend entry for them', () => {
      // Dos series x dos periodos incompletos, más el de la leyenda.
      expect(el.querySelectorAll('svg circle.hueco').length).toBe(5);
      expect(el.querySelectorAll('svg rect.banda').length).toBe(2);
      expect(el.querySelectorAll('svg path.line.parcial').length).toBe(2);
      expect(el.querySelector('.legend')?.textContent).toContain('Periodo incompleto');
    });

    it('says so in the tooltip, the live region and the table', () => {
      const svg = el.querySelector('svg[role="group"]') as SVGElement;
      svg.dispatchEvent(new Event('focus'));
      fixture.detectChanges();
      expect(el.querySelector('.tip')?.textContent).toContain('Periodo incompleto');
      expect(el.querySelector('p[role="status"]')?.textContent).toContain('Periodo incompleto');

      svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
      fixture.detectChanges();
      expect(el.querySelector('.tip')?.textContent).not.toContain('Periodo incompleto');

      const filas = Array.from(el.querySelectorAll('tbody th')).map((c) =>
        c.textContent?.replace(/\s+/g, ' ').trim(),
      );
      expect(filas).toEqual([
        'enero de 2026 (periodo incompleto)',
        'febrero de 2026',
        'marzo de 2026 (periodo incompleto)',
      ]);
    });
  });
});
