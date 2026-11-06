import { InjectionToken } from '@angular/core';

export interface ProbeOptions {
  /** Activa la sonda. Por defecto, solo en modo desarrollo. */
  enabled: boolean;
  /** Muestra el panel flotante. */
  overlay: boolean;
  /** Un ciclo de change detection más largo que esto cuenta como lento (ms). */
  slowTickMs: number;
  /** Un elemento con al menos estos hijos directos cuenta como lista sin virtualizar. */
  largeListThreshold: number;
  /** Dos GET idénticos dentro de esta ventana cuentan como duplicados (ms). */
  duplicateWindowMs: number;
  /** Instantáneas seguidas con crecimiento para marcar una fuga de suscripciones. */
  leakSnapshots: number;
  /** Espera tras cada navegación antes de contar suscripciones vivas (ms). */
  snapshotDelayMs: number;
  /** Cada cuánto se revisa el DOM y se publican métricas (ms). */
  scanIntervalMs: number;
  /** Escribe avisos en consola la primera vez que aparece cada problema. */
  console: boolean;
}

export const DEFAULT_PROBE_OPTIONS: ProbeOptions = {
  enabled: true,
  overlay: true,
  slowTickMs: 16,
  largeListThreshold: 300,
  duplicateWindowMs: 1000,
  leakSnapshots: 3,
  snapshotDelayMs: 800,
  scanIntervalMs: 2000,
  console: true,
};

export const PROBE_OPTIONS = new InjectionToken<ProbeOptions>('PROBE_OPTIONS', {
  providedIn: 'root',
  factory: () => DEFAULT_PROBE_OPTIONS,
});
