import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Header } from './layout/header/header';
import { Footer } from './layout/footer/footer';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  // <base href="/"> haría que "#contenido" navegara a la raíz; se mueve el foco a mano.
  skipToContent(event: Event): void {
    event.preventDefault();
    const main = document.getElementById('contenido');
    main?.focus();
    main?.scrollIntoView();
  }
}
