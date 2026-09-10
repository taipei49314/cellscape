'use strict';
/* T-303 刀 1.3：cellscape 效能基準（pool CI 用；Playwright + Chromium headless）。
   誠實邊界：CI runner 是軟體渲染環境——數字是「跨 run 的相對回歸基準」，
   不是實機效能宣稱（實機 FPS／熱行為仍屬另外驗收範圍）。
   只在災難性退化（< 2 fps）或頁面錯誤時判 FAIL；其餘記錄數字。 */
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const BASE = process.env.BASE_URL || 'http://127.0.0.1:8643';
const SAMPLE_MS = 8000;

(async () => {
  const browser = await chromium.launch();
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
    const t0 = performance.now();
    const loop = () => {
      frames++;
      if (performance.now() - t0 < ms) requestAnimationFrame(loop);
      else res({ frames, wallMs: performance.now() - t0 });
    };
    requestAnimationFrame(loop);
  }), SAMPLE_MS);

  const fps = sample.frames / (sample.wallMs / 1000);
  const ticks = await page.evaluate(() => {
    const m = document.body.innerText.match(/tick (\d+)/);
    return m ? Number(m[1]) : 0;
  });
  await browser.close();

  const out = {
    kind: 'cellscape-perf-baseline',
    date: new Date().toISOString(),
    env: 'pool self-hosted, headless chromium (software rendering) — relative regression baseline, NOT real-machine performance',
    sampleMs: SAMPLE_MS,
    frames: sample.frames,
    fps: Number(fps.toFixed(2)),
    ticksAdvanced: ticks,
    pageErrors,
    pass: fps >= 2 && pageErrors.length === 0
  };
  const dest = path.join(__dirname, '..', 'docs', 'verification', 'perf-latest.json');
  fs.writeFileSync(dest, JSON.stringify(out, null, 1) + '\n');
  console.log(JSON.stringify(out, null, 1));
  process.exit(out.pass ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
