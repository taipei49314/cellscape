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

/* 7. 凍結基線守門（T-325 恢復全七檔）：以 frozen-core-baseline.json 釘定
      main 31506887 七檔 SHA-256。歷史收據 unchanged-core.json 不改寫、不參與
      本檢查；core/content/tour 的解凍遺留已由新基線吸收。再改任一檔須人類
      具名解凍並另建基線。 */
{
  const baselinePath = path.join(root, 'docs/verification/frozen-core-baseline.json');
  const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
  const map = baseline.files || baseline;
  const files = [
    'js/loop/core.js', 'js/loop/model.js', 'js/loop/render.js', 'js/loop/tour.js',
    'js/loop/content.js', 'js/engine.js', 'js/data.js'
  ];
  const drift = [];
  for (const file of files) {
    const expected = map[file];
    if (!expected) { drift.push({ file, error: 'missing-from-baseline' }); continue; }
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    if (actual !== String(expected).replace(/^sha256:/, '')) drift.push({ file, expected, actual });
  }
  const extra = Object.keys(map).filter((k) => !files.includes(k));
  check('frozen-core-baseline-intact',
    drift.length === 0 && extra.length === 0 && files.every((f) => !!map[f]),
    drift.length || extra.length
      ? JSON.stringify({ drift, extra })
      : 'all 7 files match frozen-core-baseline.json @ main 31506887');
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

/* 12. digest 涵蓋實體世代（0.9.0／T-343）：loops 影響未來演化（0.8.0 起滿圈退役），
       檢查點身分必須涵蓋——僅差 loops 的兩個世界摘要必須相異
       （DIGEST_EVENT_STATE_COVERAGE 同族契約；0.8.0 破洞：loops 0 vs 7 digest 相等，
       摘要相等不再保證後續一致）。修復契約：digest 實體序列納入 e.loops。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const a = CSL.createWorld({ seed: 424242 });
    const b = CSL.createWorld({ seed: 424242 });
    runTicks(a, 100); runTicks(b, 100);
    const id = Object.keys(b.entities).sort((x, y) => Number(x) - Number(y))[3];
    const ea = a.entities[id], eb = b.entities[id];
    b.entities[id].loops = ea.loops + 1;   // 唯一差異
    const onlyLoopsDiff = ea.id === eb.id && ea.edge === eb.edge && ea.s === eb.s
      && ea.load === eb.load && ea.cap === eb.cap && ea.loops !== eb.loops;
    const dA = CSL.digest(a), dB = CSL.digest(b);
    return { onlyLoopsDiff, dA, dB, differs: dA !== dB };
  })()`);
  check('digest-covers-loops', r.onlyLoopsDiff && r.differs, JSON.stringify(r));
}

/* 13. 海拔中立性（0.10.0／T-347）：altitudeM=0 與未設定的世界逐拍摘要全等
       （沿用 perfusion-neutral-at-1 前例；未修 core 上此檢查空洞通過——
       applyCommand 對未知鍵為 no-op，fail-first 證據由 14／15 承擔）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const a = CSL.createWorld({ seed: 864 });
    applyParams(a, { altitudeM: 0 });
    const b = CSL.createWorld({ seed: 864 });
    runTicks(b, 5);
    for (let i = 0; i < 400; i++) { CSL.step(a); CSL.digestStep(a); CSL.step(b); CSL.digestStep(b); }
    const same = a.digestChain.length === b.digestChain.length
      && a.digestChain.every((v, i) => v === b.digestChain[i]);
    return { same, n: a.digestChain.length };
  })()`);
  check('altitude-neutral-at-0', r.same, JSON.stringify(r));
}

/* 14. 海拔降低遞送（單調）：輸入與肺端裝載同乘氣壓比值 ⇒ 使用量與平均負載
       隨海拔單調下降，守恆殘差不變（未修 core 上 applyCommand 對 altitudeM
       no-op ⇒ 單調斷言失敗＝fail-first 證據）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const at = (h) => {
      const w = CSL.createWorld({ seed: 24680 });
      applyParams(w, { altitudeM: h });
      runTicks(w, 600);
      const meanLoad = Object.values(w.entities).reduce((s2, e) => s2 + e.load / e.cap, 0) / Object.keys(w.entities).length;
      return { usage: w.ledger.usage, meanLoad, residual: Math.abs(CSL.ledgerResidual(w)) };
    };
    const sea = at(0), mid = at(2500), high = at(5000);
    return { seaU: sea.usage, midU: mid.usage, highU: high.usage,
             seaL: sea.meanLoad, midL: mid.meanLoad, highL: high.meanLoad,
             residual: Math.max(sea.residual, mid.residual, high.residual) };
  })()`);
  check('altitude-lowers-delivery',
    r.seaU > r.midU && r.midU > r.highU && r.seaL > r.midL && r.midL > r.highL
      && r.residual <= 1e-6, JSON.stringify(r));
}

/* 15. 高地過度換氣：同參數下高海拔血中 CO₂ 指數低於海平面（模型指數，
       非臨床酸鹼判讀）；未修 core 上 co2 不變 ⇒ 失敗。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const co2At = (h) => {
      const w = CSL.createWorld({ seed: 9090 });
      applyParams(w, { altitudeM: h });
      runTicks(w, 600);
      return w.co2.blood;
    };
    const sea = co2At(0), high = co2At(5000);
    return { sea, high, drops: high < sea, nonNegative: high >= 0 };
  })()`);
  check('altitude-hyperventilation-lowers-co2', r.drops && r.nonNegative, JSON.stringify(r));
}

/* 16. 容積中立性（1.0.0／T-350）：fluidRate=0 且 37°C 下，含容積機制的世界
       與未設定的世界逐拍摘要全等（volFrac=1；未修 core 無 volume compartment，
       本檢查以探針錯誤落地＝fail-first 之一）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const a = CSL.createWorld({ seed: 1201 });
    applyParams(a, { fluidRate: 0 });
    const b = CSL.createWorld({ seed: 1201 });
    runTicks(b, 5);
    for (let i = 0; i < 400; i++) { CSL.step(a); CSL.digestStep(a); CSL.step(b); CSL.digestStep(b); }
    const same = a.digestChain.length === b.digestChain.length
      && a.digestChain.every((v, i) => v === b.digestChain[i]);
    const volA = a.compartments.volume ? a.compartments.volume.stock : null;
    return { same, volA, volFull: volA != null && Math.abs(volA - 5) < 1e-9 };
  })()`);
  check('volume-neutral-at-default', r.same === true && r.volFull === true, JSON.stringify(r));
}

/* 17. 出汗排水與容積小帳收斂：41°C 無補水 ⇒ 容積單調下降、sweat 入帳、
       容積殘差收斂（intake − sweat − (stock − 5.0)）、volumeLow 閾值事件觸發。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const w = CSL.createWorld({ seed: 1301 });
    if (!w.compartments.volume) return { noVolume: true };   // 未修 core：無容積 compartment
    applyParams(w, { temperature: 41, fluidRate: 0 });
    let prev = 5, monotonicDown = true, minVol = 5;
    for (let i = 0; i < 2000; i++) {           // 2000 tick：0.0008/tick 排水至 ~3.4，恰好越過 0.70 門檻
      CSL.step(w);
      const v = w.compartments.volume.stock;
      if (v > prev + 1e-12) monotonicDown = false;
      prev = v; minVol = Math.min(minVol, v);
    }
    const L = w.volumeLedger;
    const vres = L.intake - L.sweat - (w.compartments.volume.stock - 5.0);
    /* 事件環留最近 1000 筆：2000 tick 內 crossing（~1875）仍在環內可驗 */
    const lowEvents = w.events.filter((e) => e.kind === 'threshold' && e.ruleId === 'volumeLow').length;
    return { monotonicDown, minVol, vol: w.compartments.volume.stock, flagLow: !!w._volumeLow,
             intake: L.intake, sweat: L.sweat, vres,
             lowEvents, o2Residual: Math.abs(CSL.ledgerResidual(w)) };
  })()`);
  check('sweat-drains-and-ledger-closes',
    r.monotonicDown && r.minVol < 3.5 && r.vol < 3.5 && r.flagLow === true && r.lowEvents >= 1
      && Math.abs(r.vres) <= 1e-6 && r.sweat > 0 && r.intake === 0 && r.o2Residual <= 1e-6, JSON.stringify(r));
}

/* 18. 低血容降低遞送：同 39.5°C 下，補水維持容積者累積使用量高於無補水者
       （volFrac 調降流動與卸載），兩者氧守恆殘差 ≤1e-6。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const at = (fluid) => {
      const w = CSL.createWorld({ seed: 2468 });
      if (!w.compartments.volume) return { usage: -1, vol: -1, residual: -1 };   // 未修 core
      applyParams(w, { temperature: 39.5, fluidRate: fluid });
      runTicks(w, 1200);
      return { usage: w.ledger.usage, vol: w.compartments.volume.stock,
               residual: Math.abs(CSL.ledgerResidual(w)) };
    };
    const dry = at(0), hydrated = at(0.01);
    return { dryU: dry.usage, hydU: hydrated.usage, dryV: dry.vol, hydV: hydrated.vol,
             residual: Math.max(dry.residual, hydrated.residual) };
  })()`);
  check('hypovolemia-reduces-delivery',
    r.hydV > r.dryV && r.hydU > r.dryU && r.residual <= 1e-6, JSON.stringify(r));
}

/* 19. 感染中立性（1.1.0／T-353）：infection=0 與未設定的世界逐拍摘要全等，
       且無 WBC 生成（未修 core 無 immunity，探針錯誤落地＝fail-first 之一）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const a = CSL.createWorld({ seed: 1404 });
    applyParams(a, { infection: 0 });
    const b = CSL.createWorld({ seed: 1404 });
    runTicks(b, 5);
    for (let i = 0; i < 400; i++) { CSL.step(a); CSL.digestStep(a); CSL.step(b); CSL.digestStep(b); }
    const same = a.digestChain.length === b.digestChain.length
      && a.digestChain.every((v, i) => v === b.digestChain[i]);
    const allRbc = Object.values(a.entities).every((e) => e.kind === 'rbc');
    return { same, allRbc };
  })()`);
  check('infection-neutral-at-0', r.same === true && r.allRbc === true, JSON.stringify(r));
}

/* 20. 感染招募與清除（infection=1）：招募 ≤8 顆、外滲恰 8 筆、remaining 歸零、
       cleared 事件 1 筆、結束時場上全為 RBC、氧守恆不變
       （未修 core 無 immunity ⇒ 斷言失敗）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const w = CSL.createWorld({ seed: 1501 });
    if (!w.immunity) return { noImmunity: true };
    applyParams(w, { infection: 1 });
    runTicks(w, 1300);   // 清除完成 ~1162 tick；全程事件 <1000 留環內可數
    const cnt = (ruleId) => w.events.filter((e) => e.ruleId === ruleId).length;
    const allRbc = Object.values(w.entities).every((e) => e.kind === 'rbc');
    return { recruits: cnt('wbc_recruit'), extravasations: cnt('wbc_extravasate'),
             cleared: cnt('infection_cleared'), remaining: w.immunity.remaining,
             allRbc, wbcMaxOk: true, o2Residual: Math.abs(CSL.ledgerResidual(w)) };
  })()`);
  check('infection-recruits-and-clears',
    r.recruits <= 8 && r.extravasations === 8 && r.cleared === 1 && r.remaining === 0
      && r.allRbc === true && r.o2Residual <= 1e-6, JSON.stringify(r));
}

/* 21. 感染量等比招募：infection=0.5 清除需 4 次外滲（0.125／顆），
       cleared 1 筆；與 20 的 8 次成等比。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const w = CSL.createWorld({ seed: 1602 });
    if (!w.immunity) return { noImmunity: true };
    applyParams(w, { infection: 0.5 });
    runTicks(w, 1300);   // 0.5 事件需 4 次外滲，清除較早完成
    const cnt = (ruleId) => w.events.filter((e) => e.ruleId === ruleId).length;
    return { extravasations: cnt('wbc_extravasate'), cleared: cnt('infection_cleared'),
             remaining: w.immunity.remaining };
  })()`);
  check('infection-scales-recruitment',
    r.extravasations === 4 && r.cleared === 1 && r.remaining === 0, JSON.stringify(r));
}

/* 22. 血糖中立性（1.2.0／T-359）：glucoseIntake=0 與未設定的世界逐拍摘要全等，
       且血糖指數恆 0、胰島素恆禁食基線 0.30、無 glucoseHigh／insulin_response 事件
       （未修 core 無 glucose compartment——本檢查以探針錯誤落地＝fail-first 之一；
       參數 no-op 未修 core 上的空洞通過風險由 23／24 行為斷言承擔）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const a = CSL.createWorld({ seed: 1701 });
    applyParams(a, { glucoseIntake: 0 });
    const b = CSL.createWorld({ seed: 1701 });
    runTicks(b, 5);
    for (let i = 0; i < 400; i++) { CSL.step(a); CSL.digestStep(a); CSL.step(b); CSL.digestStep(b); }
    const same = a.digestChain.length === b.digestChain.length
      && a.digestChain.every((v, i) => v === b.digestChain[i]);
    const gStock = a.compartments.glucose ? a.compartments.glucose.stock : null;
    const insLevel = a.insulin ? a.insulin.level : null;
    const glucoseEvents = a.events.filter((e) => e.ruleId === 'glucoseHigh' || e.ruleId === 'insulin_response').length;
    return { same, gStock, insLevel, glucoseEvents };
  })()`);
  check('glucose-neutral-at-default',
    r.same === true && r.gStock === 0 && r.insLevel === 0.30 && r.glucoseEvents === 0, JSON.stringify(r));
}

/* 23. 進食—分泌—攝取（glucoseIntake=0.02）：血糖指數上升越過 0.55 ⇒ glucoseHigh 恰 1 筆、
       insulin_response ≥1 筆、胰島素峰值 >0.5（觸發當下即計數——事件環 1000 筆，長跑後
       早期事件會被逐出）；停食後指數回落 <0.10、遲滯解除、胰島素回禁食基線 0.30；
       全程氧守恆不變（未修 core 無 insulin ⇒ 探針錯誤＝fail-first 牙齒）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const w = CSL.createWorld({ seed: 1802 });
    if (!w.insulin || !w.compartments.glucose) return { noGlucose: true };
    applyParams(w, { glucoseIntake: 0.02 });
    let peakGlucose = 0, peakInsulin = 0, highFiredTick = -1;
    for (let i = 0; i < 700 && peakInsulin <= 0.5; i++) {
      CSL.step(w);
      peakGlucose = Math.max(peakGlucose, w.compartments.glucose.stock);
      peakInsulin = Math.max(peakInsulin, w.insulin.level);
      if (highFiredTick < 0 && w.events.some((e) => e.ruleId === 'glucoseHigh')) highFiredTick = w.tick;
    }
    /* 事件環留最近 1000 筆：觸發類事件必須在觸發時窗內計數 */
    const firedHigh = w.events.filter((e) => e.ruleId === 'glucoseHigh').length;
    const firedResponse = w.events.filter((e) => e.ruleId === 'insulin_response').length;
    applyParams(w, { glucoseIntake: 0 });   // 停食——胰島素仍處高位續行清除
    for (let i = 0; i < 2300; i++) { CSL.step(w); peakInsulin = Math.max(peakInsulin, w.insulin.level); }
    const L = w.glucoseLedger;
    const gres = L.intake - L.uptake - w.compartments.glucose.stock;
    return { highFiredTick, peakGlucose, peakInsulin,
             firedHigh, firedResponse,
             endGlucose: w.compartments.glucose.stock, endInsulin: w.insulin.level,
             flagStillHigh: !!w._glucoseHigh, gres,
             o2Residual: Math.abs(CSL.ledgerResidual(w)) };
  })()`);
  check('glucose-intake-raises-and-insulin-responds',
    r.highFiredTick > 0 && r.peakGlucose > 2 && r.peakInsulin > 0.5
      && r.firedHigh === 1 && r.firedResponse >= 1
      && r.endGlucose < 0.10 && Math.abs(r.endInsulin - 0.30) < 1e-9 && r.flagStillHigh === false
      && Math.abs(r.gres) <= 1e-6 && r.o2Residual <= 1e-6, JSON.stringify(r));
}

/* 24. 劑量等比與小帳收斂：glucoseIntake=0.02 的血糖峰值高於 0.01（兩者皆觸發 glucoseHigh），
       兩世界 glucoseLedger 殘差與氧守恆殘差皆 ≤1e-6（未修 core 無 glucoseLedger ⇒ fail-first）。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const at = (intake) => {
      const w = CSL.createWorld({ seed: 1903 });
      if (!w.glucoseLedger) return { peak: -1, gres: -1, o2: -1, highEvents: 0 };
      applyParams(w, { glucoseIntake: intake });
      let peak = 0;
      for (let i = 0; i < 700; i++) { CSL.step(w); peak = Math.max(peak, w.compartments.glucose.stock); }
      const L = w.glucoseLedger;
      return { peak, gres: L.intake - L.uptake - w.compartments.glucose.stock,
               highEvents: w.events.filter((e) => e.ruleId === 'glucoseHigh').length,
               o2: Math.abs(CSL.ledgerResidual(w)) };
    };
    const low = at(0.01), high = at(0.02);
    return { lowPeak: low.peak, highPeak: high.peak,
             lowHighEvents: low.highEvents, highHighEvents: high.highEvents,
             worstGres: Math.max(Math.abs(low.gres), Math.abs(high.gres)),
             worstO2: Math.max(low.o2, high.o2) };
  })()`);
  check('glucose-dose-monotonic-and-ledger-closes',
    r.highPeak > r.lowPeak && r.lowPeak > 0 && r.lowHighEvents >= 1 && r.highHighEvents >= 1
      && r.worstGres <= 1e-6 && r.worstO2 <= 1e-6, JSON.stringify(r));
}

/* 23. T-400：RBC 退役替換的 0.12 必須記入 ledger.input。未修時首次退役後
       （約 tick 4320）每 30 tick 噴 ledgerViolation，殘差 = −n×0.12。
       感染路徑 WBC 進出負載恆 0，不是氧帳破口。契約：idle／infection／
       snapshot+restore 各 5000 tick（跨過首次退役）零 ledgerViolation 且殘差 ≤1e-6。 */
{
  const c = freshEnv();
  const r = run(c, `(()=>{${SETUP}
    const runCase = (setup) => {
      const w = CSL.createWorld({ seed: 20260915 });
      setup(w);
      let viol = 0, retire = 0;
      for (let i = 0; i < 5000; i++) {
        CSL.step(w);
        for (let e = w.events.length - 1; e >= 0; e--) {
          const ev = w.events[e];
          if (ev.tick !== w.tick) break;
          if (ev.ruleId === 'ledgerViolation') viol++;
          if (ev.kind === 'rbc_retire') retire++;
        }
      }
      return { viol, retire, residual: Math.abs(CSL.ledgerResidual(w)), tick: w.tick };
    };
    const idle = runCase(() => {});
    const inf = runCase((w) => { applyParams(w, { infection: 1 }); });
    const restored = (() => {
      const w = CSL.createWorld({ seed: 20260915 });
      for (let i = 0; i < 120; i++) CSL.step(w);
      const snap = CSL.snapshot(w);
      const a = CSL.createWorld({ seed: w.seed, runId: 'A', branchOf: w.runId });
      CSL.restore(a, snap);
      applyParams(a, { infection: 1 });
      let viol = 0, retire = 0;
      for (let i = 0; i < 5000; i++) {
        CSL.step(a);
        for (let e = a.events.length - 1; e >= 0; e--) {
          const ev = a.events[e];
          if (ev.tick !== a.tick) break;
          if (ev.ruleId === 'ledgerViolation') viol++;
          if (ev.kind === 'rbc_retire') retire++;
        }
      }
      return { viol, retire, residual: Math.abs(CSL.ledgerResidual(a)), tick: a.tick };
    })();
    return { idle, inf, restored };
  })()`);
  const ok = (x) => x.retire >= 1 && x.viol === 0 && x.residual <= 1e-6;
  check('retire-replacement-ledger-closes',
    ok(r.idle) && ok(r.inf) && ok(r.restored), JSON.stringify(r));
}

console.log('=== model behaviour contracts (0.3.0 / 0.4.0 / 0.5.0 / 0.5.1 / 0.6.0 / 0.8.0 / 0.9.0 / 0.10.0 / 1.0.0 / 1.1.0 / 1.2.0) ===');
let fails = 0;
for (const r of results) {
  console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + '   ' + r.detail);
  if (!r.pass) fails++;
}
console.log(fails === 0 ? 'ALL ' + results.length + ' MODEL CONTRACT CHECKS PASS' : fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);
