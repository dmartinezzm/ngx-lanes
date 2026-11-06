import { Component, signal } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { LanesItem, LanesItemEvent, LanesResource, LanesTimeline, LanesZoom } from 'ngx-lanes';

const HOUR = 3_600_000;
const today = new Date();
today.setHours(0, 0, 0, 0);
const at = (day: number, hour: number) => today.getTime() + day * 24 * HOUR + hour * HOUR;

@Component({
  selector: 'app-root',
  imports: [LanesTimeline],
  template: `
    <p>
      Zoom:
      <button (click)="zoom.set('day')">Day</button>
      <button (click)="zoom.set('week')">Week</button>
      <button (click)="zoom.set('month')">Month</button>
      · {{ selected() }}
    </p>
    <lanes-timeline
      style="height: 320px"
      [resources]="resources"
      [items]="items"
      [(zoom)]="zoom"
      (itemClick)="select($event)"
    />
  `,
})
class App {
  readonly zoom = signal<LanesZoom>('week');
  readonly selected = signal('Click a bar');

  readonly resources: LanesResource[] = [
    { id: 'v1', label: 'Van 1', description: 'North fleet' },
    { id: 'v2', label: 'Van 2', description: 'North fleet' },
    { id: 'v3', label: 'Truck 1', description: 'South fleet' },
  ];

  readonly items: LanesItem[] = [
    { id: 'a', resourceId: 'v1', start: at(0, 8), end: at(0, 14), label: 'Route 3' },
    { id: 'b', resourceId: 'v1', start: at(1, 9), end: at(2, 12), label: 'Maintenance', color: '#d97706' },
    { id: 'c', resourceId: 'v2', start: at(0, 6), end: at(1, 18), label: 'Delivery Madrid', color: '#059669' },
    { id: 'd', resourceId: 'v3', start: at(2, 7), end: at(4, 20), label: 'Long haul', color: '#7c3aed' },
  ];

  select(event: LanesItemEvent) {
    this.selected.set(`${event.item.label} · ${event.resource?.label}`);
  }
}

bootstrapApplication(App).catch((err) => console.error(err));
