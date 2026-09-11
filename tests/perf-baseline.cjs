'use strict';
/* T-303 刀 1.3：cellscape 效能基準（pool CI 用；Playwright + Chromium headless）。
   誠實邊界：CI runner 是軟體渲染環境——數字是「跨 run 的相對回歸基準」，
   不是實機效能宣稱（實機 FPS／熱行為仍屬另外驗收範圍）。
   只在災難性退化（< 2 fps）或頁面錯誤時判 FAIL；其餘記錄數字。 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8643';

/* pool 主機以既有 Edge/Chrome channel 啟動（不下載瀏覽器）；
   全部失敗才退回 playwright 預設 chromium。 */
async function launchBrowser() {
  const attempts = [
    { channel: 'msedge', headless: true },
    { channel: 'chrome', headless: true },
    { headless: true },
  ];
  let lastErr;
  for (const opt of attempts) {
    try { return { browser: await chromium.launch(opt), channel: opt.channel || 'playwright-chromium' }; }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}
const SAMPLE_MS = 8000;
const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : null);

(async () => {
  const launched = await launchBrowser();
  const browser = launched.browser;
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));

  await page.goto(BASE + '/loop.html');
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(() => {
    window.addEventListener('error', (e) => window.__perfErrors = (window.__perfErrors || 0) + 1);
  });
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /跟著一顆紅血球|Follow a red blood cell/ }).click();
  await page.waitForTimeout(1500);

  const sample = await page.evaluate((ms) => new Promise((res) => {
    let frames = 0;
    const deltas = [];
    const t0 = performance.now();
    let prev = t0;
    const loop = () => {
      const now = performance.now();
      frames++;
      deltas.push(now - prev);
      prev = now;
      if (now - t0 < ms) requestAnimationFrame(loop);
      else res({ frames, wallMs: performance.now() - t0, deltas });
    };
    requestAnimationFrame(loop);
  }), SAMPLE_MS);
  const env = await page.evaluate(() => {
    let renderer = 'unavailable';
    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
      if (gl && ext) renderer = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL));
      else if (gl) renderer = String(gl.getParameter(gl.RENDERER));
    } catch (e) { renderer = 'error: ' + String(e); }
    return { renderer, ua: navigator.userAgent, perfLog: window.__perfLog || null,
             loopErrors: (window.__loopErrors || []).length };
  });

  const fps = sample.frames / (sample.wallMs / 1000);
  const ticks = await page.evaluate(() => {
    const m = document.body.innerText.match(/tick (\d+)/);
    return m ? Number(m[1]) : 0;
  });
  // close-time 競態：Playwright 內部 navigation reject 不影響已完成的判定
  process.on('unhandledRejection', (e) => console.error('non-fatal unhandledRejection at close:', String(e)));
  await browser.close().catch(() => {});

  const sortedDeltas = sample.deltas.slice(1).sort((a, b) => a - b);   // 首幀間隔含啟動抖動
  const out = {
    kind: 'cellscape-perf-baseline',
    date: new Date().toISOString(),
    env: 'pool self-hosted, headless chromium (software rendering) — relative regression baseline, NOT real-machine performance',
    sampleMs: SAMPLE_MS,
    frames: sample.frames,
    fps: Number(fps.toFixed(2)),
    frameMs: {
      p50: sortedDeltas.length ? Number(pct(sortedDeltas, 0.50).toFixed(2)) : null,
      p95: sortedDeltas.length ? Number(pct(sortedDeltas, 0.95).toFixed(2)) : null,
      max: sortedDeltas.length ? Number(sortedDeltas[sortedDeltas.length - 1].toFixed(2)) : null,
      samples: sortedDeltas.length,
    },
    appPerfLog: env.perfLog,          // 產品自己的 #perfBadge 量測（median / p95 / samples）
    browser: { channel: launched.channel, userAgent: env.ua, renderer: env.renderer },
    ticksAdvanced: ticks,
    loopErrors: env.loopErrors,
    pageErrors,
    note: 'vsync 鎖在 60fps 時 fps 會飽和；判退化請看 frameMs.p95 與 appPerfLog，不要只看 fps。門檻仍只擋災難性退化。',
    pass: fps >= 2 && pageErrors.length === 0 && env.loopErrors === 0
  };
  const dest = path.join(__dirname, '..', 'docs', 'verification', 'perf-latest.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
  process.exit(out.pass ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
