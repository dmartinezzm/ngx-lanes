### CPU without throttling

| Library | Load (ms) | DOM nodes | Frame p50 / p95 (ms) | Slow frames | Long tasks while scrolling (ms) | Wheel scroll |
| --- | --- | --- | --- | --- | --- | --- |
| ngx-lanes 0.1.1 | 145 | 344 | 16.7 / 16.7 | 0% | 0 | both axes |
| @worktile/gantt 22.0.0 | 295 | 417 | 16.7 / 16.7 | 0% | 0 | both axes |
| schedula-core-angular 1.4.0 | 13,599 | 186,721 | 50 / 233.3 | 59.2% | 39,319 | vertical only |

### CPU throttled 4×

| Library | Load (ms) | DOM nodes | Frame p50 / p95 (ms) | Slow frames | Long tasks while scrolling (ms) | Wheel scroll |
| --- | --- | --- | --- | --- | --- | --- |
| ngx-lanes 0.1.1 | 456 | 344 | 16.7 / 16.8 | 0% | 0 | both axes |
| @worktile/gantt 22.0.0 | 1,067 | 417 | 16.7 / 49.9 | 6.6% | 1,360 | both axes |
| schedula-core-angular 1.4.0 | 65,643 | 186,721 | 216.7 / 1100 | 100% | 158,713 | vertical only |
