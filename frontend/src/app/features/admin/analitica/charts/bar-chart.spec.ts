import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BarChart } from './bar-chart';

describe('BarChart', () => {
  let fixture: ComponentFixture<BarChart>;

  beforeEach(() => {
    fixture = TestBed.createComponent(BarChart);
    fixture.componentRef.setInput('nombre', 'Citas por especialidad');
  });

  const rows = () =>
    Array.from((fixture.nativeElement as HTMLElement).querySelectorAll('li')).map((li) => ({
      label: li.querySelector('.bar-label')?.textContent?.trim(),
      value: li.querySelector('.bar-value')?.textContent?.trim(),
      width: (li.querySelector('.bar-fill') as HTMLElement).style.width,
    }));

  it('draws one labelled bar per datum, scaled to the largest from zero', () => {
    fixture.componentRef.setInput('datos', [
      { etiqueta: 'Cardiología', valor: 400 },
      { etiqueta: 'Pediatría', valor: 100 },
    ]);
    fixture.detectChanges();
    expect(rows()).toEqual([
      { label: 'Cardiología', value: '400', width: '100%' },
      { label: 'Pediatría', value: '100', width: '25%' },
    ]);
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('ul')?.getAttribute('aria-label'),
    ).toBe('Citas por especialidad');
  });

  it('formats percentages and survives all-zero data', () => {
    fixture.componentRef.setInput('formato', 'porcentaje');
    fixture.componentRef.setInput('datos', [{ etiqueta: 'Sede Norte', valor: 0 }]);
    fixture.detectChanges();
    expect(rows()).toEqual([{ label: 'Sede Norte', value: '0%', width: '0%' }]);
  });

  it('draws no bars for empty data', () => {
    fixture.componentRef.setInput('datos', []);
    fixture.detectChanges();
    expect(rows()).toEqual([]);
  });
});
