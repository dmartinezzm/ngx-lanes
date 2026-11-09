# Benchmark: ngx-lanes vs ngx-gantt vs schedula-core

The same plan — **1,000 resources and 10,000 bars** — rendered by three Angular libraries, measured in headless Chrome.

## Results

On a CPU throttled 4× to approximate a modest laptop, ngx-lanes shows the plan in **0.46 s** and scrolls without a single slow frame. ngx-gantt takes 1.07 s, drops 6.6% of frames and blocks the main thread for 1.4 s while scrolling, even though it shows about a third as many bars per screen. schedula-core renders all 10,000 bars up front and takes 66 s.

#### CPU without throttling

| Library | Load (ms) | DOM nodes | Frame p50 / p95 (ms) | Slow frames | Long tasks while scrolling (ms) | Wheel scroll |
| --- | --- | --- | --- | --- | --- | --- |
| ngx-lanes 0.1.1 | 145 | 344 | 16.7 / 16.7 | 0% | 0 | both axes |
| @worktile/gantt 22.0.0 | 295 | 417 | 16.7 / 16.7 | 0% | 0 | both axes |
| schedula-core-angular 1.4.0 | 13,599 | 186,721 | 50 / 233.3 | 59.2% | 39,319 | vertical only |

#### CPU throttled 4×

| Library | Load (ms) | DOM nodes | Frame p50 / p95 (ms) | Slow frames | Long tasks while scrolling (ms) | Wheel scroll |
| --- | --- | --- | --- | --- | --- | --- |
| ngx-lanes 0.1.1 | 456 | 344 | 16.7 / 16.8 | 0% | 0 | both axes |
| @worktile/gantt 22.0.0 | 1,067 | 417 | 16.7 / 49.9 | 6.6% | 1,360 | both axes |
| schedula-core-angular 1.4.0 | 65,643 | 186,721 | 216.7 / 1100 | 100% | 158,713 | vertical only |

Measured on 2026-11-09 with Chrome 153.0.8010.12, median of 3 runs.

## What is measured

| Metric | How |
| --- | --- |
| Load | Time from navigation until the first bar label is painted, plus two animation frames. Includes downloading, parsing and the first render. |
| DOM nodes | `document.getElementsByTagName('*').length` after the first render. Fewer nodes means less memory and cheaper layout. |
| Frame p50 / p95 | Interval between animation frames while scrolling with the mouse wheel: 80 vertical steps, then 40 horizontal steps. 16.7 ms is a perfect 60 fps. |
| Slow frames | Share of frames that took longer than 33.4 ms (below 30 fps), which the eye perceives as stutter. |
| Long tasks | Total time the main thread was blocked by tasks over 50 ms while scrolling. During that time the page does not respond to input. |

Each figure is the median of 3 runs in a fresh browser context, with a 1400 × 850 viewport. "Throttled 4×" uses Chrome's CPU throttling to approximate a modest laptop.

## Setup, kept as fair as possible

- **Same data** for all three: generated with a fixed seed, bars of 4 to 64 hours with gaps of 2 to 32 hours.
- **Same density:** each library shows about 8 days per screen (140 to 175 px per day).
- **Recommended configuration:** ngx-gantt with `virtualScrollEnabled` and its `NgxGanttModule`, as its docs show; schedula-core through its official Angular wrapper with animations off.
- **Production build** (`ng build`), Angular 22.

Differences in what each library does by design, which the numbers reflect:

- **ngx-gantt** is a task Gantt: one bar per row. To show 10,000 bars it renders 10,000 rows grouped under 1,000 resource headers, so a screen holds about 35 bars where ngx-lanes holds about 110.
- **schedula-core** renders every bar up front (no virtualization) and scrolls by moving its content itself; it does not react to horizontal wheel scrolling.
- **schedula-core-angular 1.4.0** is published without entry points in its `package.json`, so it cannot be imported as is. `scripts/fix-schedula-angular.mjs` (run on `npm install`) adds them, pointing at the package's own build output; nothing else is changed.

## Run it yourself

```bash
npm install
npm run build
npm run bench -- --runs 3 --chrome "/path/to/chrome"
```

Results are written to `results.json` and `results.md`. Open `dist/bench/browser/index.html?lib=lanes` (or `ngx-gantt`, `schedula`) through any static server to look at each one.
