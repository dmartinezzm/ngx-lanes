import { Injectable, inject, signal } from '@angular/core';
import { PROBE_OPTIONS } from './options';

export interface TickStats {
  count: number;
  slow: number;
  maxMs: number;
  avgMs: number;
  /** Ciclos en el último segundo. */
  perSecond: number;
}

export interface DuplicateRequest {
  key: string;
  count: number;
  lastAt: number;
}

export interface SubscriptionLeak {
  origin: string;
  /** Suscripciones vivas en cada instantánea, de la más antigua a la más reciente. */
  history: number[];
}

export interface LargeList {
  selector: string;
  children: number;
}

export interface ProbeReport {
  generatedAt: string;
  url: string;
  ticks: TickStats;
  duplicateRequests: DuplicateRequest[];
  subscriptionLeaks: SubscriptionLeak[];
  liveSubscriptions: number;
  largeLists: LargeList[];
}

const RING_SIZE = 240;

/**
 * Estado de la sonda. Los contadores se escriben en campos planos (nunca en signals) desde
 * los ganchos de alta frecuencia, para no provocar ciclos de change detection; `publish()`
 * los copia a signals como mucho una vez por intervalo.
 */
@Injectable({ providedIn: 'root' })
export class ProbeStore {
  private readonly options = inject(PROBE_OPTIONS);

  // --- Campos crudos, escritos desde los ganchos ---
  private tickDurations = new Float64Array(RING_SIZE);
  private tickTimes = new Float64Array(RING_SIZE);
  private tickCursor = 0;
  private tickCount = 0;
  private slowTicks = 0;
  private maxTick = 0;
  private readonly duplicates = new Map<string, DuplicateRequest>();
  private readonly warned = new Set<string>();

  // --- Estado publicado, leído por el panel ---
  readonly ticks = signal<TickStats>({ count: 0, slow: 0, maxMs: 0, avgMs: 0, perSecond: 0 });
  readonly duplicateRequests = signal<DuplicateRequest[]>([]);
  readonly subscriptionLeaks = signal<SubscriptionLeak[]>([]);
  readonly liveSubscriptions = signal(0);
  readonly largeLists = signal<LargeList[]>([]);

  recordTick(durationMs: number, at = performance.now()): void {
    this.tickDurations[this.tickCursor] = durationMs;
    this.tickTimes[this.tickCursor] = at;
    this.tickCursor = (this.tickCursor + 1) % RING_SIZE;
    this.tickCount++;
    if (durationMs > this.options.slowTickMs) this.slowTicks++;
    if (durationMs > this.maxTick) this.maxTick = durationMs;
  }

  recordDuplicate(key: string, at = Date.now()): void {
    const entry = this.duplicates.get(key) ?? { key, count: 0, lastAt: at };
    entry.count++;
    entry.lastAt = at;
    this.duplicates.set(key, entry);
    this.warnOnce(`http:${key}`, `[probe] Duplicate request: ${key}`);
  }

  setSubscriptions(live: number, leaks: SubscriptionLeak[]): void {
    this.liveSubscriptions.set(live);
    if (!sameJson(this.subscriptionLeaks(), leaks)) this.subscriptionLeaks.set(leaks);
    for (const leak of leaks) {
      this.warnOnce(
        `leak:${leak.origin}`,
        `[probe] Possible subscription leak at ${leak.origin}: ${leak.history.join(' → ')}`,
      );
    }
  }

  setLargeLists(lists: LargeList[]): void {
    if (!sameJson(this.largeLists(), lists)) this.largeLists.set(lists);
    for (const list of lists) {
      this.warnOnce(
        `list:${list.selector}`,
        `[probe] Unvirtualized list: ${list.selector} (${list.children} elements)`,
      );
    }
  }

  /** Copia los contadores crudos a signals. */
  publish(now = performance.now()): void {
    const filled = Math.min(this.tickCount, RING_SIZE);
    let sum = 0;
    let lastSecond = 0;
    for (let i = 0; i < filled; i++) {
      sum += this.tickDurations[i];
      if (now - this.tickTimes[i] <= 1000) lastSecond++;
    }
    const ticks: TickStats = {
      count: this.tickCount,
      slow: this.slowTicks,
      maxMs: round(this.maxTick),
      avgMs: filled ? round(sum / filled) : 0,
      perSecond: lastSecond,
    };
    if (!sameJson(this.ticks(), ticks)) this.ticks.set(ticks);

    const dups = [...this.duplicates.values()].sort((a, b) => b.count - a.count).map((d) => ({ ...d }));
    if (!sameJson(this.duplicateRequests(), dups)) this.duplicateRequests.set(dups);
  }

  report(): ProbeReport {
    this.publish();
    return {
      generatedAt: new Date().toISOString(),
      url: typeof location !== 'undefined' ? location.href : '',
      ticks: this.ticks(),
      duplicateRequests: this.duplicateRequests(),
      subscriptionLeaks: this.subscriptionLeaks(),
      liveSubscriptions: this.liveSubscriptions(),
      largeLists: this.largeLists(),
    };
  }

  reset(): void {
    this.tickDurations.fill(0);
    this.tickTimes.fill(0);
    this.tickCursor = this.tickCount = this.slowTicks = this.maxTick = 0;
    this.duplicates.clear();
    this.warned.clear();
    this.publish();
  }

  private warnOnce(key: string, message: string): void {
    if (!this.options.console || this.warned.has(key)) return;
    this.warned.add(key);
    console.warn(message);
  }
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
