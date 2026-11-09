import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  LOCALE_ID,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { indexItemsByResource, itemsExtent, itemsInRange, visibleRows } from './layout';
import { LanesDateInput, LanesItem, LanesItemEvent, LanesResource, LanesZoom, NormalizedItem } from './models';
import { DAY, createTimeScale, startOfDay, toMs, visibleTicks } from './time-scale';

interface RenderedBar<TData> {
  item: NormalizedItem<TData>;
  left: number;
  width: number;
  /** Desplazamiento de la etiqueta para que siga visible si la barra empieza fuera de pantalla. */
  labelOffset: number;
  ariaLabel: string;
}

interface RenderedRow<TData> {
  resource: LanesResource;
  index: number;
  top: number;
  bars: RenderedBar<TData>[];
}

/** Viewport por defecto cuando no hay ResizeObserver (SSR, tests). */
const FALLBACK_VIEWPORT = { width: 1000, height: 600 };
/** Margen horizontal renderizado fuera de pantalla, en px. */
const H_OVERSCAN = 300;
/** Ancho reservado para la etiqueta pegada de una marca principal, en px. */
const MAJOR_LABEL_WIDTH = 160;
/** Espacio mínimo que se deja a la etiqueta pegada de una barra, en px. */
const MIN_LABEL_WIDTH = 80;

@Component({
  selector: 'lanes-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'lanes-timeline',
    '[style.--lanes-row-height.px]': 'rowHeight()',
    '[style.--lanes-resource-width.px]': 'resourceWidth()',
  },
  template: `
    <div class="lanes-corner" role="presentation">{{ resourceHeader() }}</div>

    <div class="lanes-header" aria-hidden="true">
      <div
        class="lanes-header-track"
        [style.width.px]="scale().width"
        [style.transform]="'translateX(' + -scrollLeft() + 'px)'"
      >
        @for (tick of majorTicks(); track tick.time) {
          <div class="lanes-tick-major" [style.left.px]="tick.x">
            <span class="lanes-tick-major-label" [style.left.px]="tick.labelOffset">{{ tick.label }}</span>
          </div>
        }
        @for (tick of ticks().minor; track tick.time) {
          <div class="lanes-tick-minor" [style.left.px]="tick.x">{{ tick.label }}</div>
        }
      </div>
    </div>

    <div class="lanes-resources" role="rowgroup">
      <div
        class="lanes-resources-track"
        [style.height.px]="totalHeight()"
        [style.transform]="'translateY(' + -scrollTop() + 'px)'"
      >
        @for (row of rows(); track row.resource.id) {
          <div class="lanes-resource" role="rowheader" [style.top.px]="row.top" [title]="row.resource.label">
            <span class="lanes-resource-label">{{ row.resource.label }}</span>
            @if (row.resource.description) {
              <span class="lanes-resource-description">{{ row.resource.description }}</span>
            }
          </div>
        }
      </div>
    </div>

    <div #body class="lanes-body" (scroll)="onScroll()">
      <div class="lanes-canvas" [style.width.px]="scale().width" [style.height.px]="totalHeight()">
        @for (tick of ticks().minor; track tick.time) {
          <div class="lanes-gridline" [style.left.px]="tick.x"></div>
        }
        @for (row of rows(); track row.resource.id) {
          <div class="lanes-row" role="row" [class.lanes-row-odd]="row.index % 2 === 1" [style.top.px]="row.top">
            @for (bar of row.bars; track bar.item.source.id) {
              <button
                type="button"
                class="lanes-bar"
                [class]="bar.item.source.className ?? ''"
                [attr.data-lanes-item]="bar.item.source.id"
                [attr.data-lanes-resource]="row.resource.id"
                [style.left.px]="bar.left"
                [style.width.px]="bar.width"
                [style.background]="bar.item.source.color ?? null"
                [attr.aria-label]="bar.ariaLabel"
                [title]="bar.ariaLabel"
                (click)="emitItem(itemClick, bar.item, row.resource, $event)"
                (dblclick)="emitItem(itemDoubleClick, bar.item, row.resource, $event)"
              >
                <span class="lanes-bar-label" [style.margin-left.px]="bar.labelOffset">{{
                  bar.item.source.label
                }}</span>
              </button>
            }
          </div>
        }
        @if (todayX(); as x) {
          <div class="lanes-today" [style.left.px]="x" aria-hidden="true"></div>
        }
      </div>
    </div>
  `,
  styles: `
    :host {
      --lanes-font: inherit;
      --lanes-bg: #ffffff;
      --lanes-row-alt-bg: #f7f8fa;
      --lanes-border: #dfe3e8;
      --lanes-grid: #eef0f3;
      --lanes-text: #1f2933;
      --lanes-text-muted: #66727f;
      --lanes-bar-bg: #3b82f6;
      --lanes-bar-text: #ffffff;
      --lanes-bar-radius: 4px;
      --lanes-today: #ef4444;
      --lanes-header-height: 52px;

      display: grid;
      grid-template-columns: var(--lanes-resource-width) 1fr;
      grid-template-rows: var(--lanes-header-height) 1fr;
      height: 100%;
      min-height: 200px;
      overflow: hidden;
      font: var(--lanes-font);
      font-size: 13px;
      color: var(--lanes-text);
      background: var(--lanes-bg);
      border: 1px solid var(--lanes-border);
      box-sizing: border-box;
    }
    .lanes-corner {
      display: flex;
      align-items: flex-end;
      padding: 0 12px 8px;
      font-weight: 600;
      border-right: 1px solid var(--lanes-border);
      border-bottom: 1px solid var(--lanes-border);
    }
    .lanes-header,
    .lanes-resources {
      position: relative;
      overflow: hidden;
    }
    .lanes-header {
      border-bottom: 1px solid var(--lanes-border);
    }
    .lanes-header-track,
    .lanes-resources-track {
      position: absolute;
      inset: 0 auto auto 0;
      will-change: transform;
    }
    .lanes-header-track {
      height: 100%;
    }
    .lanes-resources-track {
      width: 100%;
    }
    .lanes-tick-major,
    .lanes-tick-minor {
      position: absolute;
      white-space: nowrap;
      padding-left: 6px;
      border-left: 1px solid var(--lanes-border);
      box-sizing: border-box;
    }
    .lanes-tick-major {
      top: 0;
      height: 26px;
      line-height: 26px;
      font-weight: 600;
      padding-left: 0;
    }
    .lanes-tick-major-label {
      position: absolute;
      left: 0;
      padding-left: 6px;
    }
    .lanes-tick-minor {
      top: 26px;
      height: 26px;
      line-height: 26px;
      color: var(--lanes-text-muted);
      font-size: 11px;
    }
    .lanes-resources {
      border-right: 1px solid var(--lanes-border);
    }
    .lanes-resource {
      position: absolute;
      left: 0;
      right: 0;
      height: var(--lanes-row-height);
      padding: 0 12px;
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-sizing: border-box;
      border-bottom: 1px solid var(--lanes-grid);
      overflow: hidden;
    }
    .lanes-resource-label,
    .lanes-resource-description {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .lanes-resource-description {
      font-size: 11px;
      color: var(--lanes-text-muted);
    }
    .lanes-body {
      position: relative;
      overflow: auto;
    }
    .lanes-canvas {
      position: relative;
    }
    .lanes-gridline {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 1px solid var(--lanes-grid);
    }
    .lanes-row {
      position: absolute;
      left: 0;
      right: 0;
      height: var(--lanes-row-height);
      border-bottom: 1px solid var(--lanes-grid);
      box-sizing: border-box;
    }
    .lanes-row-odd {
      background: color-mix(in srgb, var(--lanes-row-alt-bg) 70%, transparent);
    }
    .lanes-bar {
      position: absolute;
      top: 6px;
      bottom: 6px;
      min-width: 3px;
      padding: 0 6px;
      margin: 0;
      border: 0;
      border-radius: var(--lanes-bar-radius);
      background: var(--lanes-bar-bg);
      color: var(--lanes-bar-text);
      font: inherit;
      font-size: 12px;
      text-align: left;
      cursor: pointer;
      overflow: hidden;
      box-sizing: border-box;
      opacity: 0.92;
    }
    .lanes-bar:hover,
    .lanes-bar:focus-visible {
      opacity: 1;
      outline: 2px solid var(--lanes-text);
      outline-offset: 1px;
      z-index: 1;
    }
    .lanes-bar-label {
      display: block;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .lanes-today {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 0;
      border-left: 2px solid var(--lanes-today);
      pointer-events: none;
    }
  `,
})
export class LanesTimeline<TData = unknown> {
  /** Filas del timeline, en el orden en que se muestran. */
  readonly resources = input.required<readonly LanesResource[]>();
  /** Asignaciones; las que apuntan a un recurso inexistente se ignoran. */
  readonly items = input<readonly LanesItem<TData>[]>([]);
  readonly zoom = model<LanesZoom>('week');
  /** Inicio del rango visible; por defecto, el primer item menos un día. */
  readonly start = input<LanesDateInput | undefined>(undefined);
  /** Fin del rango visible; por defecto, el último item más un día. */
  readonly end = input<LanesDateInput | undefined>(undefined);
  readonly rowHeight = input(40);
  readonly resourceWidth = input(220);
  readonly resourceHeader = input('Resources');
  readonly showToday = input(true);
  readonly locale = input<string>(inject(LOCALE_ID));

  readonly itemClick = output<LanesItemEvent<TData>>();
  readonly itemDoubleClick = output<LanesItemEvent<TData>>();

  private readonly body = viewChild.required<ElementRef<HTMLElement>>('body');
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly scrollTop = signal(0);
  protected readonly scrollLeft = signal(0);
  private readonly viewport = signal(FALLBACK_VIEWPORT);
  /** Momento en el centro de la vista; se conserva al cambiar de zoom. */
  private anchorTime: number | undefined;
  /** scrollLeft puesto por código, para ignorar su evento scroll. */
  private programmaticLeft: number | undefined;

  private readonly index = computed(() => indexItemsByResource(this.items()));
  private readonly resourceById = computed(() => new Map(this.resources().map((r) => [r.id, r])));

  private readonly range = computed(() => {
    const extent = itemsExtent(this.index());
    const now = Date.now();
    const startInput = this.start();
    const endInput = this.end();
    const start = startInput !== undefined ? toMs(startInput) : startOfDay((extent?.start ?? now) - DAY);
    const end = endInput !== undefined ? toMs(endInput) : startOfDay((extent?.end ?? now + 7 * DAY) + 2 * DAY);
    return { start, end };
  });

  protected readonly scale = computed(() => createTimeScale(this.range().start, this.range().end, this.zoom()));
  protected readonly totalHeight = computed(() => this.resources().length * this.rowHeight());

  private readonly visibleTime = computed(() => {
    const scale = this.scale();
    const left = this.scrollLeft();
    return {
      from: scale.toTime(left - H_OVERSCAN),
      to: scale.toTime(left + this.viewport().width + H_OVERSCAN),
    };
  });

  protected readonly ticks = computed(() => {
    const { from, to } = this.visibleTime();
    return visibleTicks(this.scale(), this.zoom(), from, to, this.locale());
  });

  /** Marcas principales; la etiqueta de la que empezó fuera de pantalla se queda pegada al borde izquierdo. */
  protected readonly majorTicks = computed(() => {
    const major = this.ticks().major;
    const left = this.scrollLeft();
    return major.map((tick, i) => {
      const next = major[i + 1]?.x ?? Infinity;
      const labelOffset = tick.x < left ? Math.max(0, Math.min(left, next - MAJOR_LABEL_WIDTH) - tick.x) : 0;
      return { ...tick, labelOffset };
    });
  });

  protected readonly rows = computed<RenderedRow<TData>[]>(() => {
    const resources = this.resources();
    const rowHeight = this.rowHeight();
    const window = visibleRows(this.scrollTop(), this.viewport().height, rowHeight, resources.length);
    const { from, to } = this.visibleTime();
    const scrollLeft = this.scrollLeft();
    const scale = this.scale();
    const index = this.index();
    const fmt = new Intl.DateTimeFormat(this.locale(), { dateStyle: 'short', timeStyle: 'short' });

    const rows: RenderedRow<TData>[] = [];
    for (let i = window.first; i < window.last; i++) {
      const resource = resources[i];
      const bars = itemsInRange(index.get(resource.id), from, to).map((item) => {
        const left = scale.toX(item.start);
        const width = Math.max(3, scale.toX(item.end) - left);
        const name = item.source.label ?? item.source.id;
        const labelOffset = Math.max(0, Math.min(scrollLeft - left, width - MIN_LABEL_WIDTH));
        return {
          item,
          left,
          width,
          labelOffset,
          ariaLabel: `${name}, ${resource.label}: ${fmt.format(item.start)} – ${fmt.format(item.end)}`,
        };
      });
      rows.push({ resource, index: i, top: i * rowHeight, bars });
    }
    return rows;
  });

  protected readonly todayX = computed(() => {
    if (!this.showToday()) return null;
    const now = Date.now();
    const scale = this.scale();
    return now >= scale.start && now <= scale.end ? scale.toX(now) : null;
  });

  constructor() {
    afterNextRender(() => {
      const el = this.body().nativeElement;
      if (typeof ResizeObserver === 'undefined') return;
      const ro = new ResizeObserver(([entry]) => {
        const { width, height } = entry.contentRect;
        if (width <= 0 || height <= 0) return;
        const previous = untracked(this.viewport);
        this.viewport.set({ width, height });
        // Mantener centrado el instante de referencia cuando cambia el ancho disponible.
        if (width !== previous.width && this.anchorTime !== undefined) {
          this.setScrollLeft(untracked(this.scale).toX(this.anchorTime) - width / 2, false);
        }
      });
      ro.observe(el);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });

    // Al cambiar de zoom o de rango, mantener centrado el mismo instante. Se espera al render
    // para que el lienzo ya tenga su nuevo ancho; si no, el navegador recorta el scroll.
    effect(() => {
      const scale = this.scale();
      const anchor = untracked(() => this.anchorTime);
      if (anchor === undefined) return;
      afterNextRender(
        {
          write: () => this.setScrollLeft(scale.toX(anchor) - untracked(this.viewport).width / 2, false),
        },
        { injector: this.injector },
      );
    });
  }

  protected onScroll(): void {
    const el = this.body().nativeElement;
    this.scrollTop.set(el.scrollTop);
    this.scrollLeft.set(el.scrollLeft);
    // El evento scroll de un ajuste automático llega después, de forma asíncrona: no debe mover
    // el punto de referencia (el navegador puede haber recortado el valor).
    if (this.programmaticLeft !== undefined && Math.abs(el.scrollLeft - this.programmaticLeft) < 1) return;
    this.programmaticLeft = undefined;
    if (el.scrollWidth > el.clientWidth) {
      this.anchorTime = this.scale().toTime(el.scrollLeft + this.viewport().width / 2);
    }
  }

  /** Mueve el scroll horizontal; con `updateAnchor = false` conserva el instante de referencia. */
  private setScrollLeft(left: number, updateAnchor: boolean): void {
    const el = this.body().nativeElement;
    el.scrollLeft = Math.max(0, left);
    if (updateAnchor) {
      this.programmaticLeft = undefined;
      this.onScroll();
    } else {
      this.programmaticLeft = el.scrollLeft;
      this.scrollTop.set(el.scrollTop);
      this.scrollLeft.set(el.scrollLeft);
    }
  }

  protected emitItem(
    target: typeof this.itemClick,
    item: NormalizedItem<TData>,
    resource: LanesResource,
    event: MouseEvent,
  ): void {
    target.emit({ item: item.source, resource: this.resourceById().get(resource.id), event });
  }

  /** Desplaza la vista para centrar un instante. */
  scrollToTime(time: LanesDateInput): void {
    const ms = toMs(time);
    this.anchorTime = ms;
    this.setScrollLeft(this.scale().toX(ms) - this.viewport().width / 2, false);
  }

  /**
   * Instante (ms) bajo una coordenada X de pantalla, p. ej. `event.clientX`.
   * Útil para crear o mover elementos con el ratón.
   */
  timeAtClientX(clientX: number): number {
    const el = this.body().nativeElement;
    const x = clientX - el.getBoundingClientRect().left - el.clientLeft + el.scrollLeft;
    return this.scale().toTime(x);
  }

  /** Recurso bajo una coordenada Y de pantalla, p. ej. `event.clientY`; `undefined` fuera de las filas. */
  resourceAtClientY(clientY: number): LanesResource | undefined {
    const el = this.body().nativeElement;
    const y = clientY - el.getBoundingClientRect().top - el.clientTop + el.scrollTop;
    if (y < 0) return undefined;
    return this.resources()[Math.floor(y / this.rowHeight())];
  }

  /** Coordenada X de pantalla de un instante (inversa de `timeAtClientX`). */
  clientXAtTime(time: LanesDateInput): number {
    const el = this.body().nativeElement;
    return this.scale().toX(toMs(time)) + el.getBoundingClientRect().left + el.clientLeft - el.scrollLeft;
  }

  /** Desplaza la vista verticalmente hasta un recurso. */
  scrollToResource(resourceId: string): void {
    const i = this.resources().findIndex((r) => r.id === resourceId);
    if (i < 0) return;
    const el = this.body().nativeElement;
    el.scrollTop = Math.max(0, i * this.rowHeight() - this.viewport().height / 2);
    this.onScroll();
  }
}
