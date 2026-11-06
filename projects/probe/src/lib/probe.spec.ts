import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApplicationRef, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { findLargeLists, selectorFor } from './dom-scanner';
import { probeHttpInterceptor, resetProbeHttpState } from './http';
import { DEFAULT_PROBE_OPTIONS, PROBE_OPTIONS } from './options';
import { ProbeStore } from './probe-store';
import { installTickMonitor } from './tick-monitor';

describe('findLargeLists', () => {
  it('encuentra elementos con muchos hijos y genera un selector legible', () => {
    document.body.innerHTML = `
      <app-orders><div class="table x"><ul id="big"></ul><ol class="small"></ol></div></app-orders>
    `;
    const big = document.getElementById('big')!;
    for (let i = 0; i < 500; i++) big.appendChild(document.createElement('li'));
    for (let i = 0; i < 5; i++) document.querySelector('ol')!.appendChild(document.createElement('li'));

    const lists = findLargeLists(document.body, 300);
    expect(lists).toEqual([{ selector: 'ul#big', children: 500 }]);
    expect(selectorFor(document.querySelector('ol')!)).toBe('app-orders > div.table.x > ol.small');
  });

  it('ignora el propio panel de Probe', () => {
    document.body.innerHTML = '<probe-panel data-probe-panel><ul></ul></probe-panel>';
    const ul = document.querySelector('ul')!;
    for (let i = 0; i < 400; i++) ul.appendChild(document.createElement('li'));
    expect(findLargeLists(document.body, 300)).toEqual([]);
  });
});

describe('ProbeStore', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [{ provide: PROBE_OPTIONS, useValue: { ...DEFAULT_PROBE_OPTIONS, console: false } }],
    });
  });

  it('publica estadísticas de ciclos', () => {
    const store = TestBed.inject(ProbeStore);
    const now = 10_000;
    store.recordTick(5, now - 100);
    store.recordTick(30, now - 50);
    store.recordTick(2, now - 5000);
    store.publish(now);
    expect(store.ticks()).toEqual({ count: 3, slow: 1, maxMs: 30, avgMs: 12.3, perSecond: 2 });
  });

  it('el informe incluye duplicados y se reinicia', () => {
    const store = TestBed.inject(ProbeStore);
    store.recordDuplicate('GET /api/x');
    store.recordDuplicate('GET /api/x');
    expect(store.report().duplicateRequests[0]).toMatchObject({ key: 'GET /api/x', count: 2 });
    store.reset();
    expect(store.report().duplicateRequests).toEqual([]);
  });
});

describe('probeHttpInterceptor', () => {
  beforeEach(() => {
    resetProbeHttpState();
    TestBed.configureTestingModule({
      providers: [
        { provide: PROBE_OPTIONS, useValue: { ...DEFAULT_PROBE_OPTIONS, console: false } },
        provideHttpClient(withInterceptors([probeHttpInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  it('detecta dos GET idénticos en vuelo a la vez', () => {
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    http.get('/api/users', { params: { page: 1 } }).subscribe();
    http.get('/api/users', { params: { page: 1 } }).subscribe();
    ctrl.match('/api/users?page=1').forEach((r) => r.flush([]));

    const store = TestBed.inject(ProbeStore);
    store.publish();
    expect(store.duplicateRequests()).toEqual([expect.objectContaining({ key: 'GET /api/users?page=1', count: 1 })]);
  });

  it('no marca peticiones distintas ni POST', () => {
    const http = TestBed.inject(HttpClient);
    const ctrl = TestBed.inject(HttpTestingController);
    http.get('/api/a').subscribe();
    http.get('/api/b').subscribe();
    http.post('/api/a', {}).subscribe();
    http.post('/api/a', {}).subscribe();
    ctrl.match(() => true).forEach((r) => r.flush({}));

    const store = TestBed.inject(ProbeStore);
    store.publish();
    expect(store.duplicateRequests()).toEqual([]);
  });
});

@Component({ template: `{{ value() }}` })
class Counter {
  readonly value = signal(0);
}

describe('installTickMonitor', () => {
  it('mide los ciclos de change detection reales de la app', async () => {
    TestBed.configureTestingModule({
      providers: [{ provide: PROBE_OPTIONS, useValue: { ...DEFAULT_PROBE_OPTIONS, console: false } }],
    });
    const store = TestBed.inject(ProbeStore);
    const restore = installTickMonitor(TestBed.inject(ApplicationRef), store);

    const fixture = TestBed.createComponent(Counter);
    fixture.autoDetectChanges();
    await fixture.whenStable();
    fixture.componentInstance.value.set(1);
    await fixture.whenStable();
    restore();

    store.publish();
    expect(store.ticks().count).toBeGreaterThan(0);
    expect(fixture.nativeElement.textContent).toBe('1');
  });
});
