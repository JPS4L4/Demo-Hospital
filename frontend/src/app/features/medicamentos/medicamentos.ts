import { Component } from '@angular/core';
import { ComingSoon } from '../../shared/ui/coming-soon';
import { IconName } from '../../shared/ui/icon';

@Component({
  selector: 'app-medicamentos',
  imports: [ComingSoon],
  templateUrl: './medicamentos.html',
  styleUrl: './medicamentos.css',
})
export class Medicamentos {
  protected readonly items: { icon: IconName; title: string; text: string }[] = [
    { icon: 'pill', title: 'Consulta el catálogo', text: 'Busca medicamentos por nombre o principio activo.' },
    { icon: 'shield-check', title: 'Información clara', text: 'Presentación, indicaciones y recomendaciones de uso.' },
    { icon: 'map-pin', title: 'Disponibilidad por sede', text: 'Sabe en qué farmacia de la red encontrarlo.' },
  ];
}
