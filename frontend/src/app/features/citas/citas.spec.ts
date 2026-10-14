import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Citas } from './citas';

describe('Citas', () => {
  let component: Citas;
  let fixture: ComponentFixture<Citas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Citas],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Citas);
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
