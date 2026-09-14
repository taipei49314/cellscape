/* T-378 brand landing: root is the poster, not a silent redirect. */
'use strict';
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const js = fs.readFileSync(path.join(root, 'js/hero.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css/hero.css'), 'utf8');
const results = [];
const check = (name, pass, detail) => { results.push({ name, pass, detail }); };

check('index-no-silent-redirect',
  !/location\.replace\(\s*['"]loop\.html['"]/.test(html),
  'index.html must not auto-replace into loop.html');

const ids = ['nucleus', 'mitochondria', 'er', 'golgi', 'vesicles', 'cytoskeleton'];
const missing = ids.filter((id) => !js.includes("id: '" + id + "'"));
check('six-illustrative-hotspots', missing.length === 0, missing.join(',') || '6');

check('cta-to-atlas',
  /href="loop\.html\?follow=1"/.test(html) && /跟著一顆紅血球/.test(html),
  'primary CTA must enter Living Atlas');

check('no-claim-ids-or-units',
  !/\bC-[a-z0-9-]+/.test(js) && !/\d+\s*(µm|um|nm|ATP|mmol)/i.test(js),
  'landing copy stays illustrative');

const frozen = [
  'js/loop/core.js', 'js/loop/model.js', 'js/loop/render.js', 'js/loop/tour.js',
  'js/loop/content.js', 'js/engine.js', 'js/data.js'
];
check('landing-does-not-load-frozen',
  frozen.every((f) => !html.includes(f) && !js.includes(f) && !css.includes(f)),
  'hero stack stays off the frozen seven');

const hero = path.join(root, 'assets/hero-cellscape.jpg');
check('poster-asset-present', fs.existsSync(hero) && fs.statSync(hero).size > 10000, hero);

const fail = results.filter((r) => !r.pass);
console.log(JSON.stringify({ scope: 'T-378 brand landing', results }, null, 2));
process.exitCode = fail.length ? 1 : 0;
