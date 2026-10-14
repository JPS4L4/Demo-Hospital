import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Profesionales } from './profesionales';

describe('Profesionales', () => {
  let component: Profesionales;
  let fixture: ComponentFixture<Profesionales>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Profesionales],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Profesionales);
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
