/*
 * API pública de Probe
 */

export { provideProbe, ProbeRuntime } from './lib/provide-probe';
export { probeHttpInterceptor } from './lib/http';
export { ProbeStore } from './lib/probe-store';
export type { ProbeReport, TickStats, DuplicateRequest, SubscriptionLeak, LargeList } from './lib/probe-store';
export type { ProbeOptions } from './lib/options';
