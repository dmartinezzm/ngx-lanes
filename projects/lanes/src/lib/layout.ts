import { LanesItem, NormalizedItem } from './models';
import { toMs } from './time-scale';

/** Items de un recurso ordenados por inicio + la duración máxima, para buscar por rango en O(log n). */
export interface ResourceIndex<TData = unknown> {
  items: NormalizedItem<TData>[];
  maxDuration: number;
}

export function indexItemsByResource<TData>(items: readonly LanesItem<TData>[]): Map<string, ResourceIndex<TData>> {
  const map = new Map<string, ResourceIndex<TData>>();
  for (const source of items) {
    const start = toMs(source.start);
    const end = Math.max(toMs(source.end), start);
    let entry = map.get(source.resourceId);
    if (!entry) {
      entry = { items: [], maxDuration: 0 };
      map.set(source.resourceId, entry);
    }
    entry.items.push({ source, start, end });
    entry.maxDuration = Math.max(entry.maxDuration, end - start);
  }
  for (const entry of map.values()) {
    entry.items.sort((a, b) => a.start - b.start);
  }
  return map;
}

/** Primer índice cuyo `start` es >= `time`. */
function lowerBound(items: NormalizedItem[], time: number): number {
  let lo = 0;
  let hi = items.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (items[mid].start < time) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Items que se solapan con [from, to). */
export function itemsInRange<TData>(
  index: ResourceIndex<TData> | undefined,
  from: number,
  to: number,
): NormalizedItem<TData>[] {
  if (!index || index.items.length === 0) return [];
  const { items, maxDuration } = index;
  const result: NormalizedItem<TData>[] = [];
  // Ningún item que empiece antes de (from - maxDuration) puede llegar a `from`.
  const first = lowerBound(items as NormalizedItem[], from - maxDuration);
  for (let i = first; i < items.length; i++) {
    const item = items[i];
    if (item.start >= to) break;
    if (item.end > from) result.push(item);
  }
  return result;
}

export interface RowWindow {
  first: number;
  /** Exclusivo. */
  last: number;
}

/** Filas visibles para un scroll vertical dado, con margen de `overscan` filas por arriba y por abajo. */
export function visibleRows(
  scrollTop: number,
  viewportHeight: number,
  rowHeight: number,
  rowCount: number,
  overscan = 4,
): RowWindow {
  if (rowCount === 0 || rowHeight <= 0) return { first: 0, last: 0 };
  const first = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const last = Math.min(rowCount, Math.ceil((scrollTop + viewportHeight) / rowHeight) + overscan);
  return { first, last };
}

/** Rango temporal que cubren todos los items, o undefined si no hay items. */
export function itemsExtent(index: Map<string, ResourceIndex>): { start: number; end: number } | undefined {
  let start = Infinity;
  let end = -Infinity;
  for (const entry of index.values()) {
    for (const item of entry.items) {
      if (item.start < start) start = item.start;
      if (item.end > end) end = item.end;
    }
  }
  return Number.isFinite(start) ? { start, end } : undefined;
}
