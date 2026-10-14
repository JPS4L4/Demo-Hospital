import { Component } from '@angular/core';
import { ComingSoon } from '../../shared/ui/coming-soon';
import { IconName } from '../../shared/ui/icon';

@Component({
  selector: 'app-citas',
  imports: [ComingSoon],
  templateUrl: './citas.html',
  styleUrl: './citas.css',
})
export class Citas {
  protected readonly items: { icon: IconName; title: string; text: string }[] = [
    { icon: 'calendar', title: 'Elige día y hora', text: 'Consulta la agenda disponible de cada especialidad.' },
    { icon: 'map-pin', title: 'Escoge tu sede', text: 'Reserva en la clínica que te quede más cerca.' },
    { icon: 'shield-check', title: 'Confirmación inmediata', text: 'Recibe el detalle de tu cita sin llamadas ni esperas.' },
  ];
}
