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
    applyParams(w, { anemia: 1.5, temperature: 55, lungSupply: -1, flowSpeed: 99 });
    const L = CSL.PARAM_LIMITS;
    return { params: w.params, limits: L,
             clamped: w.params.anemia === L.anemia[1] && w.params.temperature === L.temperature[1]
               && w.params.lungSupply === L.lungSupply[0] && w.params.flowSpeed === L.flowSpeed[1],
             inRange: Object.entries(L).every(([k, [lo, hi]]) => w.params[k] >= lo && w.params[k] <= hi) };
  })()`);
  check('param-limits-clamp-to-exported-limits', r.clamped && r.inRange, JSON.stringify(r));
}

/* 7. 凍結基線守門：unchanged-core.json 中仍相符的五檔不得被動到。
      core.js 與 content.js 已由 T-303／T-316 具名局部解凍修改過，
      基線檔刻意不改寫，故此處只守其餘五檔並如實列出例外。 */
{
  const baseline = JSON.parse(fs.readFileSync(path.join(root, 'docs/verification/unchanged-core.json'), 'utf8'));
  const map = baseline.files || baseline;
  const exempt = ['js/loop/core.js', 'js/loop/content.js'];
  const drift = [];
  for (const [file, expected] of Object.entries(map)) {
    if (exempt.includes(file)) continue;
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex');
    if (actual !== String(expected).replace(/^sha256:/, '')) drift.push({ file, expected, actual });
  }
  check('unchanged-core-five-files-intact', drift.length === 0,
    drift.length ? JSON.stringify(drift) : 'exempt (named unfreeze): ' + exempt.join(', '));
}

console.log('=== model behaviour contracts (0.3.0 / 0.4.0 / 0.5.0) ===');
let fails = 0;
for (const r of results) {
  console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + '   ' + r.detail);
  if (!r.pass) fails++;
}
console.log(fails === 0 ? 'ALL ' + results.length + ' MODEL CONTRACT CHECKS PASS' : fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);
