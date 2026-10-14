import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Pagination } from './pagination';

describe('Pagination', () => {
  let fixture: ComponentFixture<Pagination>;
  let el: HTMLElement;
  let emitted: number[];

  function render(total: number, limit: number, offset: number): void {
    fixture.componentRef.setInput('total', total);
    fixture.componentRef.setInput('limit', limit);
    fixture.componentRef.setInput('offset', offset);
    fixture.detectChanges();
  }

  const buttons = () => Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [Pagination] }).compileComponents();
    fixture = TestBed.createComponent(Pagination);
    el = fixture.nativeElement;
    emitted = [];
    fixture.componentInstance.offsetChange.subscribe((o) => emitted.push(o));
  });

  it('renders nothing when everything fits in one page', () => {
    render(9, 9, 0);
    expect(el.querySelector('nav')).toBeNull();
  });

  it('shows the visible range and disables Anterior on the first page', () => {
    render(20, 9, 0);
    expect(el.querySelector('nav')?.textContent).toContain('1–9');
    expect(el.querySelector('nav')?.textContent).toContain('de 20');
    const [prev, next] = buttons();
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);
  });

  it('emits the next and previous offsets and clamps the last range to the total', () => {
    render(20, 9, 9);
    buttons()[1].click();
    buttons()[0].click();
    expect(emitted).toEqual([18, 0]);

    render(20, 9, 18);
    expect(el.querySelector('nav')?.textContent).toContain('19–20');
    expect(buttons()[1].disabled).toBe(true);
  });
});
