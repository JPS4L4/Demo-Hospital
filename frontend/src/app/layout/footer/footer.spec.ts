import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { Footer } from './footer';

describe('Footer', () => {
  let component: Footer;
  let fixture: ComponentFixture<Footer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Footer],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(Footer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows contact details, the sede cities and the demo notice', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[href^="tel:"]')).toBeTruthy();
    expect(el.querySelector('a[href^="mailto:"]')).toBeTruthy();
    expect(el.textContent).toContain('Medellín');
    expect(el.textContent).toContain('demostración');
  });
});
