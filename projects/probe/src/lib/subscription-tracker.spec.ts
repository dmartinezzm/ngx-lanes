import { Subject, interval, map, of, switchMap } from 'rxjs';
import { SubscriptionTracker, isGrowing, originFromStack } from './subscription-tracker';

describe('isGrowing', () => {
  it('exige crecimiento estricto en las últimas n instantáneas', () => {
    expect(isGrowing([1, 2, 3, 4], 3)).toBe(true);
    expect(isGrowing([1, 2, 2, 4], 3)).toBe(false);
    expect(isGrowing([2, 3], 3)).toBe(false);
    expect(isGrowing([9, 1, 2, 3], 2)).toBe(true);
  });
});

describe('originFromStack', () => {
  it('salta los marcos de rxjs y devuelve el primero de la app', () => {
    const stack = [
      'Error',
      '    at probeTrackedSubscribe (http://localhost:4200/chunk-PROBE.js:10:5)',
      '    at Observable.pipe (http://localhost:4200/@fs/x/node_modules/.vite/deps/rxjs.js:200:1)',
      '    at _OrdersPage.ngOnInit (http://localhost:4200/main.js:42:17)',
    ].join('\n');
    expect(originFromStack(stack)).toBe('_OrdersPage.ngOnInit (main.js:42)');
  });

  it('devuelve "unknown" sin pila', () => {
    expect(originFromStack(undefined)).toBe('unknown');
  });
});

describe('SubscriptionTracker', () => {
  let tracker: SubscriptionTracker;

  beforeEach(() => {
    tracker = new SubscriptionTracker();
    tracker.install();
  });

  afterEach(() => tracker.uninstall());

  it('cuenta suscripciones vivas y las descuenta al cancelar', () => {
    const subject = new Subject<number>();
    const a = subject.subscribe();
    const b = subject.subscribe();
    expect(tracker.liveCount).toBe(2);
    a.unsubscribe();
    expect(tracker.liveCount).toBe(1);
    b.unsubscribe();
    expect(tracker.liveCount).toBe(0);
  });

  it('no cuenta observables que completan de inmediato', () => {
    of(1, 2, 3)
      .pipe(map((x) => x * 2))
      .subscribe();
    expect(tracker.liveCount).toBe(0);
  });

  it('no cuenta las suscripciones internas de los operadores', () => {
    const subject = new Subject<number>();
    const sub = subject
      .pipe(
        map((x) => x),
        switchMap(() => of(1)),
      )
      .subscribe();
    expect(tracker.liveCount).toBe(1);
    sub.unsubscribe();
  });

  it('marca como fuga un origen que crece en cada instantánea', () => {
    const leaky = () => interval(1_000_000).subscribe(); // nunca se cancela
    const subs = [];
    for (let i = 0; i < 4; i++) {
      subs.push(leaky());
      const leaks = tracker.snapshot(3);
      if (i < 3) expect(leaks).toEqual([]);
      else expect(leaks.length).toBe(1);
    }
    subs.forEach((s) => s.unsubscribe());
  });

  it('detecta la fuga alternando entre dos páginas (compara visitas a la misma URL)', () => {
    const subs = [];
    let leaks: ReturnType<SubscriptionTracker['snapshot']> = [];
    for (let visit = 0; visit < 4; visit++) {
      subs.push(interval(1_000_000).subscribe()); // la página con errores deja una suscripción viva
      leaks = tracker.snapshot(3, '/errors');
      leaks = tracker.snapshot(3, '/');
    }
    expect(leaks.length).toBe(1);
    expect(leaks[0].history).toEqual([1, 2, 3, 4]);
    subs.forEach((s) => s.unsubscribe());
  });

  it('no marca un origen estable', () => {
    const subject = new Subject<void>();
    const sub = subject.subscribe();
    for (let i = 0; i < 5; i++) expect(tracker.snapshot(3)).toEqual([]);
    sub.unsubscribe();
  });
});
