// Runs the benchmark in headless Chrome and writes results.json and results.md.
// Usage: npm run build && npm run bench -- [--runs 5] [--chrome /path/to/chrome]
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const RUNS = Number(arg('runs', 5));
const CHROME = arg('chrome', process.env.CHROME_PATH ?? '/usr/bin/google-chrome');
const LIBS = ['lanes', 'ngx-gantt', 'schedula'];
const CPU_RATES = [1, 4];
const VIEWPORT = { width: 1400, height: 850 };
const ROOT = 'dist/bench/browser';
const BAR_TEXT = /^(Maintenance|Route|Booking|Shift|Inspection) \d+$/;

// --- Static server for the built app ---
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const server = createServer((req, res) => {
  let file = join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(ROOT, 'index.html');
  res.writeHead(200, { 'content-type': types[extname(file)] ?? 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

async function runOnce(browser, lib, cpuRate) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });

  await page.goto(`http://localhost:${port}/?lib=${lib}`, { waitUntil: 'commit', timeout: 300_000 });
  // Ready = first bar label painted, then two animation frames.
  await page.waitForFunction(
    (src) => {
      const re = new RegExp(src);
      for (const el of document.querySelectorAll('body *')) {
        if (el.childElementCount === 0 && re.test(el.textContent.trim())) return true;
      }
      return false;
    },
    BAR_TEXT.source,
    { timeout: 300_000, polling: 'raf' },
  );
  const loadMs = await page.evaluate(
    () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now())))),
  );
  await page.waitForTimeout(500);

  const domNodes = await page.evaluate(() => document.getElementsByTagName('*').length);

  // Record frame intervals and long tasks while scrolling with the mouse wheel.
  await page.evaluate(() => {
    window.__frames = [];
    window.__longTasks = 0;
    window.__recording = true;
    let last = performance.now();
    const tick = (t) => {
      window.__frames.push(t - last);
      last = t;
      if (window.__recording) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) window.__longTasks += e.duration;
    }).observe({ type: 'longtask' });
  });

  await page.mouse.move(VIEWPORT.width * 0.6, VIEWPORT.height * 0.55);
  const before = await page.screenshot();
  for (let i = 0; i < 80; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(16);
  }
  const afterVertical = await page.screenshot();
  for (let i = 0; i < 40; i++) {
    await page.mouse.wheel(120, 0);
    await page.waitForTimeout(16);
  }
  const afterHorizontal = await page.screenshot();
  await page.waitForTimeout(300);

  const { frames, longTasks } = await page.evaluate(() => {
    window.__recording = false;
    return { frames: window.__frames.slice(1), longTasks: window.__longTasks };
  });
  await context.close();

  return {
    loadMs,
    domNodes,
    frameP50: median(frames),
    frameP95: [...frames].sort((a, b) => a - b)[Math.floor(frames.length * 0.95)],
    slowFramesPct: (frames.filter((f) => f > 33.4).length / frames.length) * 100,
    longTaskMs: longTasks,
    scrolledVertically: !before.equals(afterVertical),
    scrolledHorizontally: !afterVertical.equals(afterHorizontal),
    errors,
  };
}

const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
const results = [];
for (const cpuRate of CPU_RATES) {
  for (const lib of LIBS) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await runOnce(browser, lib, cpuRate));
    const summary = {
      lib,
      cpuRate,
      runs: RUNS,
      loadMs: round(median(runs.map((r) => r.loadMs)), 0),
      domNodes: median(runs.map((r) => r.domNodes)),
      frameP50: round(median(runs.map((r) => r.frameP50))),
      frameP95: round(median(runs.map((r) => r.frameP95))),
      slowFramesPct: round(median(runs.map((r) => r.slowFramesPct))),
      longTaskMs: round(median(runs.map((r) => r.longTaskMs)), 0),
      scrolledVertically: runs.every((r) => r.scrolledVertically),
      scrolledHorizontally: runs.every((r) => r.scrolledHorizontally),
      errors: [...new Set(runs.flatMap((r) => r.errors))],
    };
    results.push(summary);
    console.log(JSON.stringify(summary));
  }
}
const version = browser.version();
await browser.close();
server.close();

writeFileSync('results.json', JSON.stringify({ date: new Date().toISOString(), chrome: version, viewport: VIEWPORT, results }, null, 2));

const names = { lanes: 'ngx-lanes 0.1.1', 'ngx-gantt': '@worktile/gantt 22.0.0', schedula: 'schedula-core-angular 1.4.0' };
let md = '';
for (const cpuRate of CPU_RATES) {
  md += `\n### CPU ${cpuRate === 1 ? 'without throttling' : `throttled ${cpuRate}×`}\n\n`;
  md += '| Library | Load (ms) | DOM nodes | Frame p50 / p95 (ms) | Slow frames | Long tasks while scrolling (ms) | Wheel scroll |\n';
  md += '| --- | --- | --- | --- | --- | --- | --- |\n';
  for (const r of results.filter((x) => x.cpuRate === cpuRate)) {
    const wheel = r.scrolledVertically && r.scrolledHorizontally ? 'both axes' : r.scrolledVertically ? 'vertical only' : 'none';
    md += `| ${names[r.lib]} | ${r.loadMs.toLocaleString('en-US')} | ${r.domNodes.toLocaleString('en-US')} | ${r.frameP50} / ${r.frameP95} | ${r.slowFramesPct}% | ${r.longTaskMs.toLocaleString('en-US')} | ${wheel} |\n`;
  }
}
writeFileSync('results.md', md.trimStart());
console.log('\n' + md);
