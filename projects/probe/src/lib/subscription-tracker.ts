import { Observable, Subscription } from 'rxjs';
import { SubscriptionLeak } from './probe-store';

const PATCH_NAME = 'probeTrackedSubscribe';
/** Rutas de pila que no son código de la aplicación. */
const IGNORED_FRAME =
  /node_modules|\/deps\/|rxjs|@angular|polyfills|zone\.js|probe-store|subscription-tracker|probe\.mjs/;

/**
 * Cuenta las suscripciones RxJS vivas agrupadas por el punto del código que las creó.
 * Solo cuenta suscripciones "de nivel superior": las que los operadores crean internamente
 * durante otra llamada a subscribe se ignoran, para no inflar los números.
 */
export class SubscriptionTracker {
  private readonly live = new Map<Subscription, string>();
  private readonly history = new Map<string, number[]>();
  private depth = 0;
  private original: Observable<unknown>['subscribe'] | undefined;

  install(): () => void {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    const original = Observable.prototype.subscribe;
    this.original = original;
    const tracker = this;

    const patched = {
      [PATCH_NAME](this: Observable<unknown>, ...args: unknown[]): Subscription {
        const topLevel = tracker.depth === 0;
        const stack = topLevel ? new Error().stack : undefined;
        tracker.depth++;
        let subscription: Subscription;
        try {
          subscription = (original as (...a: unknown[]) => Subscription).apply(this, args);
        } finally {
          tracker.depth--;
        }
        if (topLevel && !subscription.closed) {
          tracker.live.set(subscription, originFromStack(stack));
          subscription.add(() => tracker.live.delete(subscription));
        }
        return subscription;
      },
    }[PATCH_NAME];

    Observable.prototype.subscribe = patched as Observable<unknown>['subscribe'];
    return () => this.uninstall();
  }

  uninstall(): void {
    if (this.original) Observable.prototype.subscribe = this.original;
    this.original = undefined;
  }

  get liveCount(): number {
    return this.live.size;
  }

  /**
   * Guarda cuántas suscripciones vivas hay por origen y devuelve los orígenes que crecen sin parar.
   * `context` (normalmente la URL) separa las series: se compara cada visita a una página con las
   * visitas anteriores a esa misma página, no con otras páginas.
   */
  snapshot(minSnapshots: number, context = ''): SubscriptionLeak[] {
    const counts = new Map<string, number>();
    for (const origin of this.live.values()) counts.set(origin, (counts.get(origin) ?? 0) + 1);

    const prefix = `${context}\u0000`;
    const known = [...this.history.keys()].filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length));
    for (const origin of new Set([...counts.keys(), ...known])) {
      const key = prefix + origin;
      const series = this.history.get(key) ?? [];
      series.push(counts.get(origin) ?? 0);
      if (series.length > 20) series.shift();
      this.history.set(key, series);
    }

    // Una fuga por origen, con la serie que más crece entre todas las páginas.
    const leaks = new Map<string, SubscriptionLeak>();
    for (const [key, series] of this.history) {
      if (!isGrowing(series, minSnapshots)) continue;
      const origin = key.slice(key.indexOf('\u0000') + 1);
      const history = series.slice(-minSnapshots - 1);
      const current = leaks.get(origin);
      if (!current || history.at(-1)! > current.history.at(-1)!) leaks.set(origin, { origin, history });
    }
    return [...leaks.values()].sort((a, b) => b.history.at(-1)! - a.history.at(-1)!);
  }
}

/** Crece estrictamente en las últimas `n` instantáneas. */
export function isGrowing(series: number[], n: number): boolean {
  if (series.length < n + 1) return false;
  const tail = series.slice(-(n + 1));
  return tail.every((v, i) => i === 0 || v > tail[i - 1]);
}

/** Primer marco de la pila que pertenece al código de la aplicación. */
export function originFromStack(stack: string | undefined): string {
  if (!stack) return 'unknown';
  const lines = stack.split('\n').map((l) => l.trim());
  const start = lines.findIndex((l) => l.includes(PATCH_NAME));
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('at ') || IGNORED_FRAME.test(line)) continue;
    return cleanFrame(line);
  }
  return 'unknown';
}

function cleanFrame(line: string): string {
  // "at Foo.bar (http://host/chunk-ABC.js:10:5)" → "Foo.bar (chunk-ABC.js:10)"
  const match = /^at (?:(.+?) \()?(?:.*\/)?([^/()]+?):(\d+):\d+\)?$/.exec(line);
  if (!match) return line.replace(/^at /, '');
  const [, fn, file, row] = match;
  return fn ? `${fn} (${file}:${row})` : `${file}:${row}`;
}
