/* 自建 loop 世界冒煙探針（交接驗證用；非稽核方套件）
   涵蓋：版本、實體數/唯一性、守恆殘差、確定性摘要鏈、匯出匯入續行、舊包拒絕 */
'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = process.argv[2];
const load = (f) => fs.readFileSync(path.join(root, 'js/loop', f), 'utf8');

function freshEnv() {
  const c = vm.createContext({ console, Date, Math, isFinite, JSON });
  vm.runInContext('var global = this;', c);
  vm.runInContext(load('core.js'), c);
  vm.runInContext(load('model.js'), c);
  return c;
}
const run = (c, s) => vm.runInContext(s, c, { timeout: 60000 });

const out = {};
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass, detail }); };

// 1. 版本
{
  const c = freshEnv();
  const v = run(c, `CSL.MODEL_VERSION`);
  check('MODEL_VERSION=0.2.2', v === '0.2.2', `got ${v}`);
}

// 2+3. 實體數固定 48、ID 唯一、600 tick 守恆殘差 ≤ 1e-6、每 tick 每 ID 唯一所在
{
  const c = freshEnv();
  const r = run(c, `(()=>{
    const w = CSL.createWorld({ seed: 20260908 });
    const ids = Object.keys(w.entities).map(Number);
    const unique = new Set(ids).size === ids.length && ids.length === 48;
    let worst = 0, countOk = true, edgeOk = true;
    for (let i = 0; i < 600; i++) {
      CSL.step(w);
      const n = Object.keys(w.entities).length;
      if (n !== 48) countOk = false;
      const seen = new Set();
      for (const k in w.entities) {
        const e = w.entities[k];
        if (seen.has(e.id)) edgeOk = false;
        seen.add(e.id);
      }
      worst = Math.max(worst, Math.abs(CSL.ledgerResidual(w)));
    }
    return { unique, countOk, edgeOk, worst, tick: w.tick };
  })()`);
  check('entities-48-unique-per-edge', r.unique && r.countOk && r.edgeOk, JSON.stringify(r));
  check('conservation-600t-le-1e-6', r.worst <= 1e-6, `worst=${r.worst}`);
}

// 4. 確定性：同種子同指令序列 ⇒ 摘要鏈一致
{
  const mk = () => {
    const c = freshEnv();
    return run(c, `(()=>{
      const w = CSL.createWorld({ seed: 777 });
      for (let i = 0; i < 120; i++) {
        CSL.step(w);
        if (i === 40) CSL.queueCommand(w, { kind:'param', key:'lungSupply', value:0.4, source:'user' });
        if (i === 80) CSL.queueCommand(w, { kind:'param', key:'tissueDemand', value:0.9, source:'tour' });
        CSL.digestStep(w);
      }
      return w.digestChain;
    })()`);
  };
  const a = mk(), b = mk();
  check('deterministic-digest-chain', a.length === b.length && a.every((v, i) => v === b[i]),
    `len=${a.length}`);
}

// 5. 匯出 → 匯入 → 續行：摘要鏈延續不重複
{
  const c = freshEnv();
  const r = run(c, `(()=>{
    const w = CSL.createWorld({ seed: 31337 });
    for (let i = 0; i < 90; i++) { CSL.step(w); CSL.digestStep(w); }
    const pack = CSL.exportRun(w);   // 已是 JSON 字串
    const w2 = CSL.importRun(pack);
    const tailLen = Math.min(w2.digestChain.length, w.digestChain.length);
    const prefixContinued = tailLen > 0 &&
      w.digestChain.slice(-tailLen).every((v, i) => w2.digestChain[i] === v);
    for (let i = 0; i < 60; i++) { CSL.step(w2); CSL.digestStep(w2); }
    const wRef = CSL.createWorld({ seed: 31337 });
    for (let i = 0; i < 150; i++) { CSL.step(wRef); CSL.digestStep(wRef); }
    const sameTail = w2.digestChain[w2.digestChain.length-1] === wRef.digestChain[wRef.digestChain.length-1];
    return { prefixContinued, sameTail, n2: w2.digestChain.length, nRef: wRef.digestChain.length };
  })()`);
  check('export-import-continuation', r.prefixContinued && r.sameTail, JSON.stringify(r));
}

// 6. 舊版包顯式拒絕 + 畸形包拒絕 + kind 相依 payload 負例（本輪新契約）
{
  const c = freshEnv();
  const r = run(c, `(()=>{
    const w = CSL.createWorld({ seed: 555 });
    for (let i = 0; i < 30; i++) CSL.step(w);
    CSL.queueCommand(w, { kind: 'setParam', key: 'flowSpeed', value: 1.5, source: 'user' });
    for (let i = 0; i < 5; i++) CSL.step(w);   // command 到期 ⇒ 產生 command 事件
    const pack = CSL.exportRun(w);   // 已是 JSON 字串
    const old = pack.replace('"modelVersion":"0.2.2"', '"modelVersion":"0.2.1"');
    const results = {};
    try { CSL.importRun(old); results.oldRejected = false; }
    catch (e) { results.oldRejected = /IMPORT_REJECTED/.test(String(e)); }
    try { CSL.importRun('{not json'); results.malformedRejected = false; }
    catch (e) { results.malformedRejected = /IMPORT_REJECTED/.test(String(e)); }
    /* 稽核 IMPORTED_COMMAND_NULL_AFTER 反例：真實匯出的 command 事件 after 改 null */
    const g = JSON.parse(pack);
    const cmd = g.events.find(e => e.kind === 'command');
    results.hasCommand = !!cmd;
    if (cmd) {
      cmd.after = null;
      try { CSL.importRun(JSON.stringify(g)); results.nullAfterRejected = false; }
      catch (e) { results.nullAfterRejected = /REJECTED/.test(String(e)); }
    }
    /* handoff 負例：after.edge 越界 */
    const g2 = JSON.parse(pack);
    const h = g2.events.find(e => e.kind === 'handoff');
    if (h) { h.after.edge = 99;
      try { CSL.importRun(JSON.stringify(g2)); results.badHandoffRejected = false; }
      catch (e) { results.badHandoffRejected = /REJECTED/.test(String(e)); } }
    return results;
  })()`);
  check('old-version-and-malformed-rejected', r.oldRejected && r.malformedRejected, JSON.stringify(r));
  check('event-payload-negatives-rejected',
    r.hasCommand && r.nullAfterRejected && r.badHandoffRejected, JSON.stringify(r));
}

console.log('=== loop smoke (self-built) ===');
let fails = 0;
for (const r of results) {
  console.log((r.pass ? 'PASS' : 'FAIL') + '  ' + r.name + '   ' + (r.detail || ''));
  if (!r.pass) fails++;
}
console.log(fails === 0 ? 'ALL ' + results.length + ' SMOKE CHECKS PASS' : fails + ' FAILURES');
process.exit(fails === 0 ? 0 : 1);
