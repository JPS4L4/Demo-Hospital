import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.css'
})
export class Header {
  navLinks = [
    { path: '/', label: 'Inicio' },
    { path: '/citas', label: 'Citas' },
    { path: '/medicamentos', label: 'Medicamentos' },
    { path: '/profesionales', label: 'Profesionales' },
    { path: '/noticias', label: 'Noticias' },
  ];
}