'use strict';
const {spawnSync}=require('node:child_process');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
for(const script of ['docs/audit-probes/atlas-tests.cjs','docs/audit-probes/loop-smoke.cjs','docs/audit-probes/model-contracts.cjs','tests/final-boundaries.cjs']){
  const r=spawnSync(process.execPath,[path.join(root,script),root],{stdio:'inherit',cwd:root});
  if(r.error){console.error(r.error);process.exit(1)}
  if(r.status!==0)process.exit(r.status||1);
}
console.log('57 scoped checks passed. Browser, deployment and biology are separate acceptance scopes.');
