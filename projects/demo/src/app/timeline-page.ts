import { ChangeDetectionStrategy, Component, afterNextRender, signal, viewChild } from '@angular/core';
import { LanesItemEvent, LanesTimeline, LanesZoom } from 'ngx-lanes';
import { generateDemo } from './demo-data';

@Component({
  selector: 'app-timeline-page',
  imports: [LanesTimeline],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toolbar">
      <span>{{ data.resources.length }} resources · {{ data.items.length }} bars</span>
      <div class="zoom" role="group" aria-label="Zoom">
        @for (z of zooms; track z.value) {
          <button type="button" [class.active]="zoom() === z.value" (click)="zoom.set(z.value)">{{ z.label }}</button>
        }
        <button type="button" (click)="timeline().scrollToTime(today)">Today</button>
      </div>
      <span class="selected">{{ selected() }}</span>
    </div>
    <lanes-timeline
      class="timeline"
      [resources]="data.resources"
      [items]="data.items"
      [(zoom)]="zoom"
      resourceHeader="Units"
      (itemClick)="onClick($event)"
    />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      gap: 8px;
    }
    .toolbar {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .zoom {
      display: flex;
      gap: 4px;
    }
    .zoom button {
      padding: 4px 10px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #fff;
      cursor: pointer;
    }
    .zoom button.active {
      background: #1e293b;
      color: #fff;
    }
    .selected {
      color: #475569;
    }
    .timeline {
      flex: 1;
    }
  `,
})
export class TimelinePage {
  protected readonly data = generateDemo(1000, 10);
  protected readonly zoom = signal<LanesZoom>('week');
  protected readonly selected = signal('Click a bar');
  protected readonly today = Date.now();
  protected readonly timeline = viewChild.required(LanesTimeline);
  protected readonly zooms: { value: LanesZoom; label: string }[] = [
    { value: 'day', label: 'Day' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
  ];

  constructor() {
    afterNextRender(() => this.timeline().scrollToTime(this.today));
  }

  protected onClick(e: LanesItemEvent): void {
    this.selected.set(`${e.item.label} · ${e.resource?.label}`);
  }
}
