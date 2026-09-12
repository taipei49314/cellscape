/* v0.3 Living Atlas（Gate A/B）自建測試：內容完整性、讀值數學、
   缺資料語義、session/branch 隔離、唯讀性。Node VM，不改產品。 */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = process.argv[2];
const load = (f) => fs.readFileSync(path.join(root, 'js/loop', f), 'utf8');

const c = vm.createContext({ console, Math, Date, JSON, isFinite });
vm.runInContext('var global = this;', c);
for (const f of ['core.js', 'model.js', 'content.js', 'observe.js']) vm.runInContext(load(f), c, { filename: f });

const results = [];
const check = (name, pass, detail) => { results.push({ name, pass, detail: detail || '' }); };
const run = (s) => vm.runInContext(s, c, { timeout: 60000 });

/* 共用：把 JS 原始碼的註解剝掉再掃。第一版只濾「行首是註解記號」的行，對
   「/* 開頭、續行沒有 * 前綴」的區塊註解無效——pool run 實際誤判過一次：
   chapters.js 檔頭寫著「不呼叫 Observe.onWorldInstalled()」被當成真的呼叫。 */
const stripComments = (src) => src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*/g, '$1 ');

/* 1. 內容完整性：8 卡 × 4 問 = 32；主張/來源可解析；能力列舉合法；純資料 */
{
  const r = run(`(()=>{
    const C = CSL.Content;
    const nCards = C.cards.length;
    const nQA = C.cards.reduce((s,c)=>s+c.qa.length,0);
    const fourEach = C.cards.every(c=>c.qa.length===4);
    const capIds = new Set(C.capabilityLegend.map(l=>l.id));
    const capOk = C.cards.every(c=>capIds.has(c.capability));
    let claimsOk = true, sourcesOk = true;
    for (const card of C.cards) for (const qa of card.qa) for (const cid of qa.claimIds) {
      const cl = C.claims[cid];
      if (!cl) { claimsOk = false; continue; }
      for (const sid of (cl.sourceIds||[])) if (!C.sources.find(s=>s.id===sid)) sourcesOk = false;
    }
    const roOk = C.readouts.length===7 && C.readouts.filter(r=>r.def).length===3
      && new Set(C.readouts.map(r=>r.id)).size===7;
    const pureData = JSON.stringify(JSON.parse(JSON.stringify(C)))===JSON.stringify(C);
    const modelAssumptionOk = Object.values(C.claims).every(cl =>
      cl.contentType!=='model_assumption' || cl.implRef);
    return {nCards,nQA,fourEach,capOk,claimsOk,sourcesOk,roOk,pureData,modelAssumptionOk};
  })()`);
  check('content-registry-integrity',
    r.nCards === 8 && r.nQA === 32 && r.fourEach && r.capOk && r.claimsOk && r.sourcesOk && r.roOk && r.pureData && r.modelAssumptionOk,
    JSON.stringify(r));
}

/* 2. 讀值數學：窗口速率與手工計算一致（dt 正確；usage 基線＝tick t−N，tick0=0） */
{
  const r = run(`(()=>{
    CSL.Observe.init();
    const w = CSL.createWorld({ seed: 4242 });
    CSL.queueCommand(w,{kind:'setParam',key:'lungSupply',value:0.55,source:'user'});
    const N = CSL.Observe.RATE_WINDOW, DT = CSL.Observe.DT;
    const u = [w.ledger.usage];   // u[0] = 0（tick 0，模型事實）
    let sumFl=0,sumFt=0;
    for (let t=1;t<=N;t++){
      CSL.step(w);
      u[t]=w.ledger.usage;
      CSL.Observe.recordTick(w,'B',1);
      sumFl += w._fluxLung; sumFt += w._fluxTissue;
    }
    const gotL = CSL.Observe.readout(w,'B',1,'flux_lung_rate');
    const gotT = CSL.Observe.readout(w,'B',1,'flux_tissue_rate');
    const gotU = CSL.Observe.readout(w,'B',1,'usage_rate');
    const gotLoad = CSL.Observe.readout(w,'B',1,'sel_load');
    const expFl = sumFl/(N*DT), expFt = sumFt/(N*DT), expU = (u[N]-u[0])/(N*DT);
    return { loadOk: gotLoad.state==='ok' && Math.abs(gotLoad.value - w.entities[1].load/w.entities[1].cap) < 1e-12,
      flOk: gotL.state==='ok' && Math.abs(gotL.value-expFl) < 1e-12,
      ftOk: gotT.state==='ok' && Math.abs(gotT.value-expFt) < 1e-12,
      uOk: gotU.state==='ok' && Math.abs(gotU.value-expU) < 1e-12,
      uOkTickN1: (()=>{ CSL.step(w); u[N+1]=w.ledger.usage; CSL.Observe.recordTick(w,'B',1);
        const g = CSL.Observe.readout(w,'B',1,'usage_rate');
        return Math.abs(g.value - (u[N+1]-u[1])/(N*DT)) < 1e-12; })() };
  })()`);
  check('readout-math-matches-manual', r.loadOk && r.flOk && r.ftOk && r.uOk && r.uOkTickN1, JSON.stringify(r));
}

/* 3. 缺資料語義：窗口不足 ⇒ missing-window（不是 0）；樣本 <2 ⇒ recentChange/coverage 缺資料 */
{
  const r = run(`(()=>{
    CSL.Observe.init();
    const w = CSL.createWorld({ seed: 77 });
    for (let i=0;i<40;i++){ CSL.step(w); CSL.Observe.recordTick(w,'B',3); }
    const rate = CSL.Observe.readout(w,'B',3,'flux_tissue_rate');
    /* 40 tick：已有數個負載樣本 ⇒ recentChange 可述（非 missing）；覆蓋可述 */
    const chg40 = CSL.Observe.recentChange('B',3);
    const cov40 = CSL.Observe.coverageSeconds('B',3);
    /* 7 tick：僅 1 個樣本 ⇒ recentChange/coverage 應為缺資料 */
    CSL.Observe.init();
    const w2 = CSL.createWorld({ seed: 77 });
    for (let i=0;i<7;i++){ CSL.step(w2); CSL.Observe.recordTick(w2,'B',3); }
    const rate7 = CSL.Observe.readout(w2,'B',3,'flux_tissue_rate');
    const chg7 = CSL.Observe.recentChange('B',3);
    const cov7 = CSL.Observe.coverageSeconds('B',3);
    return { rateState: rate.state, have: rate.have, need: rate.need, valueIsNull: rate.value===null,
      chg40State: chg40.state, cov40: cov40,
      rate7State: rate7.state, have7: rate7.have,
      changeMissing7: chg7.state==='missing', covNull7: cov7===null };
  })()`);
  check('missing-window-is-missing-not-zero',
    r.rateState==='missing-window' && r.have===40 && r.need===90 && r.valueIsNull &&
    r.chg40State!=='missing' && r.cov40>0 &&
    r.rate7State==='missing-window' && r.have7===7 && r.changeMissing7 && r.covNull7,
    JSON.stringify(r));
}

/* 4. 實測零通量：lungSupply=0 ⇒ 肺端速率 ok 且 === 0（真零，非缺資料） */
{
  const r = run(`(()=>{
    CSL.Observe.init();
    const w = CSL.createWorld({ seed: 9 });
    CSL.queueCommand(w,{kind:'setParam',key:'lungSupply',value:0,source:'user'});
    for (let i=0;i<95;i++){ CSL.step(w); CSL.Observe.recordTick(w,'B',1); }
    const e = w.entities[1];
    const onLung = CSL.EDGES[e.edge].exchange==='lung';
    /* 任選一顆在 LUNG_CAP 的實體驗證 */
    let idOnLung=null; for (const k in w.entities) if (CSL.EDGES[w.entities[k].edge].exchange==='lung'){idOnLung=w.entities[k].id;break;}
    const rate = CSL.Observe.readout(w,'B',idOnLung,'flux_lung_rate');
    return { onLung, idOnLung, state: rate.state, value: rate.value, isTrueZero: rate.state==='ok' && rate.value===0 };
  })()`);
  check('measured-zero-flux-is-real-zero', r.isTrueZero, JSON.stringify(r));
}

/* 5. session/branch 隔離：A/B 各自窗口；epoch 前進全清；實體鍵不互串 */
{
  const r = run(`(()=>{
    CSL.Observe.init();
    const ep0 = CSL.Observe.sessionEpoch;
    const wB = CSL.createWorld({ seed: 11 });
    const wA = CSL.createWorld({ seed: 11 });
    for (let i=0;i<100;i++){
      CSL.step(wB); CSL.Observe.recordTick(wB,'B',1);
      CSL.step(wA); CSL.Observe.recordTick(wA,'A',1);
    }
    const bB = CSL.Observe.readout(wB,'B',1,'flux_tissue_rate');
    const bA = CSL.Observe.readout(wA,'A',1,'flux_tissue_rate');
    const crossState = CSL.Observe.readout(wA,'A',1,'flux_tissue_rate').state;
    /* 選取鍵：實體 1 有樣本、實體 7 沒有 */
    const h1 = CSL.Observe.loadHistory('B',1), h7 = CSL.Observe.loadHistory('B',7);
    /* 匯入邊界：epoch 前進 + 全清 */
    CSL.Observe.onWorldInstalled();
    const ep1 = CSL.Observe.sessionEpoch;
    const afterImport = CSL.Observe.readout(wB,'B',1,'sel_load');
    /* 讀值不受舊 session 影響：狀態回到 missing-window */
    const rateAfter = CSL.Observe.readout(wB,'B',1,'flux_tissue_rate');
    const h1After = CSL.Observe.loadHistory('B',1);
    return { ep0, ep1, bBOk: bB.state==='ok', bAOk: bA.state==='ok',
      sampleCount1: h1.points.length, sampleCount7: h7.points.length,
      h1Available: h1.available, h7Available: h7.available,
      afterImportState: afterImport.state, rateAfterState: rateAfter.state,
      loadStillOk: afterImport.state==='ok',
      h1AfterAvailable: h1After.available };
  })()`);
  check('session-branch-isolation',
    r.ep1===r.ep0+1 && r.bBOk && r.bAOk && r.h1Available && !r.h7Available &&
    r.rateAfterState==='missing-window' && r.loadStillOk && !r.h1AfterAvailable,
    JSON.stringify(r));
}

/* 6. 採樣節奏與上限＋時間界：每 6 tick 一點；600 點上限；樣本不得老於 120 模型秒 */
{
  const r = run(`(()=>{
    CSL.Observe.init();
    const w = CSL.createWorld({ seed: 31 });
    for (let i=0;i<4200;i++){ CSL.step(w); CSL.Observe.recordTick(w,'B',2); }  // 140 模型秒
    const h = CSL.Observe.loadHistory('B',2);
    const cov = CSL.Observe.coverageSeconds('B',2);
    const cadenceOk = h.points.every((p,i)=> i===0 || p.t - h.points[i-1].t === 6);
    const timeBounded = h.points.every(p=>p.t >= w.tick - 3600);
    /* 選取空窗：先記實體 2，再改記實體 1 一段，回到實體 2 ⇒ 不跨斷裂比較 */
    for (let i=0;i<600;i++){ CSL.step(w); CSL.Observe.recordTick(w,'B',1); }
    for (let i=0;i<30;i++){ CSL.step(w); CSL.Observe.recordTick(w,'B',2); }
    const h2 = CSL.Observe.loadHistory('B',2);
    const gap = h2.points.length>1 ? h2.points[h2.points.length-1].t - h2.points[h2.points.length-2].t : null;
    const chg = CSL.Observe.recentChange('B',2);
    return { n: h.points.length, cap: CSL.Observe.MAX_SAMPLES, cadenceOk, timeBounded, cov,
      gapAfterReselect: gap, changeStateAfterGap: chg.state,
      gapGuardOk: gap===null || (gap>60 ? chg.state==='missing' : true) };
  })()`);
  check('sample-cadence-cap-and-time-bound',
    r.n===600 && r.cadenceOk && r.timeBounded && r.cov<=120 && r.gapGuardOk, JSON.stringify(r));
}

/* 7. 唯讀性：recordTick + readout 不改變世界任何欄位 */
{
  const r = run(`(()=>{
    CSL.Observe.init();
    const w = CSL.createWorld({ seed: 55 });
    for (let i=0;i<30;i++) CSL.step(w);
    const before = JSON.stringify(w);
    for (let i=0;i<10;i++){ CSL.step(w); CSL.Observe.recordTick(w,'B',1); }
    /* 注意：上面有 step，改比「step 後、observe 前」 */
    const w2 = CSL.createWorld({ seed: 55 });
    for (let i=0;i<40;i++) CSL.step(w2);
    const b2 = JSON.stringify(w2);
    CSL.Observe.recordTick(w2,'B',1);
    CSL.Observe.readout(w2,'B',1,'flux_lung_rate');
    CSL.Observe.readout(w2,'B',1,'sel_load');
    CSL.Observe.viewContext(w2,'B',1);
    CSL.Observe.loadHistory('B',1);
    const a2 = JSON.stringify(w2);
    /* 匯出不受觀察影響（執行包契約不變） */
    CSL.Observe.init();
    const w3 = CSL.createWorld({ seed: 55 });
    for (let i=0;i<40;i++) CSL.step(w3);
    const p1 = CSL.exportRun(w3);
    CSL.Observe.recordTick(w3,'B',1);
    const p2 = CSL.exportRun(w3);
    return { unchanged: b2===a2, exportUnchanged: p1===p2 };
  })()`);
  check('observe-is-read-only', r.unchanged && r.exportUnchanged, JSON.stringify(r));
}

/* 8. ViewContext 欄位齊全 */
{
  const r = run(`(()=>{
    CSL.Observe.init();
    const w = CSL.createWorld({ seed: 8 });
    const vc = CSL.Observe.viewContext(w,'B',5);
    const keys = Object.keys(vc);
    return { keys: keys.sort().join(','),
      frozen: Object.isFrozen(vc),
      contentVersion: vc.contentVersion, obsVersion: vc.observationVersion };
  })()`);
  const expect = 'branchId,contentVersion,entityId,observationVersion,runId,sessionEpoch,tick';
  check('view-context-fields', r.keys===expect && r.frozen && !!r.contentVersion && !!r.obsVersion, JSON.stringify(r));
}

/* 9. EN 覆蓋層主張鍵與 content.js 完全同步（content-en.js:9 的規則機械化） */
{
  vm.runInContext(load('content-en.js'), c, { filename: 'content-en.js' });
  const r = run(`(()=>{
    const zh = Object.keys(CSL.Content.claims).sort();
    const en = Object.keys((CSL.ContentEN && CSL.ContentEN.claims) || {}).sort();
    const missing = zh.filter((k) => en.indexOf(k) < 0);
    const extra = en.filter((k) => zh.indexOf(k) < 0);
    return { nZh: zh.length, nEn: en.length, missing, extra,
             mirrors: CSL.ContentEN && CSL.ContentEN.mirrors, contentVersion: CSL.Content.contentVersion };
  })()`);
  check('en-claims-keys-in-sync', r.missing.length === 0 && r.extra.length === 0 && r.nZh === r.nEn,
    JSON.stringify(r));
}

/* 10. 每條主張至少被 UI 引用一次：問答的 claimIds，或 atlas.js 明列的補充清單 */
{
  const atlasSrc = load('atlas.js');
  const r = run(`(()=>{
    const C = CSL.Content;
    const used = new Set();
    for (const card of C.cards) for (const qa of card.qa) for (const cid of qa.claimIds) used.add(cid);
    return { all: Object.keys(C.claims), used: Array.from(used) };
  })()`);
  const unref = r.all.filter((cid) => r.used.indexOf(cid) < 0 && atlasSrc.indexOf("'" + cid + "'") < 0);
  check('claims-referenced-by-ui', unref.length === 0, unref.length ? 'unreferenced: ' + unref.join(', ') : String(r.all.length) + ' claims');
}

/* 11. 導覽字幕的 EN 鍵：tour.js 用到的每個鍵都要在覆蓋層存在（缺鍵會靜默退回繁中） */
{
  const tourSrc = load('tour.js');
  const used = Array.from(new Set((tourSrc.match(/T\('([a-z0-9.]+)'/g) || [])
    .map((m) => m.slice(3, -1))));
  const r = run(`(()=>({ keys: Object.keys((CSL.ContentEN && CSL.ContentEN.tour) || {}) }))()`);
  const have = new Set(r.keys);
  const missing = used.filter((k) => !have.has(k));
  const unused = r.keys.filter((k) => used.indexOf(k) < 0);
  check('tour-en-keys-cover-narration', used.length > 0 && missing.length === 0 && unused.length === 0,
    JSON.stringify({ used: used.length, en: r.keys.length, missing, unused }));
}

/* 12. rateSeries（T-319）：與 readout 同值、缺窗為 missing、不插補、唯讀 */
{
  const r = run(`(()=>{
    const O = CSL.Observe;
    O.init();
    const w = CSL.createWorld({ seed: 4321 });
    const B = 'main';
    /* 前 89 tick 不足一個 90-tick 窗口 */
    for (let i = 0; i < 89; i++) { CSL.step(w); O.recordTick(w, B, null); }
    const early = O.rateSeries({ tick: w.tick }, B);
    const earlyAllMissing = early.points.every((p) => p.missing);
    for (let i = 0; i < 400; i++) { CSL.step(w); O.recordTick(w, B, null); }
    /* 序列點落在 SAMPLE_EVERY 的倍數上，readout() 則以當前 tick 為右端；
       先把模型時鐘推到取樣點，兩者的窗口右端才是同一個 tick。 */
    while (w.tick % O.SAMPLE_EVERY !== 0) { CSL.step(w); O.recordTick(w, B, null); }
    const seriesTick = w.tick;   // 之後的斷裂情節會推進時鐘，比對要用取序列當下的 tick
    const s = O.rateSeries({ tick: seriesTick }, B);
    const last = s.points[s.points.length - 1];
    const rl = O.readout(w, B, null, 'flux_lung_rate');
    const rt = O.readout(w, B, null, 'flux_tissue_rate');
    const ru = O.readout(w, B, null, 'usage_rate');
    const near = (a, b) => Math.abs(a - b) <= 1e-9;
    /* 刻意跳過 30 tick（模擬觀察斷裂）後，跨斷裂的點必須是 missing */
    for (let i = 0; i < 30; i++) CSL.step(w);
    for (let i = 0; i < 30; i++) { CSL.step(w); O.recordTick(w, B, null); }
    const afterGap = O.rateSeries({ tick: w.tick }, B);
    const gapPoints = afterGap.points.filter((p) => p.t > 489 && p.t <= w.tick);
    const someMissingAfterGap = gapPoints.some((p) => p.missing);
    const tickBefore = w.tick, epochBefore = O.sessionEpoch;
    O.rateSeries({ tick: w.tick }, B);
    return {
      earlyAllMissing, earlyAvailable: early.available,
      lastAlignedToNow: !!last && last.t === seriesTick,
      matchesReadout: last && !last.missing && last.t === seriesTick && near(last.lung, rl.value) && near(last.tissue, rt.value) && near(last.usage, ru.value),
      windowTicks: s.window.ticks, observed: s.observedPoints, total: s.totalPoints,
      noInterpolation: s.points.every((p) => p.missing || (isFinite(p.lung) && isFinite(p.tissue) && isFinite(p.usage))),
      someMissingAfterGap,
      readOnly: w.tick === tickBefore && O.sessionEpoch === epochBefore,
      missingHaveNoValues: s.points.every((p) => !p.missing || (p.lung === undefined && p.tissue === undefined && p.usage === undefined)),
    };
  })()`);
  check('rate-series-window-semantics',
    r.earlyAllMissing && !r.earlyAvailable && r.lastAlignedToNow && r.matchesReadout && r.windowTicks === 90
      && r.observed > 0 && r.noInterpolation && r.someMissingAfterGap && r.readOnly && r.missingHaveNoValues,
    JSON.stringify(r));
}

/* 13–16. 血紅素放大視角（T-321 刀 K1）。模組層是純資料＋純函式，可載進 VM；
   這四項擺在 content-en.js 載入（第 9 項）之後，EN 鍵檢查才拿得到 CSL.ContentEN。 */
{
  const hemoSrc = load('hemo.js');
  vm.runInContext(hemoSrc, c, { filename: 'hemo.js' });

  /* 13. 每一層內容非 claim 即 illustrative；claim 的 claimIds 必須全部可解析，
         illustrative 不得夾帶數量或單位（避免變成沒有依據的事實斷言）。 */
  {
    const r = run(`(()=>{
      const L = CSL.Hemo.LAYERS;
      const bad = [];
      for (const ly of L) {
        if (ly.kind === 'claim') {
          if (!ly.claimIds || !ly.claimIds.length) { bad.push([ly.id, 'claim-without-ids']); continue; }
          for (const cid of ly.claimIds) if (!CSL.Content.claims[cid]) bad.push([ly.id, 'unresolved:' + cid]);
        } else if (ly.kind === 'illustrative') {
          if (/[0-9０-９]/.test(ly.zh)) bad.push([ly.id, 'illustrative-with-number']);
        } else bad.push([ly.id, 'unknown-kind:' + ly.kind]);
      }
      return { n: L.length, bad };
    })()`);
    check('hemo-layers-claim-or-illustrative', r.n > 0 && r.bad.length === 0, JSON.stringify(r));
  }

  /* 14. 禁用詞彙探針：只掃**模組自撰**字串（LAYERS 的 zh 與 hemo.js 原始碼），
         引用自 CSL.Content 的正本文字（主張 text／supportedLimit／readout note）
         不在此限——那些是已登錄的措辭，本探針要抓的是模組順手多講的生理學。 */
  {
    /* 詞界要收緊：第一版用 /SpO/ 會命中英文的 "corre_spo_nd"（pool run 已實際誤判一次）。 */
    const BANNED = /(SpO[₂ 2]|飽和度|saturation|解離曲線|dissociation|P50|四聚體|tetramer|結合位|binding site|協同|cooperativ|2,3-DPG|血比容|h(a)?ematocrit|mmHg|血氧分壓|臨床|clinical|診斷|正常值)/i;
    const r = run(`(()=>{
      const hits = [];
      for (const ly of CSL.Hemo.LAYERS) if (${BANNED.toString()}.test(ly.zh)) hits.push(['layer:' + ly.id, ly.zh]);
      const en = (CSL.ContentEN && CSL.ContentEN.hemo) || {};
      for (const k of Object.keys(en)) if (${BANNED.toString()}.test(String(en[k]))) hits.push(['en:' + k, en[k]]);
      return { hits };
    })()`);
    /* 原始碼層：扣掉本檔自己的詞表與註解行後再掃，避免自我命中 */
    /* 原始碼層：剝掉註解後再掃，避免把「說明自己不講什麼」的註解當成違規 */
    const srcHits = (stripComments(hemoSrc).match(BANNED) || []).slice(0, 3);
    check('hemo-no-unregistered-vocabulary', r.hits.length === 0 && srcHits.length === 0,
      JSON.stringify({ data: r.hits, src: srcHits }));
  }

  /* 15. viewModel 是唯讀且與既有讀值一致：負載比例必須等於 readout('sel_load')，
         沒有選取實體時明示缺資料（不以 0 頂替），且呼叫後世界逐位元不變。 */
  {
    const r = run(`(()=>{
      CSL.Observe.init();
      const w = CSL.createWorld({ seed: 8899 });
      for (let i = 0; i < 200; i++) { CSL.step(w); CSL.Observe.recordTick(w, 'B', 7); }
      const before = CSL.exportRun(w), digestBefore = CSL.digest(w);
      const vm = CSL.Hemo.viewModel(w, 'B', 7);
      const ro = CSL.Observe.readout(w, 'B', 7, 'sel_load');
      const none = CSL.Hemo.viewModel(w, 'B', null);
      const html = CSL.Hemo.render(vm);
      const noneHtml = CSL.Hemo.render(none);
      return {
        available: vm.available,
        ratioMatchesReadout: Math.abs(vm.ratio - ro.value) <= 1e-12,
        ceiling: vm.ceiling, anemia: vm.anemia,
        noneAvailable: none.available, noneReason: none.reason, noneRatio: none.ratio,
        readOnly: CSL.exportRun(w) === before && CSL.digest(w) === digestBefore,
        htmlHasClaimRow: html.indexOf('C-model-load') >= 0 || html.length > 0,
        noneHtmlSaysMissing: /缺資料|Missing data/.test(noneHtml),
      };
    })()`);
    check('hemo-viewmodel-matches-readout-and-readonly',
      r.available && r.ratioMatchesReadout && r.readOnly
        && r.noneAvailable === false && r.noneReason === 'no-entity' && r.noneRatio === null
        && r.noneHtmlSaysMissing, JSON.stringify(r));
  }

  /* 16. EN 覆蓋層：每個 LAYERS 的 layer.<id> 與模組用到的鍵都要有 EN，
         且不得有多餘鍵（比照主張鍵的零缺零多規則）。 */
  {
    const r = run(`(()=>{
      const need = CSL.Hemo.LAYERS.map((ly) => 'layer.' + ly.id).concat([
        'title','frameNote','illustrativeTag','missingEntity','missingWorld',
        'rowLoad','rowCeiling','rowWhere','exchangeHere','rowLoops','rowCo2','rowPerfusion',
        'trendOk','trendMissing','stamp']).sort();
      const have = Object.keys((CSL.ContentEN && CSL.ContentEN.hemo) || {}).sort();
      return { missing: need.filter((k) => have.indexOf(k) < 0),
               extra: have.filter((k) => need.indexOf(k) < 0),
               nNeed: need.length, nHave: have.length,
               entryKey: !!(CSL.ContentEN && CSL.ContentEN.shell && CSL.ContentEN.shell['hemo.entry']) };
    })()`);
    check('hemo-en-keys-complete', r.missing.length === 0 && r.extra.length === 0 && r.entryKey,
      JSON.stringify(r));
  }
}

/* 17–20. 章節 B/C 學習控制器（T-321 刀 K2）。關卡是純述詞，吃 ctx 快照，
   可在 VM 內以合成情境驗證，不需要 DOM。 */
{
  vm.runInContext(load('chapters.js'), c, { filename: 'chapters.js' });

  /* 17. 關卡讀**世界事實**而非事件流：把參數在進章前就設成目標值（此時
         applyCommand 的 before===v 早退，全程零事件、w.actions 為空），
         B1 仍必須成立。這是報告預測最可能寫錯的一處。 */
  {
    const r = run(`(()=>{
      const Ch = CSL.Chapters;
      const w = CSL.createWorld({ seed: 1212 });
      /* 直接把世界事實設成非基準值，完全不經事件 */
      w.params.temperature = 39.5;
      const ctx = { world: w, baseline: { tissueLevel: 0.4, everMoved: true }, selfReport: '',
                    main: { branchA: null, activeIsA: false, seenA: false, seenChain: false, expandedEventId: null } };
      const evB = Ch.evaluate('B', ctx);
      const b1 = evB.gates.find((g) => g.id === 'B1');
      return { actions: w.actions.length, events: w.events.length, b1: !!(b1 && b1.met),
               met: evB.met, total: evB.total };
    })()`);
    check('chapters-gate-reads-world-not-events',
      r.actions === 0 && r.b1 === true && r.total === 3, JSON.stringify(r));
  }

  /* 18. 不按時間前進：同一個 ctx 下跑很多 tick，未達成的關卡不得自己變成達成；
         達成條件成立的那一刻才成立。 */
  {
    const r = run(`(()=>{
      const Ch = CSL.Chapters;
      const w = CSL.createWorld({ seed: 3434 });
      const base = { tissueLevel: w.compartments.tissue.stock / w.compartments.tissue.capacity, everMoved: false };
      const mk = () => ({ world: w, baseline: base, selfReport: '',
        main: { branchA: null, activeIsA: false, seenA: false, seenChain: false, expandedEventId: null } });
      let everMetC1 = false;
      for (let i = 0; i < 600; i++) { CSL.step(w); if (Ch.evaluate('C', mk()).gates[0].met) everMetC1 = true; }
      const beforeSelf = Ch.evaluate('C', mk());
      const withSelf = Ch.evaluate('C', Object.assign(mk(), { selfReport: '因為供氧下降所以組織庫存下降' }));
      const c4Before = beforeSelf.gates.find((g) => g.id === 'C4').met;
      const c4After = withSelf.gates.find((g) => g.id === 'C4').met;
      return { everMetC1, c4Before, c4After, tick: w.tick };
    })()`);
    check('chapters-no-time-based-advance',
      r.everMetC1 === false && r.c4Before === false && r.c4After === true, JSON.stringify(r));
  }

  /* 19. 控制器絕不寫模型：呼叫 evaluate／viewModel／render 之後，
         世界的 exportRun 與 digest 必須逐位元不變；模組也不得呼叫 queueCommand。 */
  {
    const srcChapters = load('chapters.js');
    const r = run(`(()=>{
      const Ch = CSL.Chapters;
      const w = CSL.createWorld({ seed: 5656 });
      for (let i = 0; i < 120; i++) CSL.step(w);
      const before = CSL.exportRun(w), dBefore = CSL.digest(w);
      const ctx = { world: w, baseline: { tissueLevel: 0.5, everMoved: true }, selfReport: 'x',
                    main: { branchA: {}, activeIsA: true, seenA: true, seenChain: true, expandedEventId: 3 } };
      const evB = Ch.evaluate('B', ctx), evC = Ch.evaluate('C', ctx);
      const html = Ch.render({ chapterA: { available: false, reason: 'no-tour', step: null, total: null, active: false },
                               chapters: [evB, evC], baseline: ctx.baseline });
      return { readOnly: CSL.exportRun(w) === before && CSL.digest(w) === dBefore,
               cComplete: evC.complete, htmlLen: html.length,
               saysNoJudgement: /不判定|does not judge/.test(html) };
    })()`);
    const writesModel = /queueCommand|setParam|onWorldInstalled/.test(stripComments(srcChapters));
    check('chapters-never-write-model',
      r.readOnly && r.cComplete && r.saysNoJudgement && writesModel === false,
      JSON.stringify({ ...r, writesModel }));
  }

  /* 20. EN 鍵完整：每個關卡的 gate.<id>、每章的 chapter.<id>／goal.<id>
         與模組用到的鍵都要有 EN，且零多餘。 */
  {
    const r = run(`(()=>{
      const Ch = CSL.Chapters;
      const need = [];
      for (const ch of Ch.CHAPTERS) {
        need.push('chapter.' + ch.id, 'goal.' + ch.id);
        for (const g of ch.gates) need.push('gate.' + g.id);
      }
      need.push('title','close','doneMark','openMark','aProgress','aOf','aStep','aNotStarted',
                'selfReportLabel','noJudgement');
      need.sort();
      const have = Object.keys((CSL.ContentEN && CSL.ContentEN.chapters) || {}).sort();
      return { missing: need.filter((k) => have.indexOf(k) < 0),
               extra: have.filter((k) => need.indexOf(k) < 0),
               entryKey: !!(CSL.ContentEN && CSL.ContentEN.shell && CSL.ContentEN.shell['learn.entry']) };
    })()`);
    check('chapters-en-keys-complete', r.missing.length === 0 && r.extra.length === 0 && r.entryKey,
      JSON.stringify(r));
  }
}

/* 21–22. 細胞內部示意的內容治理（T-323）。對照 hemo.js：結構表每筆
   非 claim（claimIds 可解析）即 illustrative（不得夾帶數量）；產品原始碼
   不得再出現無主張背書的 pH 衍生或「四聚體」等未登錄詞彙。 */
{
  vm.runInContext(load('inside.js'), c, { filename: 'inside.js' });

  /* 21. 每張卡的每一層非 claim 即 illustrative；claim 的 claimIds 必須
         全部可解析；illustrative 不得夾帶數量或單位。 */
  {
    const r = run(`(()=>{
      const cards = CSL.Inside.cards;
      const ids = Object.keys(cards);
      const bad = [];
      let nLayers = 0;
      for (const id of ids) {
        const layers = cards[id].layers || [];
        if (!layers.length) bad.push([id, 'empty-layers']);
        for (const ly of layers) {
          nLayers++;
          if (ly.kind === 'claim') {
            if (!ly.claimIds || !ly.claimIds.length) { bad.push([id + ':' + ly.id, 'claim-without-ids']); continue; }
            for (const cid of ly.claimIds) if (!CSL.Content.claims[cid]) bad.push([id + ':' + ly.id, 'unresolved:' + cid]);
          } else if (ly.kind === 'illustrative') {
            if (/[0-9０-９]/.test(ly.zh)) bad.push([id + ':' + ly.id, 'illustrative-with-number']);
          } else bad.push([id + ':' + ly.id, 'unknown-kind:' + ly.kind]);
        }
      }
      return { nCards: ids.length, nLayers, bad };
    })()`);
    check('inside-layers-claim-or-illustrative',
      r.nCards === 8 && r.nLayers > 0 && r.bad.length === 0, JSON.stringify(r));
  }

  /* 22. 未登錄／無背書字串不得出現在產品原始碼（剝註解後掃）。
         四聚體在 hemo 禁用詞表已收；pH 公式是 T-323 刪除的無主張衍生。 */
  {
    const BANNED = /(四聚體|tetramer|模型 pH|model pH|pH 指數|pH index|7\.40\s*-\s*0\.35)/i;
    const files = ['inside.js', 'atlas.js', 'content-en.js'];
    const hits = [];
    for (const f of files) {
      const src = stripComments(load(f));
      const m = src.match(BANNED);
      if (m) hits.push([f, m[0]]);
    }
    /* 植入違規反向驗：真的寫回四聚體必須被抓到 */
    const planted = stripComments('/* 說明 */ var x = "血紅素四聚體（示意）";').match(BANNED);
    check('no-unbacked-ph-or-tetramer-in-product-src',
      hits.length === 0 && !!planted, JSON.stringify({ hits, planted: planted && planted[0] }));
  }
}

/* 23. 章節 A 導覽控制（T-329 刀 F1）：goto/next/prev/replayStep 只改指標；
       不重跑已完成的 onEnter 副作用、不虛構 until、導覽未啟動時拒絕。 */
{
  const tourSrc = load('tour.js');
  vm.runInContext(tourSrc, c, { filename: 'tour.js' });
  const r = run(`(()=>{
    const w = CSL.createWorld({ seed: 9090 });
    const subs = [], cams = [];
    const api = { subtitle: (t) => subs.push(t), setCamera: (v) => cams.push(v),
                  enableBranch: () => {}, tourDone: () => {} };
    CSL.Tour.start(w, api, 1);
    const total = CSL.Tour.steps.length;
    const beforeCmds = w.actions.length;
    const idx0 = CSL.Tour.idx;
    CSL.Tour.next(api);
    const idxAfterNext = CSL.Tour.idx;
    CSL.Tour.prev(api);
    const idxAfterPrev = CSL.Tour.idx;
    CSL.Tour.replayStep(api);
    const idxAfterReplay = CSL.Tour.idx;
    /* 跳到第 4 步（onEnter 會設 _tourLowed）；再 goto 同一步不得重複下指令 */
    CSL.Tour.goto(4, api);
    const lowered1 = w._tourLowed === true;
    const cmdsAfter4 = w.actions.length;
    CSL.Tour.goto(4, api);
    const cmdsAfter4Again = w.actions.length;
    const stopped = (() => { CSL.Tour.stop(); return CSL.Tour.goto(0, api) === false; })();
    return { total, idx0, idxAfterNext, idxAfterPrev, idxAfterReplay,
             lowered1, cmdsAfter4, cmdsAfter4Again, stopped,
             advanced: idxAfterNext === idx0 + 1 && idxAfterPrev === idx0,
             replayKeptIdx: idxAfterReplay === idxAfterPrev,
             noRepeatOnEnter: cmdsAfter4Again === cmdsAfter4,
             hasNavApi: typeof CSL.Tour.next === 'function' && typeof CSL.Tour.prev === 'function'
               && typeof CSL.Tour.replayStep === 'function' && typeof CSL.Tour.goto === 'function',
             subs: subs.length };
  })()`);
  check('tour-nav-goto-prev-next-replay',
    r.total === 8 && r.advanced && r.replayKeptIdx && r.lowered1 && r.noRepeatOnEnter
      && r.stopped && r.hasNavApi && r.subs > 0, JSON.stringify(r));
}

/* 24. F2 拓樸雙床血流再分配（0.7.0）：EDGES 含 primary+secondary tissue site；
       perfusion=1 時次床權重為 0（＝0.6.0 單床）；perfusion=0.4 時次床有卸載。 */
{
  const r = run(`(()=>{
    const edges = CSL.EDGES;
    const tissue = edges.filter((e) => e.exchange === 'tissue');
    const sites = tissue.map((e) => e.perfusionSite);
    const version = CSL.MODEL_VERSION;
    function unloadAt(perfusion, site) {
      const w = CSL.createWorld({ seed: 77 });
      w.params.perfusion = perfusion;
      /* 把一顆 RBC 丟到指定組織床並給高負載 */
      const id = 1;
      const eIdx = edges.findIndex((e) => e.perfusionSite === site);
      w.entities[id].edge = eIdx; w.entities[id].s = 0.5; w.entities[id].load = 1;
      w.compartments.tissue.stock = 0;
      const before = w.entities[id].load;
      CSL.step(w);
      return before - w.entities[id].load;
    }
    const primary1 = unloadAt(1.0, 'primary');
    const secondary1 = unloadAt(1.0, 'secondary');
    const primary04 = unloadAt(0.4, 'primary');
    const secondary04 = unloadAt(0.4, 'secondary');
    return {
      version, nTissue: tissue.length, sites: tissue.map((e) => e.perfusionSite),
      primary1, secondary1, primary04, secondary04,
      at1SecondaryZero: Math.abs(secondary1) < 1e-12,
      at1PrimaryPositive: primary1 > 0,
      at04SecondaryPositive: secondary04 > 0,
      at04PrimaryLess: primary04 < primary1
    };
  })()`);
  check('f2-dual-bed-perfusion-redistribution',
    r.version === '0.7.0' && r.nTissue === 2
      && r.sites.join(',') === 'primary,secondary'
      && r.at1SecondaryZero && r.at1PrimaryPositive
      && r.at04SecondaryPositive && r.at04PrimaryLess,
    JSON.stringify(r));
}

let fails = 0;
console.log('=== v0.3 Atlas self-built tests ===');
for (const r of results) { console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.pass ? '' : '   ' + r.detail)); if (!r.pass) fails++; }
console.log(fails === 0 ? 'ALL ' + results.length + ' PASS' : fails + ' FAILURES');
process.exit(fails ? 1 : 0);
