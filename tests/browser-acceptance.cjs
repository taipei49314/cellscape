'use strict';
/* T-303 刀 1.2：cellscape 瀏覽器驗收（pool CI 用；Playwright + Chromium）。
   斷言 README 動線的最小契約；主機以 BASE_URL 指向靜態 server。
   這是自動化驗收，不是完整產品驗證（部署／生物學仍屬另外範圍）。 */
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
    try { return await chromium.launch(opt); }
    catch (e) { lastErr = e; }
  }
  throw lastErr;
}
const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass: !!pass, detail: detail || '' });
  console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '   ' + detail : ''));
};

(async () => {
  const browser = await launchBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const url = (m.location() && m.location().url) || '';
    if (/favicon/i.test(url)) return;   // 瀏覽器自動請求 favicon 的 404 屬良性噪聲
    pageErrors.push('console: ' + m.text());
  });

  /* ---------- loop.html ---------- */
  let lastGoto;
  for (let i = 0; i < 8; i++) {
    try {
      await page.goto(BASE + '/loop.html', { waitUntil: 'domcontentloaded', timeout: 8000 });
      lastGoto = null;
      break;
    } catch (e) {
      lastGoto = e;
      await page.waitForTimeout(500);
    }
  }
  if (lastGoto) throw lastGoto;
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  check('loop-loads', /CELLSCAPE/i.test(await page.title()), await page.title());
  check('loop-no-errors-so-far', pageErrors.length === 0, pageErrors.join(' | '));

  await page.getByRole('button', { name: /跟著一顆紅血球|Follow a red blood cell/ }).click();
  await page.waitForTimeout(1200);
  check('follow-starts-inspector', (await page.locator('#atlasBody').count()) === 1
    && /紅血球|Red Blood Cell/.test(await page.locator('#atlasBody').innerText()));
  check('param-panel-yields-on-follow', await page.locator('#paramPanel').evaluate((el) => {
    const st = getComputedStyle(el);
    return el.classList.contains('closed') || st.pointerEvents === 'none' || st.visibility === 'hidden';
  }));
  check('stock-hud-visible', await page.locator('#stockHud').isVisible()
    && /%/.test(await page.locator('#statAlv').innerText()));
  check('anemia-slider-present', (await page.locator('#paramPanel input[data-key=anemia]').count()) === 1);

  const tick = () => page.evaluate(() => Number((/tick (\d+)/.exec(document.querySelector('#perfBadge') ? document.body.innerText : '') || [])[1] || 0));
  const t1 = await page.evaluate(() => window.CSL && document.body.innerText.match(/tick (\d+)/) ? Number(document.body.innerText.match(/tick (\d+)/)[1]) : 0);
  await page.waitForTimeout(2000);
  const t2 = await page.evaluate(() => document.body.innerText.match(/tick (\d+)/) ? Number(document.body.innerText.match(/tick (\d+)/)[1]) : 0);
  check('model-advances', t2 > t1, `tick ${t1} -> ${t2}`);

  /* 搜尋：EN 別名可命中 */
  await page.locator('#atlasSearch').fill('RBC');
  await page.waitForTimeout(600);
  const hits = await page.locator('#atlasBody').innerText();
  check('search-hits-en-alias', /Red Blood Cell|紅血球/.test(hits));
  await page.locator('#atlasSearch').fill('');

  check('temperature-slider-present', (await page.locator('#paramPanel input[data-key=temperature]').count()) === 1);

  /* 主迴圈吞掉的例外：main.js 把 step/render 的錯誤收進 window.__loopErrors，
     pageerror 監聽看不到，這裡直接讀。 */
  check('loop-no-swallowed-errors', ((await page.evaluate(() => (window.__loopErrors || []).slice())) || []).length === 0,
    JSON.stringify(await page.evaluate(() => (window.__loopErrors || []).slice())));

  /* T-379：切探索後開參數、拉低肺端供氧，A 基線滑桿須顯示基線而非介入值 */
  await page.locator('#exploreBtn').click();
  await page.locator('#paramToggle').click();
  await page.waitForTimeout(400);
  await page.locator('#paramPanel input[data-key=lungSupply]').fill('0.25');
  await page.waitForTimeout(500);
  await page.locator('#abToggle').click();
  await page.waitForTimeout(400);
  const aLung = await page.locator('#paramPanel input[data-key=lungSupply]').inputValue();
  check('ab-slider-follows-displayed-branch', Number(aLung) >= 0.8, 'A lungSupply=' + aLung);
  await page.locator('#abToggle').click();
  await page.waitForTimeout(300);

  /* EN 切換：殼層字串換成英文，且切回不留殘留 */
  await page.locator('#langToggle').click();
  await page.waitForTimeout(800);
  const enText = await page.locator('#atlasBody').innerText();
  const enTab = await page.locator('body').innerText();
  check('en-toggle-switches-shell', /Right now|How it works|Know it/.test(enTab), enTab.slice(0, 60).replace(/\s+/g, ' '));
  check('en-claims-have-no-missing-key', !/undefined/.test(enText));
  await page.locator('#langToggle').click();
  await page.waitForTimeout(600);
  check('zh-toggle-restores', /看此刻|懂機制|認識它/.test(await page.locator('body').innerText()));

  /* 匯出路徑：createObjectURL 被呼叫 */
  await page.evaluate(() => {
    window.__exp = 0;
    const orig = URL.createObjectURL.bind(URL);
    URL.createObjectURL = (b) => { window.__exp++; return orig(b); };
  });
  await page.locator('#btnExport').click();
  await page.waitForTimeout(600);
  check('export-path-fires', (await page.evaluate(() => window.__exp)) >= 1);

  /* ---------- index.html（T-378：根入口是品牌登陸，不是舊八景、也不再靜默轉址） ---------- */
  pageErrors.length = 0;
  await page.goto(BASE + '/index.html');
  await page.waitForSelector('#heroImg', { timeout: 10000 });
  await page.waitForSelector('[data-organ]', { timeout: 10000 });
  check('index-is-hero', (await page.locator('#heroImg').count()) === 1
    && (await page.locator('[data-organ]').count()) === 6);
  const cta = page.locator('a.cta');
  const ctaText = ((await cta.innerText()) || '');
  const ctaHref = (await cta.getAttribute('href')) || '';
  check('index-cta-to-atlas', /跟著一顆紅血球|Follow a red blood cell/.test(ctaText)
    && /loop\.html/.test(ctaHref), ctaText + ' ' + ctaHref);
  check('index-no-errors', pageErrors.length === 0, pageErrors.join(' | '));
  await cta.click();
  await page.waitForSelector('#followBtn, #inspector', { timeout: 10000 });
  check('index-cta-opens-atlas', /loop\.html/.test(page.url())
    && ((await page.locator('#followBtn').count()) + (await page.locator('#inspector:not(.closed)').count())) >= 1,
    page.url());

  /* ---------- museum.html（舊八景仍在，且不是 Atlas 登陸卡） ---------- */
  await page.goto(BASE + '/museum.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2500);
  check('museum-loads', /CELLSCAPE/i.test(await page.title()), await page.title());
  check('museum-is-legacy-scenes', (await page.locator('#scene').count()) === 1
    && (await page.locator('#followBtn').count()) === 0);

  // close-time 競態：Playwright 內部 navigation reject 不影響已完成的判定
  process.on('unhandledRejection', (e) => console.error('non-fatal unhandledRejection at close:', String(e)));
  await browser.close().catch(() => {});
  const fails = results.filter((r) => !r.pass).length;
  console.log(fails === 0 ? 'BROWSER ACCEPTANCE: ALL ' + results.length + ' PASS' : fails + ' FAILURES');
  process.exit(fails === 0 ? 0 : 1);
})().catch((e) => { console.error('HARNESS ERROR:', e); process.exit(2); });
