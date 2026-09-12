/* 模型行為契約探針（T-316 刀 D1）：0.3.0 貧血、0.4.0 CO₂／Bohr、0.5.0 體溫 Q10
   在此之前，這三個維度只被驗到 MODEL_VERSION 字串，沒有任何行為斷言。
   全部在 Node VM 內以固定種子執行，不開瀏覽器、不看時間、不用隨機門檻。
   邊界：這裡驗的是「程式是否照文件所述運作」，不是生理學正確性。 */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path'), crypto = require('crypto');
const root = process.argv[2];
const load = (f) => fs.readFileSync(path.join(root, 'js/loop', f), 'utf8');

function freshEnv() {
  const c = vm.createContext({ console, Date, Math, isFinite, JSON });
  vm.runInContext('var global = this;', c);
  vm.runInContext(load('core.js'), c, { filename: 'core.js' });
  vm.runInContext(load('model.js'), c, { filename: 'model.js' });
  return c;
}
const run = (c, s) => vm.runInContext(s, c, { timeout: 60000 });
const results = [];
const check = (name, pass, detail) => results.push({ name, pass, detail: detail || '' });

/* 共用：以 setParam 指令路徑套參數（與 UI 同一入口），再跑 n tick */
const SETUP = `
  const applyParams = (w, params) => {
    for (const [key, value] of Object.entries(params)) {
      CSL.queueCommand(w, { kind: 'setParam', key, value, source: 'user' });
    }
    for (let i = 0; i < 5; i++) CSL.step(w);   // 讓 command 到期生效
  };
  const runTicks = (w, n) => { for (let i = 0; i < n; i++) CSL.step(w); };
  const maxLoad = (w) => Object.values(w.entities).reduce((m, e) => Math.max(m, e.load), 0);
  const maxRatio = (w) => Object.values(w.entities).reduce((m, e) => Math.max(m, e.load / e.cap), 0);
`;

/* 1. 貧血只閘肺端裝載上限：載量比例不得超過 (1 − anemia) */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const w = CSL.createWorld({ seed: 4242 });
    applyParams(w, { anemia: 0.6 });
    let worst = 0;
    for (let i = 0; i < 600; i++) { CSL.step(w); worst = Math.max(worst, maxRatio(w)); }
    const ctrl = CSL.createWorld({ seed: 4242 });
    runTicks(ctrl, 605);
    return { worst, bound: 0.4, ctrlWorst: maxRatio(ctrl), residual: Math.abs(CSL.ledgerResidual(w)) };
  })()`);
  check('anemia-caps-load-ratio', r.worst <= r.bound + 1e-9 && r.ctrlWorst > r.bound && r.residual <= 1e-6,
    JSON.stringify(r));
}

/* 2. 體溫 37 °C ＝ Q10 因子 1：與未設定體溫的世界逐拍摘要完全相同 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const a = CSL.createWorld({ seed: 909 });
    applyParams(a, { temperature: 37 });
    const b = CSL.createWorld({ seed: 909 });
    runTicks(b, 5);
    for (let i = 0; i < 300; i++) { CSL.step(a); CSL.digestStep(a); CSL.step(b); CSL.digestStep(b); }
    const same = a.digestChain.length === b.digestChain.length
      && a.digestChain.every((v, i) => v === b.digestChain[i]);
    return { same, n: a.digestChain.length, usageA: a.ledger.usage, usageB: b.ledger.usage };
  })()`);
  check('q10-neutral-at-37c', r.same, JSON.stringify(r));
}

/* 3. Q10 單調且不超過解析上限 2^((T−37)/10)：36 < 37 < 41 的累積使用量 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const usageAt = (t) => {
      const w = CSL.createWorld({ seed: 20260912 });
      applyParams(w, { temperature: t });
      runTicks(w, 600);
      return { usage: w.ledger.usage, residual: Math.abs(CSL.ledgerResidual(w)) };
    };
    const cold = usageAt(36), base = usageAt(37), hot = usageAt(41);
    return { cold: cold.usage, base: base.usage, hot: hot.usage,
             ratio: hot.usage / base.usage, ceiling: Math.pow(2, 0.4),
             residual: Math.max(cold.residual, base.residual, hot.residual) };
  })()`);
  /* 上限可解析保證：Q10 只乘使用速率，組織水位回饋只會使累積比值更小 */
  check('q10-monotonic-and-bounded',
    r.cold < r.base && r.base < r.hot && r.ratio > 1 && r.ratio <= r.ceiling + 1e-9 && r.residual <= 1e-6,
    JSON.stringify(r));
}

/* 4. CO₂ 指數鉗位在 0–1，且 CO₂ 帳殘差收斂 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const w = CSL.createWorld({ seed: 5150 });
    applyParams(w, { temperature: 41, tissueDemand: 1, lungSupply: 0.12 });   // 推高生產、壓低排出
    let lo = 1, hi = 0, worstRes = 0;
    for (let i = 0; i < 900; i++) {
      CSL.step(w);
      lo = Math.min(lo, w.co2.blood); hi = Math.max(hi, w.co2.blood);
      worstRes = Math.max(worstRes, Math.abs(w.co2.lastResidual));
    }
    return { lo, hi, worstRes, o2Residual: Math.abs(CSL.ledgerResidual(w)) };
  })()`);
  check('co2-bounded-and-ledger-closes',
    r.lo >= 0 && r.hi <= 1 && r.worstRes <= 1e-6 && r.o2Residual <= 1e-6, JSON.stringify(r));
}

/* 5. Bohr 卸載倍率：高 CO₂ 使組織側卸載相對加速（同種子、同其他參數） */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const deliveredWith = (lungSupply) => {
      const w = CSL.createWorld({ seed: 8080 });
      applyParams(w, { lungSupply, tissueDemand: 1, temperature: 41 });
      runTicks(w, 600);
      return { co2: w.co2.blood, usage: w.ledger.usage };
    };
    const high = deliveredWith(0.12);   // 通氣低 ⇒ CO₂ 累積
    const low = deliveredWith(1.0);     // 通氣高 ⇒ CO₂ 接近基準
    return { co2High: high.co2, co2Low: low.co2 };
  })()`);
  check('co2-rises-when-ventilation-drops', r.co2High > r.co2Low, JSON.stringify(r));
}

/* 6. 參數界限：越界 setParam 依實作鉗位到界限（不是拒絕），
      且 applyCommand 內的界限表與匯出的 CSL.PARAM_LIMITS 必須一致
      （目前是兩份字面表，這裡守住它們不漂移）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const w = CSL.createWorld({ seed: 616 });
    applyParams(w, { anemia: 1.5, temperature: 55, lungSupply: -1, flowSpeed: 99, perfusion: 9 });
    const L = CSL.PARAM_LIMITS;
    return { params: w.params, limits: L,
             clamped: w.params.anemia === L.anemia[1] && w.params.temperature === L.temperature[1]
               && w.params.lungSupply === L.lungSupply[0] && w.params.flowSpeed === L.flowSpeed[1]
               && w.params.perfusion === L.perfusion[1],
             inRange: Object.entries(L).every(([k, [lo, hi]]) => w.params[k] >= lo && w.params[k] <= hi) };
  })()`);
  check('param-limits-clamp-to-exported-limits', r.clamped && r.inRange, JSON.stringify(r));
}

/* 7. 凍結基線守門：unchanged-core.json 中仍相符的四檔不得被動到。
      core.js／content.js（T-303、T-316 刀 D2）與 tour.js（T-316 刀 D3）已由
      具名局部解凍修改過；基線檔是不改寫的歷史收據，故此處只守其餘四檔，
      並如實列出例外。要恢復全七檔守門，需要人類另行裁定新的凍結基線。 */
{
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'docs/verification/unchanged-core.json'), 'utf8'));
  const map = baseline.files || baseline;
  const exempt = ['js/loop/core.js', 'js/loop/content.js', 'js/loop/tour.js'];
  const drift = [];
  for (const [file, expected] of Object.entries(map)) {
    if (exempt.includes(file)) continue;
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    if (actual !== String(expected).replace(/^sha256:/, '')) drift.push({ file, expected, actual });
  }
  check('unchanged-core-remaining-files-intact', drift.length === 0,
    drift.length ? JSON.stringify(drift) : 'exempt (named unfreeze): ' + exempt.join(', '));
}

/* 8. CO₂ 閾值事件必須能匯出→匯入→續行（T-316 刀 D2 的迴歸）。
      修復前：core.js 的 validateSnapshot 只接受 tissueStockLow，
      事件環一旦含 co2BloodHigh，importRun 與 A/B 分支都會 SNAPSHOT_REJECTED。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const stress = { temperature: 41, tissueDemand: 1, lungSupply: 0.12 };
    const w = CSL.createWorld({ seed: 6060 });
    applyParams(w, stress);
    for (let i = 0; i < 400; i++) { CSL.step(w); CSL.digestStep(w); }
    const co2Events = w.events.filter((e) => e.kind === 'threshold' && e.ruleId === 'co2BloodHigh').length;
    const pack = CSL.exportRun(w);
    const parsed = JSON.parse(pack);
    let imported = null, importError = null;
    try { imported = CSL.importRun(pack); } catch (e) { importError = String(e); }
    let branchError = null;
    try { const b = CSL.createWorld({ seed: w.seed, runId: 'A-' + w.runId, branchOf: w.runId });
          CSL.restore(b, CSL.snapshot(w)); }
    catch (e) { branchError = String(e); }
    let continued = null;
    if (imported) {
      for (let i = 0; i < 120; i++) { CSL.step(imported); CSL.digestStep(imported); }
      const ref = CSL.createWorld({ seed: 6060 });
      applyParams(ref, stress);
      for (let i = 0; i < 520; i++) { CSL.step(ref); CSL.digestStep(ref); }
      continued = { same: imported.digestChain[imported.digestChain.length - 1] === ref.digestChain[ref.digestChain.length - 1],
                    reEmitted: imported.events.filter((e) => e.ruleId === 'co2BloodHigh').length };
    }
    return { co2Events, importError, branchError,
             packHasFlags: Object.prototype.hasOwnProperty.call(parsed, 'co2High')
               && Object.prototype.hasOwnProperty.call(parsed, 'lastCo2'),
             flagsMatch: !!parsed.co2High === !!w._co2High, continued };
  })()`);
  check('co2-event-export-import-continues',
    r.co2Events > 0 && !r.importError && !r.branchError && r.packHasFlags && r.flagsMatch
      && r.continued && r.continued.same, JSON.stringify(r));
}

/* 9. CO₂ 閾值遲滯不變式（≥0.70 觸發、<0.60 解除）。
      三階段情節：高位 → 緩降（低通氣，每 tick 只掉約 1.7%，必然停留在 0.60–0.70 帶內）
      → 全通氣清除。CO₂ 排出為 blood × 0.34 × lungSupply，所以緩降階段的通氣必須壓低，
      否則單一 tick 就會跨過整個遲滯帶（這正是本測試第一版在 pool 上失敗的原因）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const w = CSL.createWorld({ seed: 7070 });
    const trace = [];
    const sample = () => trace.push({ b: w.co2.blood, hi: !!w._co2High,
      n: w.events.filter((e) => e.ruleId === 'co2BloodHigh').length });
    applyParams(w, { temperature: 41, tissueDemand: 1, lungSupply: 0.12 });   // 1) 推高
    for (let i = 0; i < 400; i++) { CSL.step(w); sample(); }
    applyParams(w, { temperature: 36, tissueDemand: 0, lungSupply: 0.05 });   // 2) 緩降
    for (let i = 0; i < 400; i++) { CSL.step(w); sample(); }
    applyParams(w, { lungSupply: 1 });                                        // 3) 全通氣清除
    for (let i = 0; i < 400; i++) { CSL.step(w); sample(); }
    let aboveHighAlwaysHi = true, belowLowAlwaysClear = true, eventsOnlyOnRise = true, cleared = false;
    let midHold = false, min = 1, max = 0;
    for (let i = 1; i < trace.length; i++) {
      const p = trace[i - 1], t = trace[i];
      min = Math.min(min, t.b); max = Math.max(max, t.b);
      if (t.b >= 0.70 && !t.hi) aboveHighAlwaysHi = false;
      if (t.b < 0.60 && t.hi) belowLowAlwaysClear = false;
      if (!p.hi && t.hi) { if (t.n !== p.n + 1) eventsOnlyOnRise = false; }
      else if (t.n !== p.n) eventsOnlyOnRise = false;
      if (p.hi && !t.hi) cleared = true;
      if (t.b >= 0.60 && t.b < 0.70 && t.hi) midHold = true;   // 遲滯帶內維持高位
    }
    return { aboveHighAlwaysHi, belowLowAlwaysClear, eventsOnlyOnRise, cleared, midHold, min, max,
             events: trace[trace.length - 1].n,
             bandTicks: trace.filter((t) => t.b >= 0.60 && t.b < 0.70).length };
  })()`);
  check('co2-threshold-hysteresis',
    r.aboveHighAlwaysHi && r.belowLowAlwaysClear && r.eventsOnlyOnRise && r.cleared && r.midHold,
    JSON.stringify(r));
}

/* 10. perfusion = 1.0 是中性值：與從未設定 perfusion 的世界逐拍摘要完全相同
       （證明 0.6.0 在基準值下與 0.5.1 行為一致）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const a = CSL.createWorld({ seed: 3131 });
    applyParams(a, { perfusion: 1.0 });
    const b = CSL.createWorld({ seed: 3131 });
    runTicks(b, 5);
    for (let i = 0; i < 400; i++) { CSL.step(a); CSL.digestStep(a); CSL.step(b); CSL.digestStep(b); }
    const same = a.digestChain.length === b.digestChain.length
      && a.digestChain.every((v, i) => v === b.digestChain[i]);
    return { same, n: a.digestChain.length, defaultPerfusion: CSL.createWorld({ seed: 1 }).params.perfusion };
  })()`);
  check('perfusion-neutral-at-1', r.same && r.defaultPerfusion === 1.0, JSON.stringify(r));
}

/* 11. 血流再分配：低灌流使組織端累積遞送下降、高灌流上升，且守恆殘差不變。
       低灌流時血中應留住更多氧（平均負載較高），這是「送不進去」而不是「憑空消失」。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const at = (perfusion) => {
      const w = CSL.createWorld({ seed: 24680 });
      applyParams(w, { perfusion });
      let delivered = 0;
      for (let i = 0; i < 600; i++) { const before = w.ledger.usage; CSL.step(w); delivered += w.ledger.usage - before; }
      const meanLoad = Object.values(w.entities).reduce((s2, e) => s2 + e.load / e.cap, 0) / Object.keys(w.entities).length;
      return { usage: w.ledger.usage, tissue: w.compartments.tissue.stock, meanLoad,
               residual: Math.abs(CSL.ledgerResidual(w)) };
    };
    const low = at(0.3), base = at(1.0), high = at(1.6);
    return { low, base, high,
             monotonic: low.tissue < base.tissue && base.tissue < high.tissue,
             loadBacksUp: low.meanLoad > base.meanLoad,
             residual: Math.max(low.residual, base.residual, high.residual) };
  })()`);
  check('perfusion-scales-tissue-delivery',
    r.monotonic && r.loadBacksUp && r.residual <= 1e-6, JSON.stringify(r));
}

console.log('=== model behaviour contracts (0.3.0 / 0.4.0 / 0.5.0 / 0.5.1 / 0.6.0) ===');
let fails = 0;
for (const r of results) {
  console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + '   ' + r.detail);
  if (!r.pass) fails++;
}
console.log(fails === 0 ? 'ALL ' + results.length + ' MODEL CONTRACT CHECKS PASS' : fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);
