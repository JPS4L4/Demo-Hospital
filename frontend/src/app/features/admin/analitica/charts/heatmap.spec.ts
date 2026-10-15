import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Heatmap } from './heatmap';

describe('Heatmap', () => {
  let fixture: ComponentFixture<Heatmap>;
  let el: HTMLElement;

  beforeEach(() => {
    fixture = TestBed.createComponent(Heatmap);
    el = fixture.nativeElement;
    fixture.componentRef.setInput('nombre', 'Citas por día y hora');
  });

  it('builds a Monday-to-Sunday grid over the hours that have data, filling the gaps with zero', () => {
    fixture.componentRef.setInput('celdas', [
      { dia: 'miércoles', hora: 9, valor: 10 },
      { dia: 'lunes', hora: 7, valor: 20 },
      { dia: 'lunes', hora: 9, valor: 5 },
    ]);
    fixture.detectChanges();

    const headers = Array.from(el.querySelectorAll('thead th')).map((h) => h.textContent?.trim());
    expect(headers).toEqual(['7', '8', '9']);

    const rows = Array.from(el.querySelectorAll('tbody tr'));
    expect(rows.length).toBe(7);
    const text = (row: Element) =>
      Array.from(row.querySelectorAll('td')).map((c) => c.textContent?.trim());
    expect(text(rows[0])).toEqual(['20', '0', '5']);
    expect(text(rows[2])).toEqual(['0', '0', '10']);
    expect(rows[0].querySelector('th .sr-only')?.textContent).toBe('lunes');
    expect(rows[2].querySelector('th .sr-only')?.textContent).toBe('miércoles');
  });

  it('shades by intensity and marks the strongest cell for light text', () => {
    fixture.componentRef.setInput('celdas', [
      { dia: 'lunes', hora: 7, valor: 20 },
      { dia: 'lunes', hora: 8, valor: 10 },
    ]);
    fixture.detectChanges();
    const cells = Array.from(el.querySelectorAll('tbody tr:first-child td'));
    expect(cells[0].classList).toContain('l-hi');
    expect(cells[1].classList).not.toContain('l-hi');
    expect(cells[1].classList).toContain('d-hi');
    expect(cells[0].getAttribute('title')).toBe('lunes, 7 h: 20');
  });

  it('renders no columns without data', () => {
    fixture.componentRef.setInput('celdas', []);
    fixture.detectChanges();
    expect(el.querySelectorAll('thead th').length).toBe(0);
  });
});
