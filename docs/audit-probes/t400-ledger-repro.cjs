'use strict';
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = process.argv[2] || path.join(__dirname, '..', '..');
const load = (f) => fs.readFileSync(path.join(root, 'js/loop', f), 'utf8');

function freshEnv() {
  const c = vm.createContext({ console, Date, Math, isFinite, JSON });
  vm.runInContext('var global = this;', c);
  vm.runInContext(load('core.js'), c);
  vm.runInContext(load('model.js'), c);
  return c;
}
const run = (c, s) => vm.runInContext(s, c, { timeout: 120000 });

function scenario(name, ticks, setup) {
  const c = freshEnv();
  const r = run(c, `(()=>{
    const w = CSL.createWorld({ seed: 20260915 });
    ${setup}
    let viol = 0, retire = 0, wbcSpawn = 0, wbcX = 0, firstViol = null, maxAbs = 0;
    for (let i = 0; i < ${ticks}; i++) {
      const beforeEvents = w.eventSeq;
      CSL.step(w);
      const res = Math.abs(CSL.ledgerResidual(w));
      if (res > maxAbs) maxAbs = res;
      for (let e = w.events.length - 1; e >= 0; e--) {
        const ev = w.events[e];
        if (ev.tick !== w.tick) break;
        if (ev.ruleId === 'ledgerViolation') { viol++; if (firstViol == null) firstViol = w.tick; }
        if (ev.kind === 'rbc_retire') retire++;
        if (ev.ruleId === 'wbc_recruit') wbcSpawn++;
        if (ev.ruleId === 'wbc_extravasate') wbcX++;
      }
    }
    let rbc = 0, wbc = 0;
    for (const k in w.entities) {
      if (w.entities[k].kind === 'wbc') wbc++; else rbc++;
    }
    return { viol, retire, wbcSpawn, wbcX, firstViol, maxAbs, rbc, wbc, tick: w.tick,
             residual: CSL.ledgerResidual(w),
             ledger: { initial: w.ledger.initialTotal, input: w.ledger.input, usage: w.ledger.usage, expelled: w.ledger.expelled } };
  })()`);
  console.log(JSON.stringify({ name, ...r }));
}

scenario('idle-30k', 30000, '');
scenario('infection-1-30k', 30000, `CSL.queueCommand(w, { kind: 'setParam', key: 'infection', value: 1, source: 'user' });`);
scenario('altitude-30k', 30000, `CSL.queueCommand(w, { kind: 'setParam', key: 'altitudeM', value: 4000, source: 'user' });`);
scenario('idle-600', 600, '');
scenario('infection-600', 600, `CSL.queueCommand(w, { kind: 'setParam', key: 'infection', value: 1, source: 'user' });`);
scenario('ab-restore-then-30k', 30000, `
  for (let i = 0; i < 120; i++) CSL.step(w);
  const snap = CSL.snapshot(w);
  const a = CSL.createWorld({ seed: w.seed, runId: 'A', branchOf: w.runId });
  CSL.restore(a, snap);
  a.pendingCommands = [];
  CSL.queueCommand(w, { kind: 'setParam', key: 'infection', value: 1, source: 'user' });
`);
