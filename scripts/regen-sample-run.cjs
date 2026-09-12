/* T-325：重生 docs/samples/sample-run.json 到目前 MODEL_VERSION。
   路徑＝與 loop-smoke 相同的 VM 載入（core+model）→ createWorld({seed:20260908})
   → step 至 tick 1200 → CSL.exportRun → 寫入樣本檔。

   用法（需 Node；依 workload 政策，引擎負載不落工作機——由人類或已授權主機執行）：
     node scripts/regen-sample-run.cjs
   可選：node scripts/regen-sample-run.cjs /path/to/cellscape

   不改模型、不跑測試、不 bump 版本。 */
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');

const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const outPath = path.join(root, 'docs/samples/sample-run.json');
const SEED = 20260908;
const TICKS = 1200;

const load = (f) => fs.readFileSync(path.join(root, 'js/loop', f), 'utf8');
const c = vm.createContext({ console, Date, Math, isFinite, JSON });
vm.runInContext('var global = this;', c);
vm.runInContext(load('core.js'), c, { filename: 'core.js' });
vm.runInContext(load('model.js'), c, { filename: 'model.js' });

const version = vm.runInContext('CSL.MODEL_VERSION', c);
const pack = vm.runInContext(
  `(()=>{
    const w = CSL.createWorld({ seed: ${SEED} });
    for (let i = 0; i < ${TICKS}; i++) CSL.step(w);
    return CSL.exportRun(w);
  })()`,
  c,
  { timeout: 120000 }
);

const obj = JSON.parse(pack);
if (obj.modelVersion !== version) {
  console.error('REFUSED: export modelVersion', obj.modelVersion, '!= runtime', version);
  process.exit(1);
}
if (obj.seed !== SEED || obj.tick < TICKS) {
  console.error('REFUSED: unexpected seed/tick', obj.seed, obj.tick);
  process.exit(1);
}

// 先寫 .tmp 再 replace，避免中途失敗清空既有樣本（io 截斷坑）。
const tmp = outPath + '.tmp';
fs.writeFileSync(tmp, pack + '\n', 'utf8');
fs.renameSync(tmp, outPath);

console.log('WROTE', outPath);
console.log('modelVersion', obj.modelVersion, 'tick', obj.tick, 'events', (obj.events || []).length, 'seed', obj.seed);
