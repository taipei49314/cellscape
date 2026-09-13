'use strict';
/* T-366：cellscape 模擬預檢門（Gate D 輔助，非取代）。
   協議（預註冊）：docs/pregate/PROTOCOL.md；產品基準 commit c43902f2。
   四模式：
     --selftest                       評分器單元校準（無瀏覽器；壞樣本必 FAIL——fail-first 證據）
     --smoke                          主持人四步腳本流程冒煙（無 LLM）
     --calibrate [outfile]            對凍結模型實測方向表（無 LLM）
     --learner --config F [--n 5]     LLM 模擬受試者 N 回；--out 存機器紀錄
   LLM 端點/金鑰由外部設定檔注入（{baseUrl, apiKey, model}），不入庫、不入log。
   這是模擬預檢，不是五人門，也不是產品驗收；學習成效宣稱永遠不來自本檔。 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

/* ---------- 預註冊常數（與 docs/pregate/PROTOCOL.md §5 一一對應） ---------- */
const CONDS = {
  lungSupply:    { label: '肺端供氧',   markers: ['肺端供氧', '供氧', '肺端'],           up: { from: 0.85, to: 1.00 }, down: { from: 0.85, to: 0.55 } },
  flowSpeed:     { label: '循環流速',   markers: ['流速', '循環流'],                     up: { from: 1.00, to: 2.00 }, down: { from: 1.00, to: 0.50 } },
  tissueDemand:  { label: '組織需求',   markers: ['組織需求', '需求'],                   up: { from: 0.50, to: 0.80 }, down: { from: 0.50, to: 0.20 } },
  anemia:        { label: '貧血程度',   markers: ['貧血'],                               up: { from: 0.00, to: 0.30 }, down: null },
  temperature:   { label: '體溫 °C',    markers: ['體溫', '溫度', '發燒'],               up: { from: 37, to: 38 },     down: { from: 37, to: 36 } },
  perfusion:     { label: '組織灌流',   markers: ['灌流'],                               up: { from: 1.00, to: 1.50 }, down: { from: 1.00, to: 0.60 } },
  altitudeM:     { label: '海拔',       markers: ['海拔', '高地'],                       up: { from: 0, to: 3000 },    down: null },
  fluidRate:     { label: '補水速率',   markers: ['補水', '飲水'],                       up: { from: 0, to: 0.010 },   down: null },
  infection:     { label: '感染嚴重度', markers: ['感染'],                               up: { from: 0, to: 0.50 },    down: null },
  glucoseIntake: { label: '碳水攝入速率', markers: ['碳水', '攝入', '進食'],             up: { from: 0, to: 0.010 },   down: null },
};
const DIR_UP = ['拉高', '調高', '调高', '升高', '提高', '調升', '調大', '調強', '調强', '增加', '增強', '增强', '加快', '拉快', '加強', '加强', '比基線高', '高于基线', '高於基線'];
const DIR_DOWN = ['拉低', '調低', '调低', '降低', '調降', '调降', '壓低', '压低', '減少', '减少', '減弱', '减弱', '調小', '调小', '拉慢', '放慢', '比基線低', '低于基线', '低於基線'];
const SIDE_ALV = ['肺泡', '肺端側', '肺那邊', '肺那一側'];
const SIDE_TIS = ['組織'];
const SIDE_MEAN = ['平均負載', '負載'];
const EFF_UP = ['變高', '变高', '變多', '变多', '上升', '升高', '增加', '變大', '变大', '變快', '变快', '升到', '升至', '上升到', '漲到', '涨到', '跳增', '暴增', '急升'];
const EFF_DOWN = ['變低', '变低', '變少', '变少', '下降', '降低', '掉了', '變小', '变小', '變慢', '变慢', '缺氧', '降到', '降至', '跌到', '跌至', '急降'];
const EFF_FLAT = ['沒變', '没变', '沒有變', '没有变', '不變', '不变', '沒有這樣掉', '没有这样掉', '沒掉', '没掉', '沒升', '没升', '沒降', '没降', '沒有差', '没有差'];
const ACT_MARK = /(我|把|改|拉|調|调|設|设|動|动)/;
const RES_MARK = /(變|变|掉|升|降|少|多)/;
const CLINICAL = /診斷|诊断|確診|确诊|病患有|患者有|需要就醫|需要就医|治療方案|治疗方案|開藥|开药|處方|处方/;
const NEUTRAL_DISPLAY = { alv: 1.0, tis: 1.0, mean: 0.01 }; // 一個顯示步進（PROTOCOL §4 v1.1）：alv/tis 整數百分比、mean 兩位小數
const SETTLE_TICKS = 240;        // 8 模型秒
const WINDOW_TICKS = 2400;       // 觀察窗 80 模型秒（1× ≈ 80 牆鐘秒；v1.1.1）
const SPEED = 1;                 // 1×：headless 下 4× 會主線程飽和凍結（v1.1.1 實測）；速度僅呈現層，DT 不變

/* ---------- 確定性評分器（PROTOCOL §3；selftest 與 learner 共用） ---------- */
function findMarker(text, markers) { return markers.find((m) => text.includes(m)) || null; }

function clauseEffect(clause) {
  if (EFF_FLAT.some((m) => clause.includes(m))) return 'flat';
  if (EFF_DOWN.some((m) => clause.includes(m))) return 'down';
  if (EFF_UP.some((m) => clause.includes(m))) return 'up';
  return null;
}

/* verdict: { pass, codes[], details{} } —— 嚴格方向：可辨識度不足即 FAIL */
function scoreStatement(statement, action, table) {
  const codes = [];
  const details = {};
  const text = String(statement || '');

  // #1 條件可辨識（恰命中一個條件，且必須是實際改的那個）
  const hit = new Map();
  for (const [key, c] of Object.entries(CONDS)) {
    if (c.markers.some((m) => text.includes(m))) hit.set(key, true);
  }
  const hitKeys = [...hit.keys()];
  if (hitKeys.length === 0) { codes.push('no_condition'); }
  else if (hitKeys.length > 1) { codes.push('ambiguous_condition'); details.conditions = hitKeys; }
  else if (hitKeys[0] !== action.key) { codes.push('no_condition'); details.named = hitKeys[0]; details.changed = action.key; }

  // #2/#3 行動方向
  const claimDir = DIR_UP.some((m) => text.includes(m)) ? 'up' : DIR_DOWN.some((m) => text.includes(m)) ? 'down' : null;
  if (!claimDir) codes.push('no_direction');
  else if (claimDir !== action.direction) { codes.push('direction_mismatch_action'); details.claimed = claimDir; details.applied = action.direction; }

  // #4/#5 結果位置與效果方向（逐子句）
  const clauses = text.split(/[，,。；;、\n]/).map((s) => s.trim()).filter(Boolean);
  const namedSides = [];
  for (const cl of clauses) {
    const side = findMarker(cl, SIDE_ALV) ? 'alv' : findMarker(cl, SIDE_TIS) ? 'tis' : findMarker(cl, SIDE_MEAN) ? 'mean' : null;
    if (!side) continue;
    const eff = clauseEffect(cl);
    namedSides.push({ side, eff, clause: cl });
  }
  if (namedSides.length === 0) codes.push('no_where');
  const expected = table[action.key] && table[action.key][action.direction];
  if (!expected) codes.push('no_table_entry');
  for (const ns of namedSides) {
    if (!ns.eff) { codes.push('no_where'); details[ns.side + '_clause'] = ns.clause; continue; }
    const exp = expected && expected[ns.side];
    if (exp == null) { codes.push('no_table_entry'); continue; }
    if (exp === 'flat') {
      if (ns.eff !== 'flat') { codes.push('claimed_change_where_none'); details[ns.side] = ns.eff; }
    } else if (ns.eff === 'flat') {
      codes.push('reversed_or_wrong_effect'); details[ns.side] = 'claimed_flat_expected_' + exp;
    } else if (ns.eff !== exp) {
      codes.push('reversed_or_wrong_effect'); details[ns.side] = 'claimed_' + ns.eff + '_expected_' + exp;
    }
  }

  // #6 因果連接
  if (!ACT_MARK.test(text) || !RES_MARK.test(text)) codes.push('no_causal_link');

  // #7 非臨床診斷框架
  const cl = CLINICAL.exec(text);
  if (cl) { codes.push('clinical_framing'); details.clinical = cl[0]; }

  return { pass: codes.length === 0, codes: [...new Set(codes)], details };
}

/* ---------- 小工具 ---------- */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function startStaticServer(root) {
  const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png' };
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
      fs.readFile(p, (err, buf) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'content-type': MIME[path.extname(p)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    srv.listen(0, '127.0.0.1', () => resolve({ srv, port: srv.address().port }));
  });
}

async function launchBrowser() {
  const { chromium } = require('playwright');
  // headless 下 rAF 可能被節流（tick 凍結）——顯式禁用（僅影響本測試視窗，不影響產品）
  const args = ['--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding'];
  const attempts = [{ channel: 'msedge', headless: true, args }, { channel: 'chrome', headless: true, args }, { headless: true, args }];
  let lastErr;
  for (const opt of attempts) { try { return await chromium.launch(opt); } catch (e) { lastErr = e; } }
  throw lastErr;
}

async function openLoop(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(base + '/loop.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /跟著一顆紅血球|Follow a red blood cell/ }).click();
  await page.waitForTimeout(800);
  await page.locator('#speedBox2 .spd[data-spd="' + SPEED + '"]').click(); // 4×（PROTOCOL §4 v1.1）
  return { ctx, page, errors };
}

async function freshRun(browser, base, page) {
  // 單一 page reload 重置（種子固定 → 等效新鮮世界；避免反覆建 context 觸發 headless 節流）
  if (!page) return (await openLoop(browser, base)).page;
  await page.goto(base + '/loop.html');
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /跟著一顆紅血球|Follow a red blood cell/ }).click();
  await page.waitForTimeout(600);
  await page.locator('#speedBox2 .spd[data-spd="' + SPEED + '"]').click();
  return page;
}

async function tickNow(page) {
  return page.evaluate(() => {
    const el = document.querySelector('#tickN');
    const t = el ? (el.textContent || '') : '';
    const m = /(\d+)/.exec(t) || /tick (\d+)/.exec(document.body.innerText);
    return m ? Number(m[1]) : 0;
  });
}

async function waitTicks(page, n, timeoutMs) {
  const t0 = await tickNow(page);
  const deadline = Date.now() + (timeoutMs || n * 70 + 30000); // 名義 30 tick/秒，放寬 2 倍＋30 秒餘裕
  for (;;) {
    await sleep(250);
    if ((await tickNow(page)) - t0 >= n) return;
    if (Date.now() > deadline) throw new Error('waitTicks timeout (need ' + n + ' ticks from ' + t0 + ')');
  }
}

async function readStats(page) {
  return page.evaluate(() => {
    const g = (id) => (document.querySelector(id) ? document.querySelector(id).textContent.trim() : null);
    const num = (s) => (s == null ? NaN : (Number(s.replace(/[^\d.\-]/g, '')) || Number(/-?\d+\.?\d*/.exec(s)) || NaN));
    const bar = document.querySelector('#tisBar');
    return {
      alv: num(g('#statAlv')), tis: num(g('#statTis')), mean: num(g('#statMean')),
      tisBar: bar ? bar.getBoundingClientRect().width : NaN,
      badge: (document.querySelector('#branchBadge') || {}).textContent || '',
    };
  });
}

async function setCondition(page, key, to) {
  await page.evaluate(([k, v]) => {
    const el = document.querySelector('#paramPanel input[data-key=' + k + ']');
    if (!el) throw new Error('no slider ' + k);
    const proto = Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }, [key, to]);
}

async function windowMean(page) {
  const t0 = await tickNow(page);
  const deadline = Date.now() + 300000;
  while ((await tickNow(page)) - t0 < WINDOW_TICKS) {
    await readStats(page);
    await sleep(400);
    if (Date.now() > deadline) throw new Error('windowMean timeout (need ' + WINDOW_TICKS + ' ticks from ' + t0 + ')');
  }
  // 收尾取樣：取視窗末端 6 個樣本均值（settle 後讀數已穩，取樣密度足夠）
  const samples = [];
  for (let i = 0; i < 6; i++) { samples.push(await readStats(page)); await sleep(350); }
  const avg = (k) => samples.reduce((a, s) => a + (Number.isFinite(s[k]) ? s[k] : 0), 0) / samples.length;
  return { alv: avg('alv'), tis: avg('tis'), mean: avg('mean') };
}

const sig = (v, n) => (v >= n ? 'up' : v <= -n ? 'down' : 'flat');
const sig3 = (d) => ({ alv: sig(d.alv, NEUTRAL_DISPLAY.alv), tis: sig(d.tis, NEUTRAL_DISPLAY.tis), mean: sig(d.mean, NEUTRAL_DISPLAY.mean) });

/* ---------- LLM client（config.protocol：'anthropic' /v1/messages 或 'openai' /v1/chat/completions） ---------- */
async function llmCall(config, system, messages) {
  let text;
  if ((config.protocol || 'anthropic') === 'openai') {
    const res = await fetch(config.baseUrl.replace(/\/+$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...(config.apiKey ? { authorization: 'Bearer ' + config.apiKey } : {}) },
      body: JSON.stringify({ model: config.model, max_tokens: 2500, stream: false, messages: [{ role: 'system', content: system }, ...messages] }),
    });
    if (!res.ok) throw new Error('LLM HTTP ' + res.status + ': ' + (await res.text()).slice(0, 400));
    const d = await res.json();
    text = (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  } else {
    const res = await fetch(config.baseUrl.replace(/\/+$/, '') + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + config.apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: config.model, max_tokens: 700, system, messages }),
    });
    if (!res.ok) throw new Error('LLM HTTP ' + res.status + ': ' + (await res.text()).slice(0, 400));
    const d = await res.json();
    text = (d.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  }
  return { text: String(text).replace(/<think>[\s\S]*?<\/think>/g, '').trim(), usage: {} };
}

const WATCH_TICKS = 600;         // 主持人腳本第 2 步「看它走一圈」的觀看期（v1.3；20 模型秒）
const MODERATOR_LINES = [
  '1. 打開網址（本機 http://127.0.0.1:8642/ 或 loop.html）。',
  '2. 按「跟著一顆紅血球」，看它走一圈。',
  '3. 自己改一個條件。',
  '4. 看兩邊差在哪，用一句話說「你改了什麼、什麼變了」。',
].join('\n');

const LEARNER_SYSTEM = [
  '你是一位參與者，第一次使用一個互動網頁。主持人只會念一次指示，之後不會再幫你、不會回答問題。',
  '你看不到網站的程式碼，只能看到每回合轉述給你的【畫面】文字。',
  '你可以：改一個條件（只能一次；「條件」指參數面板的滑桿——肺端供氧、循環流速、組織需求、貧血程度、體溫、組織灌流、海拔、補水速率、感染嚴重度、碳水攝入速率；藥物按鈕不是條件）、切換 A/B 基線比較、或交出最後一句話結束。',
  '只用繁體中文。嚴格輸出一個 JSON 物件，不要其他文字：',
  '{"action":"set_condition","condition":"<畫面上的條件標籤原文>","direction":"up 或 down"}',
  '{"action":"toggle_ab"}',
  '{"action":"statement","text":"<你的一句話：你改了什麼、什麼變了>"}',
].join('\n');

function screenText(s) {
  return [
    String(s.tick || ''), '分支=' + s.badge,
    '參數面板：', s.panel,
    '肺泡水位=' + s.alv, '組織水位=' + s.tis, '平均負載=' + s.mean,
    '字幕：' + s.subtitle,
  ].join('\n');
}

async function snapshot(page) {
  return page.evaluate(() => {
    const g = (sel) => { const e = document.querySelector(sel); return e ? e.textContent.trim() : ''; };
    const num = (s) => (Number.isFinite(Number(s)) ? s : s);
    const panel = [...document.querySelectorAll('#paramPanel .prm')].map((row) => row.innerText.replace(/\n+/g, ' ').trim()).join('\n');
    // 徽章以「參與者實際看得到」為準：display:none 的預設文字不轉述（T-371 面板修正）
    const bb = document.querySelector('#branchBadge');
    const badge = bb && bb.offsetParent !== null ? bb.textContent.trim() : '(尚未分支)';
    return {
      tick: g('#tickN'), badge, panel,
      alv: num(g('#statAlv')), tis: num(g('#statTis')), mean: num(g('#statMean')),
      subtitle: g('#subtitle'),
    };
  });
}

async function runLearner(browser, base, config, n) {
  const table = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'pregate', 'direction-table.json'), 'utf-8'));
  const page = await freshRun(browser, base);
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  const results = [];
  for (let i = 1; i <= n; i++) {
    if (i > 1) await freshRun(browser, base, page);
    await waitTicks(page, WATCH_TICKS); // 觀看期（PROTOCOL §3.2 v1.3）：先看再動
    const messages = [{ role: 'user', content: MODERATOR_LINES + '\n\n【畫面】\n' + screenText(await snapshot(page)) }];
    const transcript = [];
    let action = null; let statement = null; let turns = 0;
    try {
      for (turns = 1; turns <= 6 && !statement; turns++) {
        const reply = await llmCall(config, LEARNER_SYSTEM, messages);
        transcript.push({ turn: turns, reply: reply.text });
        if (!reply.text) { messages.push({ role: 'assistant', content: '' }, { role: 'user', content: '請輸出你的動作 JSON。' }); continue; } // 空回覆一次性輕推（v1.2）
        let j = null;
        try { j = JSON.parse(reply.text.replace(/^[^{]*/, '').replace(/[^}]*$/, '')); } catch (e) { /* 非法 JSON 記為空轉 */ }
        if (!j || !j.action) { messages.push({ role: 'assistant', content: reply.text }, { role: 'user', content: '（無法辨識，請只輸出 JSON 動作）\n\n【畫面】\n' + screenText(await snapshot(page)) }); continue; }
        if (j.action === 'statement') { statement = String(j.text || ''); break; }
        if (j.action === 'set_condition') {
          if (action) { messages.push({ role: 'assistant', content: reply.text }, { role: 'user', content: '（你已經改過一個條件了，主持人不能再幫你；請看兩邊差在哪，交出你的一句話）\n\n【畫面】\n' + screenText(await snapshot(page)) }); continue; } // 單一條件約束（v1.2）
          const key = Object.keys(CONDS).find((k) => CONDS[k].label === j.condition || CONDS[k].markers.some((m) => (j.condition || '').includes(m)));
          const dir = j.direction === 'down' ? 'down' : 'up';
          if (!key || !CONDS[key][dir]) { messages.push({ role: 'assistant', content: reply.text }, { role: 'user', content: '（該條件或方向不可用，選別的）\n\n【畫面】\n' + screenText(await snapshot(page)) }); continue; }
          action = { key, direction: dir, from: CONDS[key][dir].from, to: CONDS[key][dir].to, label: CONDS[key].label };
          await setCondition(page, key, CONDS[key][dir].to);
          await waitTicks(page, SETTLE_TICKS + WINDOW_TICKS);
          messages.push({ role: 'assistant', content: reply.text }, { role: 'user', content: '【畫面】\n' + screenText(await snapshot(page)) });
          continue;
        }
        if (j.action === 'toggle_ab') {
          await page.locator('#abToggle').click();
          await page.waitForTimeout(600);
          messages.push({ role: 'assistant', content: reply.text }, { role: 'user', content: '【畫面】\n' + screenText(await snapshot(page)) });
        }
      }
    } catch (e) { errors.push(String(e)); }
    if (!action) { results.push({ n: i, verdict: 'FAIL', codes: ['no_condition'], note: '未改任何條件', transcript, errors }); continue; }
    if (statement == null) { results.push({ n: i, verdict: 'FAIL', codes: ['incomplete'], note: '未完成（6 回合內未交出一句話）', action, transcript, errors }); continue; }
    const v = scoreStatement(statement, action, table.directions);
    results.push({ n: i, verdict: v.pass ? 'PASS' : 'FAIL', codes: v.codes, details: v.details, action, statement, transcript, errors });
  }
  return results;
}

/* ---------- 主流程 ---------- */
(async () => {
  const argv = process.argv.slice(2);

  /* --selftest：評分器校準（無瀏覽器）。方向表若在則用之，否則用內嵌最小表（僅供 selftest）。 */
  if (argv.includes('--selftest')) {
    let table;
    try {
      table = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'docs', 'pregate', 'direction-table.json'), 'utf-8')).directions;
      console.log('selftest: 使用實測方向表 docs/pregate/direction-table.json');
    } catch (e) {
      console.error('REFUSED: direction-table.json 不存在；先跑 --calibrate。fail-first 需要實測表，不可以用未經測量的假設。');
      process.exit(2);
    }
    const good = [
      { action: { key: 'anemia', direction: 'up' }, text: '我把貧血拉高，組織那邊的氧變少了' },
      { action: { key: 'lungSupply', direction: 'down' }, text: '我把肺端供氧拉低，組織水位跟著掉了' },
      { action: { key: 'flowSpeed', direction: 'down' }, text: '我把循環流速調低，組織水位變低了' },
      { action: { key: 'altitudeM', direction: 'up' }, text: '我把海拔拉高，組織那邊的氧變少了，肺泡水位也變低了' },
      // v1.2 標記擴充的校準樣本（第 1 輪實際受試者語句；見 PROTOCOL §3.1）
      { action: { key: 'lungSupply', direction: 'down' }, text: '我將肺端供氧設為0.55（比基線低），導致平均負載從0.71降到0.69。' },
    ];
    const bad = [
      { action: { key: 'anemia', direction: 'up' }, text: '我把貧血拉高，組織的氧變多了', want: 'reversed_or_wrong_effect' },
      { action: { key: 'anemia', direction: 'up' }, text: '我把肺端供氧拉低，組織的氧變少了', want: 'no_condition' },
      { action: { key: 'anemia', direction: 'up' }, text: '這就是貧血的診斷，病患有缺氧', want: 'clinical_framing' },
      { action: { key: 'anemia', direction: 'up' }, text: '我改了貧血，組織的氧變少了', want: 'no_direction' },
      { action: { key: 'anemia', direction: 'up' }, text: 'B 分支的 load 下降，stock 變少', want: 'no_condition' },
      { action: { key: 'lungSupply', direction: 'down' }, text: '我把肺端供氧拉低，肺泡水位也變低了', want: 'claimed_change_where_none' },
      { action: { key: 'anemia', direction: 'up' }, text: '貧血程度 0.30，組織水位 0.42', want: 'no_causal_link' },
      { action: { key: 'anemia', direction: 'up' }, text: '我把貧血調整之後看兩邊', want: 'no_where' },
      { action: { key: 'anemia', direction: 'up' }, text: '我把貧血拉高，循環流速變快了', want: 'ambiguous_condition' },
    ];
    let fail = 0;
    for (const g of good) {
      const v = scoreStatement(g.text, g.action, table);
      console.log((v.pass ? 'PASS' : 'FAIL') + '  good: ' + g.text + (v.pass ? '' : '   codes=' + v.codes.join(',')));
      if (!v.pass) fail++;
    }
    for (const b of bad) {
      const v = scoreStatement(b.text, b.action, table);
      const ok = !v.pass && v.codes.includes(b.want);
      console.log((ok ? 'PASS' : 'FAIL') + '  bad→' + b.want + ': ' + b.text + (ok ? '' : '   got=' + v.codes.join(',')));
      if (!ok) fail++;
    }
    console.log(fail === 0 ? 'selftest: ALL PASS' : 'selftest: ' + fail + ' FAILURES');
    process.exit(fail === 0 ? 0 : 1);
  }

  const root = path.join(__dirname, '..');
  const { srv, port } = await startStaticServer(root);
  const base = 'http://127.0.0.1:' + port;
  let browser;
  let exitCode = 0;
  try {
    browser = await launchBrowser();

    /* --calibrate：實測方向表（PROTOCOL §4 v1.1；單一 page reload 重置） */
    if (argv.includes('--calibrate')) {
      const { page, errors } = await openLoop(browser, base);
      await waitTicks(page, SETTLE_TICKS);
      const baseline = await windowMean(page);
      console.log('baseline(alv=' + baseline.alv.toFixed(4) + ' tis=' + baseline.tis.toFixed(4) + ' mean=' + baseline.mean.toFixed(4) + ') errors=' + errors.length);
      const directions = {};
      const runVariant = async (key, c, dir, spec) => {
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            await freshRun(browser, base, page);
            await waitTicks(page, SETTLE_TICKS);
            await setCondition(page, key, spec.to);
            const m = await windowMean(page);
            const d = { alv: +(m.alv - baseline.alv).toFixed(4), tis: +(m.tis - baseline.tis).toFixed(4), mean: +(m.mean - baseline.mean).toFixed(4) };
            directions[key][dir] = { alv: sig3(d).alv, tis: sig3(d).tis, mean: sig3(d).mean, deltas: d };
            console.log(key + ' ' + dir + ' (' + spec.from + '→' + spec.to + ')  Δalv=' + d.alv + ' Δtis=' + d.tis + ' Δmean=' + d.mean + '  → ' + JSON.stringify(sig3(d)) + (attempt > 1 ? '  (attempt ' + attempt + ')' : ''));
            return;
          } catch (e) {
            console.log(key + ' ' + dir + ' attempt ' + attempt + ' failed: ' + String(e).slice(0, 120));
            if (attempt === 3) throw e;
          }
        }
      };
      for (const [key, c] of Object.entries(CONDS)) {
        directions[key] = {};
        for (const dir of ['up', 'down']) {
          const spec = c[dir];
          if (!spec) { directions[key][dir] = null; continue; }
          await runVariant(key, c, dir, spec);
        }
      }
      const outArg = argv[argv.indexOf('--calibrate') + 1];
      const out = outArg && !outArg.startsWith('--') ? outArg : undefined;
      const record = { measuredAt: new Date().toISOString(), productCommit: 'c43902f2', seed: 7, settleTicks: SETTLE_TICKS, windowTicks: WINDOW_TICKS, speed: SPEED, neutralDisplay: NEUTRAL_DISPLAY, baseline, directions };
      const file = out || path.join(root, 'docs', 'pregate', 'direction-table.json');
      fs.writeFileSync(file, JSON.stringify(record, null, 1) + '\n');
      console.log('written: ' + file);
      return;
    }

    /* --smoke：主持人四步腳本機械走查（無 LLM） */
    if (argv.includes('--smoke')) {
      const results = [];
      const check = (name, pass, detail) => { results.push({ name, pass: !!pass }); console.log((pass ? 'PASS' : 'FAIL') + '  ' + name + (detail ? '   ' + detail : '')); };
      const { page, errors } = await openLoop(browser, base);
      check('step1-loads', /CELLSCAPE/i.test(await page.title()), await page.title());
      const t0 = await tickNow(page);
      await waitTicks(page, 60);
      check('step2-follow-ticks-advance', (await tickNow(page)) - t0 >= 60);
      await waitTicks(page, SETTLE_TICKS); // 暖機（世界有長暫態；比較一律靠 A/B 鎖步分支——同相、只差介入）
      await setCondition(page, 'anemia', 0.30);
      await page.waitForTimeout(400);
      const badge = (await readStats(page)).badge;
      check('step3-branch-created', /B/.test(badge), badge);
      await waitTicks(page, SETTLE_TICKS + WINDOW_TICKS);
      const after = await readStats(page);
      await page.locator('#abToggle').click();
      await page.waitForTimeout(600);
      const aSide = await readStats(page);
      // 兩側差異：A（基線）與 B（介入）鎖步同相，差距即介入效應——參與者在 UI 上看到的「兩邊差在哪」
      check('step4-ab-divergence', /A/.test(aSide.badge) && (aSide.tis - after.tis) > NEUTRAL_DISPLAY.tis * 2, 'A tis=' + aSide.tis + ' vs B tis=' + after.tis);
      check('no-page-errors', errors.length === 0, errors.join(' | '));
      const fails = results.filter((r) => !r.pass).length;
      console.log(fails === 0 ? 'smoke: ALL PASS (' + results.length + ')' : 'smoke: ' + fails + ' FAIL');
      exitCode = fails === 0 ? 0 : 1;
      return;
    }

    /* --panel：人類信差模式面板（T-371）——Prompt A 前畫面＋15 組改後 A/B 對照塊（全對凍結模型實測，時窗/種子同 learner） */
    if (argv.includes('--panel')) {
      const outArg = argv[argv.indexOf('--panel') + 1];
      const outFile = outArg && !outArg.startsWith('--') ? outArg : path.join(root, 'docs', 'pregate', 'PANEL-2026-09-13.md');
      const page = await freshRun(browser, base);
      await waitTicks(page, WATCH_TICKS);
      const before = await snapshot(page);
      const blocks = [];
      let bid = 0;
      for (const [key, c] of Object.entries(CONDS)) {
        for (const dir of ['up', 'down']) {
          const spec = c[dir];
          if (!spec) continue;
          bid += 1;
          await freshRun(browser, base, page);
          await waitTicks(page, WATCH_TICKS);
          await setCondition(page, key, spec.to);
          await waitTicks(page, SETTLE_TICKS + WINDOW_TICKS);
          const bSide = await snapshot(page);
          await page.locator('#abToggle').click();
          await page.waitForTimeout(800);
          const aSide = await snapshot(page);
          blocks.push({ id: 'B' + bid, key, label: c.label, dir, spec, bSide, aSide });
          console.log('block ' + blocks[blocks.length - 1].id + ': ' + c.label + ' ' + dir);
        }
      }
      const L = [];
      L.push('# 模擬預檢門·五頂級模型面板（人類信差模式）');
      L.push('');
      L.push('EC T-371（人類 2026-09-13「你可以給我一個prompt 我下五次」）。所有畫面由 `tests/pregate-simulated.cjs --panel` 對凍結模型實測（產品 commit ' + 'fc610748'.slice(0,8) + ' 系列、seed 7、觀看期 ' + WATCH_TICKS + ' tick、settle+窗 ' + (SETTLE_TICKS + WINDOW_TICKS) + ' tick——與四輪正式紀錄完全一致）。');
      L.push('');
      L.push('**定位（不可刪）**：這是模擬預檢的診斷面板，不是五人門；結果不支撐學習成效宣稱。與互動版的偏差：① 兩段式——改後畫面由預先實測的對應塊提供（決定性種子下與 live 觀察同內容）；② A/B 兩側讀數同時提供（不保留「選擇不看」權）；③ toggle_ab 非法動作以 nudge 處理；④ 觀察層修正——畫面轉述不再含 display:none 的隱藏徽章預設文字（參與者實際看不到），tick 冒號重複已除。量尺（v1.3 `scoreStatement`）零修訂。');
      L.push('');
      L.push('## 使用流程（每個模型一遍，各自開全新對話）');
      L.push('');
      L.push('1. 把下方「Prompt A」整段貼給模型。');
      L.push('2. 模型應回一個 `{"action":"set_condition",...}` JSON。照「判位表」找出對應畫面塊，把「塊內全文」貼回去。');
      L.push('   - 回的不是合法 JSON → 貼 NUDGE-GARBAGE（僅一次）；條件或方向不存在（或回 toggle_ab）→ 貼 NUDGE-ACTION（僅一次）；再犯 → 記「未完成」，停止。');
      L.push('   - 模型一次回多個動作 → 只取第一個 set_condition。');
      L.push('3. 模型的最後一句話（statement 的 text）＋它選的動作，填進「回收清單」帶回給執行者評分。');
      L.push('');
      L.push('## Prompt A（整段貼）');
      L.push('');
      L.push('```');
      L.push('你是一位參與者，第一次使用一個互動網頁。主持人只會念一次指示，之後不會再幫你、不會回答問題。');
      L.push('你看不到網站的程式碼，只能看到畫面文字轉述。');
      L.push('');
      L.push('主持人說：');
      L.push('1. 打開網址（本機 http://127.0.0.1:8642/ 或 loop.html）。');
      L.push('2. 按「跟著一顆紅血球」，看它走一圈。');
      L.push('3. 自己改一個條件。');
      L.push('4. 看兩邊差在哪，用一句話說「你改了什麼、什麼變了」。');
      L.push('');
      L.push('你已打開網頁、按了「跟著一顆紅血球」，並看了一會兒。當前【畫面】：');
      L.push(screenText(before));
      L.push('');
      L.push('這個版本的操作：看過畫面後，直接選「一個」條件調整（「條件」指參數面板的滑桿；藥物按鈕不是條件），嚴格輸出一個 JSON 物件、不要其他文字：');
      L.push('{"action":"set_condition","condition":"<畫面上的條件標籤原文>","direction":"up 或 down"}');
      L.push('');
      L.push('你送出後會收到調整後的【畫面】（含基線 A 側與介入 B 側讀數），屆時請用一句話完成主持人的第 4 步。');
      L.push('```');
      L.push('');
      L.push('## 判位表（照模型回的 JSON 找塊）');
      L.push('');
      L.push('| 模型回的 condition | direction | 貼的塊 |');
      L.push('|---|---|---|');
      for (const b of blocks) L.push('| ' + b.label + ' | ' + (b.dir === 'up' ? 'up（拉高）' : 'down（調低）') + ' | ' + b.id + ' |');
      L.push('');
      L.push('## NUDGE-GARBAGE（回的不是合法 JSON 時貼，僅一次）');
      L.push('');
      L.push('```');
      L.push('（無法辨識，請只輸出一個 JSON 動作物件）');
      L.push('```');
      L.push('');
      L.push('## NUDGE-ACTION（條件／方向不存在，或回了 toggle_ab 時貼，僅一次）');
      L.push('');
      L.push('```');
      L.push('（該條件或方向不可用；「條件」指參數面板的滑桿。請只輸出一個 set_condition JSON。）');
      L.push('```');
      L.push('');
      for (const b of blocks) {
        L.push('## 畫面塊 ' + b.id + '：' + b.label + ' ' + (b.dir === 'up' ? '拉高' : '調低') + '（' + b.spec.from + '→' + b.spec.to + '）');
        L.push('');
        L.push('```');
        L.push('【畫面 · 調整後（B 側）】');
        L.push(screenText(b.bSide));
        L.push('');
        L.push('【畫面 · 你按了「▶ 切到 A（基線）」之後（A 側）】');
        L.push(screenText(b.aSide));
        L.push('');
        L.push('最後，請用一句話完成主持人的第 4 步。嚴格輸出一個 JSON 物件、不要其他文字：');
        L.push('{"action":"statement","text":"<一句話：你改了什麼、什麼變了>"}');
        L.push('```');
        L.push('');
      }
      L.push('## 回收清單（帶回給執行者）');
      L.push('');
      L.push('| 模型名稱 | 它選的條件＋方向 | 最後一句話（statement 原文） | 備註（nudge 幾次／未完成） |');
      L.push('|---|---|---|---|');
      L.push('|  |  |  |  |');
      L.push('|  |  |  |  |');
      L.push('|  |  |  |  |');
      L.push('|  |  |  |  |');
      L.push('|  |  |  |  |');
      fs.writeFileSync(outFile, L.join('\n') + '\n');
      console.log('written: ' + outFile + ' (blocks=' + blocks.length + ')');
      return;
    }

    /* --learner：LLM 模擬受試者 */
    if (argv.includes('--learner')) {
      const ci = argv.indexOf('--config');
      if (ci < 0) throw new Error('--learner 需要 --config <json：{baseUrl, apiKey, model}>');
      const config = JSON.parse(fs.readFileSync(argv[ci + 1], 'utf-8'));
      const n = argv.includes('--n') ? Number(argv[argv.indexOf('--n') + 1]) : 5;
      console.log('learner: model=' + config.model + ' endpoint=' + config.baseUrl + ' n=' + n);
      const results = await runLearner(browser, base, config, n);
      const pass = results.filter((r) => r.verdict === 'PASS').length;
      for (const r of results) {
        console.log('--- 參與者 ' + r.n + ': ' + r.verdict + (r.codes && r.codes.length ? ' (' + r.codes.join(',') + ')' : ''));
        if (r.action) console.log('    改了: ' + r.action.label + ' ' + r.action.direction + ' (' + r.action.from + '→' + r.action.to + ')');
        if (r.statement) console.log('    一句話: ' + r.statement);
      }
      console.log('=== 模擬門：' + pass + '/' + results.length + '（通過線 4/5；僅為預檢訊號，非五人門） ===');
      if (argv.includes('--out')) {
        fs.writeFileSync(argv[argv.indexOf('--out') + 1], JSON.stringify({ ranAt: new Date().toISOString(), model: config.model, endpoint: config.baseUrl, n, pass, results }, null, 1) + '\n');
      }
      exitCode = 0; // 模擬門結果不論綠紅都算工具執行成功；判定由人類讀 RUN 紀錄
      return;
    }

    console.log('用法：--selftest | --smoke | --calibrate [outfile] | --panel [outfile] | --learner --config F [--n 5] [--out F]');
  } finally {
    if (browser) await browser.close();
    srv.close();
  }
  process.exit(exitCode);
})().catch((e) => { console.error('ERROR: ' + (e && e.stack || e)); process.exit(1); });
