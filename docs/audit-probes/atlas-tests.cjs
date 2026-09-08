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
    const roOk = C.readouts.length===6 && C.readouts.filter(r=>r.def).length===3
      && new Set(C.readouts.map(r=>r.id)).size===6;
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

let fails = 0;
console.log('=== v0.3 Atlas self-built tests ===');
for (const r of results) { console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + (r.pass ? '' : '   ' + r.detail)); if (!r.pass) fails++; }
console.log(fails === 0 ? 'ALL ' + results.length + ' PASS' : fails + ' FAILURES');
process.exit(fails ? 1 : 0);
