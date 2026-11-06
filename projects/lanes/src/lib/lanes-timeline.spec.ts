import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanesTimeline } from './lanes-timeline';
import { LanesItem, LanesItemEvent, LanesResource, LanesZoom } from './models';

const DAY = 86_400_000;
const START = new Date(2026, 0, 5).getTime();

function makeData(resourceCount: number, perResource: number) {
  const resources: LanesResource[] = Array.from({ length: resourceCount }, (_, i) => ({
    id: `r${i}`,
    label: `Recurso ${i}`,
  }));
  const items: LanesItem[] = [];
  for (const r of resources) {
    for (let j = 0; j < perResource; j++) {
      items.push({
        id: `${r.id}-${j}`,
        resourceId: r.id,
        start: START + j * DAY,
        end: START + j * DAY + DAY / 2,
        label: `T${j}`,
      });
    }
  }
  return { resources, items };
}

@Component({
  imports: [LanesTimeline],
  template: `<lanes-timeline
    style="height: 600px"
    [resources]="resources()"
    [items]="items()"
    [(zoom)]="zoom"
    [start]="start"
    (itemClick)="clicked = $event"
  />`,
})
class Host {
  readonly resources = signal<LanesResource[]>([]);
  readonly items = signal<LanesItem[]>([]);
  readonly zoom = signal<LanesZoom>('week');
  readonly start = START - DAY;
  clicked?: LanesItemEvent;
}

async function render(resourceCount: number, perResource: number) {
  const fixture = TestBed.createComponent(Host);
  const data = makeData(resourceCount, perResource);
  fixture.componentInstance.resources.set(data.resources);
  fixture.componentInstance.items.set(data.items);
  await fixture.whenStable();
  return fixture;
}

describe('LanesTimeline', () => {
  it('con 1.000 recursos y 10.000 barras solo renderiza lo visible', async () => {
    const fixture = await render(1000, 10);
    const el: HTMLElement = fixture.nativeElement;
    const rows = el.querySelectorAll('.lanes-row').length;
    const bars = el.querySelectorAll('.lanes-bar').length;
    expect(rows).toBeGreaterThan(0);
    expect(rows).toBeLessThan(40);
    expect(bars).toBeLessThan(rows * 10 + 1);
    expect(el.querySelector('.lanes-resource-label')?.textContent).toBe('Recurso 0');
  });

  it('el lienzo mide el total de filas', async () => {
    const fixture = await render(1000, 1);
    const canvas: HTMLElement = fixture.nativeElement.querySelector('.lanes-canvas');
    expect(canvas.style.height).toBe(`${1000 * 40}px`);
  });

  it('emite itemClick con el item y su recurso', async () => {
    const fixture = await render(3, 2);
    const bar: HTMLButtonElement = fixture.nativeElement.querySelector('.lanes-bar');
    bar.click();
    expect(fixture.componentInstance.clicked?.item.id).toBe('r0-0');
    expect(fixture.componentInstance.clicked?.resource?.label).toBe('Recurso 0');
  });

  it('cada barra tiene una etiqueta accesible con recurso y fechas', async () => {
    const fixture = await render(1, 1);
    const bar: HTMLButtonElement = fixture.nativeElement.querySelector('.lanes-bar');
    expect(bar.getAttribute('aria-label')).toMatch(/^T0, Recurso 0: /);
  });

  it('cambiar el zoom cambia el ancho del lienzo', async () => {
    const fixture = await render(2, 5);
    const canvas: HTMLElement = fixture.nativeElement.querySelector('.lanes-canvas');
    const weekWidth = parseFloat(canvas.style.width);
    fixture.componentInstance.zoom.set('month');
    await fixture.whenStable();
    expect(parseFloat(canvas.style.width)).toBeLessThan(weekWidth);
  });

  it('ignora items de recursos que no existen', async () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.resources.set([{ id: 'a', label: 'A' }]);
    fixture.componentInstance.items.set([{ id: 'x', resourceId: 'fantasma', start: START, end: START + DAY }]);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('.lanes-bar').length).toBe(0);
  });
});

describe('LanesTimeline con scroll', () => {
  it('al cambiar de zoom mantiene centrado el mismo instante', async () => {
    const fixture = await render(5, 30);
    const timeline = fixture.debugElement.children[0].componentInstance as LanesTimeline;
    const body: HTMLElement = fixture.nativeElement.querySelector('.lanes-body');
    const target = START + 20 * DAY;

    timeline.scrollToTime(target);
    await fixture.whenStable();
    const scaleBefore = (timeline as unknown as { scale(): { toTime(x: number): number } }).scale();
    // En jsdom el viewport es el de reserva (1000 px de ancho).
    expect(scaleBefore.toTime(body.scrollLeft + 500)).toBeCloseTo(target, -5);

    fixture.componentInstance.zoom.set('day');
    await fixture.whenStable();
    const scaleAfter = (timeline as unknown as { scale(): { toTime(x: number): number } }).scale();
    expect(Math.abs(scaleAfter.toTime(body.scrollLeft + 500) - target)).toBeLessThan(DAY / 24);
  });
});
