import { Component } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { GanttDate, GanttGroup, GanttItem, GanttViewType, NgxGanttModule } from '@worktile/gantt';
import { LanesItem, LanesResource, LanesTimeline } from 'ngx-lanes';
import { SchedulaGanttComponent } from 'schedula-core-angular';

/**
 * Benchmark: same data in ngx-lanes, ngx-gantt and schedula-core.
 * Open with ?lib=lanes | ngx-gantt | schedula and optionally &resources=1000&per=10.
 */

const params = new URLSearchParams(location.search);
const LIB = params.get('lib') ?? 'lanes';
const RESOURCES = Number(params.get('resources') ?? 1000);
const PER_RESOURCE = Number(params.get('per') ?? 10);

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Fixed origin so every run uses identical data. */
const ORIGIN = new Date(2026, 0, 5).getTime();
/** Every library shows about 140 px per day, the same density as ngx-lanes' week zoom. */
const PX_PER_DAY = 140;
const COLORS = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777'];
const KINDS = ['Maintenance', 'Route', 'Booking', 'Shift', 'Inspection'];

interface Row {
  id: string;
  label: string;
  bars: { id: string; start: number; end: number; label: string; color: string }[];
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function generate(): Row[] {
  const random = mulberry32(42);
  return Array.from({ length: RESOURCES }, (_, i) => {
    let cursor = ORIGIN + Math.floor(random() * 48) * HOUR;
    const bars = Array.from({ length: PER_RESOURCE }, (_, j) => {
      const duration = (4 + Math.floor(random() * 60)) * HOUR;
      const kind = Math.floor(random() * KINDS.length);
      const bar = { id: `r${i}-${j}`, start: cursor, end: cursor + duration, label: `${KINDS[kind]} ${j + 1}`, color: COLORS[kind] };
      cursor += duration + (2 + Math.floor(random() * 30)) * HOUR;
      return bar;
    });
    return { id: `r${i}`, label: `Unit ${String(i + 1).padStart(4, '0')}`, bars };
  });
}

const ROWS = generate();
const END = Math.max(...ROWS.flatMap((r) => r.bars.map((b) => b.end))) + 2 * DAY;

@Component({
  selector: 'bench-lanes',
  imports: [LanesTimeline],
  template: `<lanes-timeline style="height: 100%" [resources]="resources" [items]="items" zoom="week" [start]="start" [end]="end" />`,
})
class LanesBench {
  readonly start = ORIGIN - DAY;
  readonly end = END;
  readonly resources: LanesResource[] = ROWS.map((r) => ({ id: r.id, label: r.label }));
  readonly items: LanesItem[] = ROWS.flatMap((r) =>
    r.bars.map((b) => ({ id: b.id, resourceId: r.id, start: b.start, end: b.end, label: b.label, color: b.color })),
  );
}

@Component({
  selector: 'bench-ngx-gantt',
  // NgxGanttModule registers the providers ngx-gantt needs (global config, i18n).
  imports: [NgxGanttModule],
  template: `
    <ngx-gantt style="height: 100%" [groups]="groups" [items]="items" [viewType]="viewType" [viewOptions]="viewOptions" [virtualScrollEnabled]="true">
      <ngx-gantt-table>
        <ngx-gantt-column name="Title" width="200px">
          <ng-template #cell let-item="item">{{ item.title }}</ng-template>
        </ngx-gantt-column>
      </ngx-gantt-table>
    </ngx-gantt>
  `,
})
class NgxGanttBench {
  readonly viewType = GanttViewType.day;
  readonly viewOptions = { start: new GanttDate(ORIGIN - DAY), end: new GanttDate(END), unitWidth: PX_PER_DAY };
  readonly groups: GanttGroup[] = ROWS.map((r) => ({ id: r.id, title: r.label, expanded: true }));
  // ngx-gantt works in seconds and shows one task per row, grouped by resource.
  readonly items: GanttItem[] = ROWS.flatMap((r) =>
    r.bars.map((b) => ({ id: b.id, title: b.label, group_id: r.id, start: b.start / 1000, end: b.end / 1000, color: b.color })),
  );
}

@Component({
  selector: 'bench-schedula',
  imports: [SchedulaGanttComponent],
  template: `<div style="height: 100%"><schedula-gantt [data]="data" [settings]="settings" [view]="8" /></div>`,
})
class SchedulaBench {
  readonly settings = { date: new Date(ORIGIN - DAY), animation: false };
  // schedula-core positions items in minutes from settings.date.
  readonly data = {
    Resources: ROWS.map((r) => ({
      Id: r.id,
      Name: r.label,
      Items: r.bars.map((b) => ({
        Id: b.id,
        Text: b.label,
        Offset: Math.round((b.start - (ORIGIN - DAY)) / 60_000),
        Width: Math.round((b.end - b.start) / 60_000),
        Color1: b.color,
      })),
    })),
  };
}

const COMPONENTS = { lanes: LanesBench, 'ngx-gantt': NgxGanttBench, schedula: SchedulaBench } as const;

@Component({
  selector: 'bench-root',
  imports: [LanesBench, NgxGanttBench, SchedulaBench],
  template: `
    @switch (lib) {
      @case ('lanes') { <bench-lanes /> }
      @case ('ngx-gantt') { <bench-ngx-gantt /> }
      @case ('schedula') { <bench-schedula /> }
    }
  `,
  styles: `:host { display: block; height: 100vh; } :host > * { display: block; height: 100%; }`,
})
class BenchRoot {
  readonly lib = LIB in COMPONENTS ? LIB : 'lanes';
}

declare global {
  interface Window {
    __benchStart: number;
  }
}
window.__benchStart = performance.now();
bootstrapApplication(BenchRoot).catch((err) => console.error(err));
