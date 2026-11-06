import { ApplicationRef } from '@angular/core';
import { ProbeStore } from './probe-store';

type TickFn = () => void;

/**
 * Mide cada ciclo de change detection envolviendo el método de ApplicationRef que ejecuta
 * el planificador. En Angular 18+ es el método interno `_tick`; si no existe, se usa `tick`.
 * Solo para desarrollo: depende de un detalle interno y se revisa en cada versión mayor.
 */
export function installTickMonitor(appRef: ApplicationRef, store: ProbeStore): () => void {
  const target = appRef as unknown as Record<string, TickFn>;
  const method = typeof target['_tick'] === 'function' ? '_tick' : 'tick';
  const original = target[method];

  target[method] = function probeMeasuredTick(this: ApplicationRef) {
    const t0 = performance.now();
    try {
      return original.call(this);
    } finally {
      store.recordTick(performance.now() - t0);
    }
  } as TickFn;

  return () => {
    target[method] = original;
  };
}
