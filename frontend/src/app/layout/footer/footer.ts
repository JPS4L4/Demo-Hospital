import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Icon } from '../../shared/ui/icon';
import { Logo } from '../../shared/ui/logo';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, Icon, Logo],
  templateUrl: './footer.html',
  styleUrl: './footer.css',
})
export class Footer {
  anioActual = new Date().getFullYear();

  links = [
    { path: '/', label: 'Inicio' },
    { path: '/citas', label: 'Pedir cita' },
    { path: '/profesionales', label: 'Profesionales' },
    { path: '/medicamentos', label: 'Medicamentos' },
    { path: '/noticias', label: 'Noticias' },
    { path: '/sedes', label: 'Sedes' },
  ];

  ciudades = ['Bogotá', 'Medellín', 'Cali', 'Barranquilla'];
}
