import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { PROBE_OPTIONS } from './options';
import { ProbeStore } from './probe-store';

const inFlight = new Map<string, number>();
const lastSeen = new Map<string, number>();

/**
 * Detecta GET y HEAD idénticos en vuelo a la vez o repetidos dentro de `duplicateWindowMs`.
 * Regístralo con `provideHttpClient(withInterceptors([probeHttpInterceptor]))`.
 */
export const probeHttpInterceptor: HttpInterceptorFn = (req, next) => {
  const options = inject(PROBE_OPTIONS);
  if (!options.enabled || (req.method !== 'GET' && req.method !== 'HEAD')) return next(req);

  const store = inject(ProbeStore);
  const key = `${req.method} ${req.urlWithParams}`;
  const now = Date.now();
  const previous = lastSeen.get(key);

  if ((inFlight.get(key) ?? 0) > 0 || (previous !== undefined && now - previous < options.duplicateWindowMs)) {
    store.recordDuplicate(key, now);
  }
  lastSeen.set(key, now);
  inFlight.set(key, (inFlight.get(key) ?? 0) + 1);

  return next(req).pipe(
    finalize(() => {
      const remaining = (inFlight.get(key) ?? 1) - 1;
      if (remaining > 0) inFlight.set(key, remaining);
      else inFlight.delete(key);
    }),
  );
};

/** Solo para tests. */
export function resetProbeHttpState(): void {
  inFlight.clear();
  lastSeen.clear();
}
