import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { interval } from 'rxjs';

/**
 * Página con tres errores a propósito para que Probe los detecte:
 * 1. Una suscripción a interval() que nunca se cancela (fuga al navegar).
 * 2. La misma petición GET lanzada dos veces.
 * 3. Una lista de 1.000 filas renderizada entera.
 */
@Component({
  selector: 'app-buggy-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p>
      This page has three bugs on purpose: a subscription that is never closed, the same request sent twice and a
      1,000-row list rendered in full. Switch between pages a few times, then open the Probe panel in the corner.
      Seconds on this page: {{ seconds() }}.
    </p>
    <ul class="list">
      @for (row of rows; track row) {
        <li>Row {{ row }}</li>
      }
    </ul>
  `,
  styles: `
    .list {
      height: 400px;
      overflow: auto;
      border: 1px solid #cbd5e1;
      margin: 0;
      padding: 0 16px;
    }
  `,
})
export class BuggyPage implements OnInit {
  private readonly http = inject(HttpClient);
  protected readonly seconds = signal(0);
  protected readonly rows = Array.from({ length: 1000 }, (_, i) => i + 1);

  ngOnInit(): void {
    // Error 1: sin takeUntilDestroyed, sigue viva tras salir de la página.
    interval(1000).subscribe(() => this.seconds.update((s) => s + 1));

    // Error 2: dos componentes hijos pidiendo lo mismo, simulado con dos llamadas.
    this.http.get('demo-config.json').subscribe();
    this.http.get('demo-config.json').subscribe();
  }
}
