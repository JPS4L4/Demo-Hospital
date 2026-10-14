import { Component } from '@angular/core';
import { ComingSoon } from '../../shared/ui/coming-soon';
import { IconName } from '../../shared/ui/icon';

@Component({
  selector: 'app-profesionales',
  imports: [ComingSoon],
  templateUrl: './profesionales.html',
  styleUrl: './profesionales.css',
})
export class Profesionales {
  protected readonly items: { icon: IconName; title: string; text: string }[] = [
    { icon: 'users', title: 'Conoce a tu equipo', text: 'Perfiles de médicos y especialistas de cada sede.' },
    { icon: 'heart-pulse', title: 'Busca por especialidad', text: 'Cardiología, pediatría, medicina interna y más.' },
    { icon: 'calendar', title: 'Agenda directa', text: 'Pide cita con el profesional que prefieras.' },
  ];
}
