import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { PROBE_PANEL_ATTR } from './dom-scanner';
import { ProbeStore } from './probe-store';

@Component({
  selector: 'probe-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { [PROBE_PANEL_ATTR]: '', role: 'complementary', 'aria-label': 'Probe: Angular runtime performance' },
  template: `
    <button
      type="button"
      class="badge"
      [class.alert]="issues() > 0"
      (click)="open.set(!open())"
      [attr.aria-expanded]="open()"
    >
      Probe · {{ issues() === 0 ? 'no issues' : issues() + (issues() === 1 ? ' issue' : ' issues') }}
    </button>
    @if (open()) {
      <section class="body">
        <h2>Change detection</h2>
        <p>
          {{ store.ticks().count }} cycles · {{ store.ticks().perSecond }}/s · avg {{ store.ticks().avgMs }} ms · max
          {{ store.ticks().maxMs }} ms ·
          <strong [class.bad]="store.ticks().slow > 0">{{ store.ticks().slow }} slow</strong>
        </p>

        <h2>RxJS subscriptions</h2>
        <p>{{ store.liveSubscriptions() }} live</p>
        @for (leak of store.subscriptionLeaks(); track leak.origin) {
          <p class="bad">
            <code>{{ leak.origin }}</code> keeps growing: {{ leak.history.join(' → ') }}
          </p>
        } @empty {
          <p class="muted">No leaks found (measured on navigation).</p>
        }

        <h2>Duplicate HTTP requests</h2>
        @for (dup of store.duplicateRequests(); track dup.key) {
          <p class="bad">
            <code>{{ dup.key }}</code> · {{ dup.count }} {{ dup.count === 1 ? 'duplicate' : 'duplicates' }}
          </p>
        } @empty {
          <p class="muted">None.</p>
        }

        <h2>Unvirtualized lists</h2>
        @for (list of store.largeLists(); track list.selector) {
          <p class="bad">
            <code>{{ list.selector }}</code> · {{ list.children }} elements
          </p>
        } @empty {
          <p class="muted">None.</p>
        }

        <div class="actions">
          <button type="button" (click)="copyReport()">{{ copied() ? 'Copied' : 'Copy JSON report' }}</button>
          <button type="button" (click)="store.reset()">Reset</button>
        </div>
      </section>
    }
  `,
  styles: `
    :host {
      position: fixed;
      right: 12px;
      bottom: 12px;
      z-index: 2147483000;
      max-width: min(420px, calc(100vw - 24px));
      font:
        12px/1.45 system-ui,
        sans-serif;
      color: #111827;
    }
    .badge {
      display: block;
      margin-left: auto;
      padding: 6px 12px;
      border: 1px solid #d1d5db;
      border-radius: 999px;
      background: #ffffff;
      color: #065f46;
      font: inherit;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 1px 4px rgb(0 0 0 / 0.15);
    }
    .badge.alert {
      color: #ffffff;
      background: #b91c1c;
      border-color: #b91c1c;
    }
    .body {
      margin-top: 8px;
      padding: 10px 14px;
      max-height: 60vh;
      overflow: auto;
      background: #ffffff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
    }
    h2 {
      margin: 10px 0 2px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #4b5563;
    }
    h2:first-child {
      margin-top: 0;
    }
    p {
      margin: 2px 0;
      word-break: break-word;
    }
    code {
      font-size: 11px;
    }
    .bad {
      color: #b91c1c;
    }
    .muted {
      color: #6b7280;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 10px;
    }
    .actions button {
      font: inherit;
      padding: 4px 10px;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      background: #f9fafb;
      cursor: pointer;
    }
  `,
})
export class ProbePanel {
  protected readonly store = inject(ProbeStore);
  protected readonly open = signal(false);
  protected readonly copied = signal(false);

  protected readonly issues = computed(
    () =>
      (this.store.ticks().slow > 0 ? 1 : 0) +
      this.store.subscriptionLeaks().length +
      this.store.duplicateRequests().length +
      this.store.largeLists().length,
  );

  protected async copyReport(): Promise<void> {
    const json = JSON.stringify(this.store.report(), null, 2);
    try {
      await navigator.clipboard.writeText(json);
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1500);
    } catch {
      console.log(json);
    }
  }
}
