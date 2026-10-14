import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Medicamentos } from './medicamentos';

describe('Medicamentos', () => {
  let component: Medicamentos;
  let fixture: ComponentFixture<Medicamentos>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Medicamentos],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Medicamentos);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows the coming-soon notice with a heading', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toBeTruthy();
    expect(el.textContent).toContain('Próximamente');
  });
});
