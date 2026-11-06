import {
  ApplicationRef,
  DestroyRef,
  EnvironmentInjector,
  EnvironmentProviders,
  Injectable,
  createComponent,
  inject,
  isDevMode,
  makeEnvironmentProviders,
  provideAppInitializer,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';
import { findLargeLists } from './dom-scanner';
import { DEFAULT_PROBE_OPTIONS, PROBE_OPTIONS, ProbeOptions } from './options';
import { ProbePanel } from './probe-panel';
import { ProbeReport, ProbeStore } from './probe-store';
import { SubscriptionTracker } from './subscription-tracker';
import { installTickMonitor } from './tick-monitor';

declare global {
  interface Window {
    __probe?: { report(): ProbeReport; snapshot(): void; reset(): void };
  }
}

/** Arranca y detiene todos los detectores de la sonda. */
@Injectable({ providedIn: 'root' })
export class ProbeRuntime {
  private readonly options = inject(PROBE_OPTIONS);
  private readonly store = inject(ProbeStore);
  private readonly appRef = inject(ApplicationRef);
  private readonly injector = inject(EnvironmentInjector);
  private readonly router = inject(Router, { optional: true });
  private readonly tracker = new SubscriptionTracker();
  private readonly cleanups: (() => void)[] = [];
  private started = false;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  start(): void {
    if (this.started || typeof document === 'undefined') return;
    this.started = true;

    this.cleanups.push(installTickMonitor(this.appRef, this.store));
    this.cleanups.push(this.tracker.install());

    if (this.router) {
      // Suscripción creada con el seguimiento desactivado para no contarse a sí misma.
      this.tracker.uninstall();
      let pending: ReturnType<typeof setTimeout> | undefined;
      const sub = this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe(() => {
        clearTimeout(pending);
        pending = setTimeout(() => this.snapshot(), this.options.snapshotDelayMs);
      });
      this.tracker.install();
      this.cleanups.push(() => {
        clearTimeout(pending);
        sub.unsubscribe();
      });
    }

    const interval = setInterval(() => this.scan(), this.options.scanIntervalMs);
    this.cleanups.push(() => clearInterval(interval));

    if (this.options.overlay) {
      // Tras el primer render, para no interferir con el arranque de la app.
      const timer = setTimeout(() => this.mountPanel(), 0);
      this.cleanups.push(() => clearTimeout(timer));
    }

    window.__probe = {
      report: () => this.store.report(),
      snapshot: () => this.snapshot(),
      reset: () => this.store.reset(),
    };
    this.cleanups.push(() => delete window.__probe);
  }

  stop(): void {
    while (this.cleanups.length) this.cleanups.pop()!();
    this.started = false;
  }

  /** Cuenta suscripciones vivas por origen y marca las que crecen. */
  snapshot(): void {
    const context = this.router?.url.split(/[?#]/)[0] ?? '';
    const leaks = this.tracker.snapshot(this.options.leakSnapshots, context);
    this.store.setSubscriptions(this.tracker.liveCount, leaks);
  }

  private scan(): void {
    this.store.setLargeLists(findLargeLists(document.body, this.options.largeListThreshold));
    this.store.liveSubscriptions.set(this.tracker.liveCount);
    this.store.publish();
  }

  private mountPanel(): void {
    const ref = createComponent(ProbePanel, { environmentInjector: this.injector });
    this.appRef.attachView(ref.hostView);
    document.body.appendChild(ref.location.nativeElement);
    this.cleanups.push(() => ref.destroy());
  }
}

/**
 * Activa Probe. Uso: `providers: [provideProbe()]` en app.config.ts.
 * Por defecto solo se activa en modo desarrollo.
 */
export function provideProbe(options: Partial<ProbeOptions> = {}): EnvironmentProviders {
  const merged: ProbeOptions = { ...DEFAULT_PROBE_OPTIONS, enabled: isDevMode(), ...options };
  return makeEnvironmentProviders([
    { provide: PROBE_OPTIONS, useValue: merged },
    provideAppInitializer(() => {
      if (merged.enabled) inject(ProbeRuntime).start();
    }),
  ]);
}
