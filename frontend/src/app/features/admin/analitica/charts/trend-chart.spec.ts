import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TrendChart, escalaY } from './trend-chart';

describe('escalaY', () => {
  it('rounds the top to a clean step with four divisions', () => {
    expect(escalaY(0).tope).toBe(4);
    expect(escalaY(87).marcas).toEqual([0, 25, 50, 75, 100]);
    expect(escalaY(412).tope).toBe(600);
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
});
