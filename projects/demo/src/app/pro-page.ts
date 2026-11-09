import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Enlace al formulario de lista de espera (issue form de GitHub, sin servicios externos). */
export const WAITLIST_URL = 'https://github.com/dmartinezzm/ngx-lanes/issues/new?template=lanes-pro-waitlist.yml';

@Component({
  selector: 'app-pro-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article>
      <h1>Lanes Pro</h1>
      <p class="lead">
        Everything in the free timeline, plus what a planning tool needs in production. Built for teams that find
        enterprise Gantt suites too expensive and free components too limited.
      </p>

      <figure>
        <img
          src="lanes-pro.gif"
          width="800"
          height="448"
          alt="Lanes Pro: a bar is dragged to another resource, resized from its edge, and an overlapping drop is rejected"
        />
        <figcaption>
          The editing features already work: drag between resources, resize, keyboard editing, overlap detection and
          drop validation. Recorded from the Lanes Pro playground.
        </figcaption>
      </figure>

      <table>
        <thead>
          <tr>
            <th scope="col">Feature</th>
            <th scope="col">Free</th>
            <th scope="col">Pro</th>
          </tr>
        </thead>
        <tbody>
          @for (row of features; track row.name) {
            <tr>
              <td>{{ row.name }}</td>
              <td>{{ row.free ? 'Yes' : '—' }}</td>
              <td>{{ row.pro }}</td>
            </tr>
          }
        </tbody>
      </table>

      <section class="price">
        <h2>Founder price</h2>
        <p>
          <strong>€75 per developer</strong>, perpetual licence with a year of updates, for the first teams on the
          waitlist. The regular price will be €149.
        </p>
        <a class="cta" [href]="waitlistUrl" target="_blank" rel="noopener">Join the waitlist</a>
        <p class="note">
          The waitlist is a short GitHub form: what you plan, how many items and which features you need first. It is
          public on GitHub, so leave out anything confidential.
        </p>
      </section>
    </article>
  `,
  styles: `
    article {
      max-width: 760px;
      margin: 0 auto;
      padding-bottom: 48px;
    }
    h1 {
      margin: 8px 0;
    }
    .lead {
      font-size: 17px;
      color: #334155;
    }
    figure {
      margin: 24px 0;
    }
    figure img {
      display: block;
      width: 100%;
      height: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    figcaption {
      margin-top: 8px;
      font-size: 13px;
      color: #64748b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 24px 0;
    }
    th,
    td {
      text-align: left;
      padding: 8px 10px;
      border-bottom: 1px solid #e2e8f0;
    }
    th:not(:first-child),
    td:not(:first-child) {
      width: 90px;
      text-align: center;
    }
    .price {
      padding: 20px;
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      background: #f8fafc;
    }
    .price h2 {
      margin-top: 0;
    }
    .cta {
      display: inline-block;
      padding: 10px 18px;
      border-radius: 8px;
      background: #1d4ed8;
      color: #fff;
      font-weight: 600;
      text-decoration: none;
    }
    .note {
      font-size: 13px;
      color: #64748b;
    }
  `,
})
export class ProPage {
  protected readonly waitlistUrl = WAITLIST_URL;
  protected readonly features = [
    { name: 'Resource rows, bars, day/week/month zoom', free: true, pro: 'Yes' },
    { name: 'Virtualized rendering, signals, zoneless-ready', free: true, pro: 'Yes' },
    { name: 'Drag, resize and move bars between resources', free: false, pro: 'Ready' },
    { name: 'Keyboard editing and drop validation', free: false, pro: 'Ready' },
    { name: 'Conflict and overlap detection', free: false, pro: 'Ready' },
    { name: 'Canvas rendering for 10,000+ visible bars', free: false, pro: 'Planned' },
    { name: 'Live updates from SignalR, WebSockets or SSE', free: false, pro: 'Planned' },
    { name: 'Export to PNG, PDF and Excel', free: false, pro: 'Planned' },
    { name: 'PrimeNG and Angular Material themes', free: false, pro: 'Planned' },
    { name: 'Email support', free: false, pro: 'Yes' },
  ];
}
