/* ============================================================
   CELLSCAPE · engine.js
   模擬引擎：細胞行為 / 訊號擴散 / 微血管路徑 / 傷口癒合 / 情境狀態機
   ============================================================ */
(function () {
  const CS = window.CS;
  const W = 1600, H = 900;
  const SIGDEF = {
    danger:    { color: '#ff5470', speed: 230, max: 300 },
    chemokine: { color: '#45e0ff', speed: 190, max: 260 },
    cytokine:  { color: '#ffb454', speed: 170, max: 220 },
    antigen:   { color: '#b26bff', speed: 160, max: 320 },
    growth:    { color: '#7dffa8', speed: 160, max: 230 },
    pulse:     { color: '#ffffff', speed: 320, max: 150 },
    o2:        { color: '#9ff2ff', speed: 55,  max: 70 },
  };
  const CANCER_CAP = 24;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  const E = {
    W, H,
    organId: null, organ: null,
    cells: [], signals: [], particles: [], paths: [], pulses: [],
    wound: null, deco: {},
    t: 0, timeScale: 1, paused: false,
    scenarioId: 'normal', sT: 0, scriptIdx: 0, loopT: 0,
    resolved: false, failed: false, failT: 0,
    inflam: 0, inflamTarget: 0, tReady: false,
    heartT: 0, beatFlash: 0, bactReproT: 0, ambientIdx: 0,
    idSeq: 1,

    /* ================= 場景建構 ================= */
    loadOrgan(id) {
      const org = CS.DATA.organs[id];
      this.organId = id; this.organ = org;
      this.cells = []; this.signals = []; this.particles = []; this.paths = []; this.pulses = [];
      this.wound = null; this.deco = {};
      this.tReady = false; this.inflam = 0; this.inflamTarget = 0;
      this.antigenPresented = false;
      this.heartT = 0; this.bactReproT = 0;
      this.populate(id);
      if (CS.Render) CS.Render.buildBg();
    },

    populate(id) {
      const M = {
        blood: () => {
          for (let i = 0; i < 3; i++) {
            const y0 = 190 + i * 260;
            this.paths.push(this.wavyPath(y0, 1 + (i % 2) * -2, 44));
          }
          for (let i = 0; i < 150; i++) this.spawnOnPath('rbc', i % 3);
          for (let i = 0; i < 6; i++) this.spawn('neutrophil', rnd(100, W - 100), rnd(120, H - 120));
          for (let i = 0; i < 7; i++) this.spawn('tcell', rnd(100, W - 100), rnd(120, H - 120));
          for (let i = 0; i < 22; i++) this.spawnOnPath('platelet', i % 3);
          for (let i = 0; i < 2; i++) this.spawn('macrophage', rnd(200, W - 200), rnd(150, H - 150));
        },
        lungs: () => {
          const sacs = (this.deco.sacs = []);
          for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 3; gy++) {
            sacs.push({ x: 230 + gx * 380 + rnd(-40, 40), y: 180 + gy * 280 + rnd(-30, 30), r: rnd(72, 104) });
          }
          sacs.forEach((s, i) => {
            const n = 9;
            for (let k = 0; k < n; k++) {
              const a = (k / n) * Math.PI * 2 + i;
              const c = this.spawn('alveolar', s.x + Math.cos(a) * s.r, s.y + Math.sin(a) * s.r);
              c.anchor = [c.x, c.y]; c.sac = i;
            }
            this.paths.push(this.ringPath(s.x, s.y, s.r + 30, 34 + rnd(-6, 10)));
          });
          for (let i = 0; i < 40; i++) this.spawnOnPath('rbc', i % this.paths.length);
          for (let i = 0; i < 4; i++) this.spawn('macrophage', rnd(200, W - 200), rnd(150, H - 150));
          for (let i = 0; i < 3; i++) this.spawn('tcell', rnd(200, W - 200), rnd(150, H - 150));
        },
        heart: () => {
          const fibers = (this.deco.fibers = []);
          for (let r = 0; r < 5; r++) {
            const y0 = 150 + r * 150, bend = (r % 2 ? 1 : -1) * 60;
            fibers.push({ y0, bend });
            this.paths.push(this.arcPath(y0, bend, 30 + rnd(-5, 8)));
            const n = 10;
            for (let k = 0; k < n; k++) {
              const p = this.pathPoint(this.paths[this.paths.length - 1], (k + 0.5) / n * this.paths[this.paths.length - 1].len);
              const c = this.spawn('cardiomyocyte', p.x + rnd(-4, 4), p.y + rnd(-4, 4));
              c.anchor = [c.x, c.y]; c.row = r;
            }
          }
          for (let i = 0; i < 26; i++) this.spawnOnPath('rbc', i % this.paths.length);
          for (let i = 0; i < 3; i++) this.spawn('fibroblast', rnd(200, W - 200), rnd(150, H - 150));
          for (let i = 0; i < 2; i++) this.spawn('macrophage', rnd(200, W - 200), rnd(150, H - 150));
        },
        brain: () => {
          const neurons = [];
          let guard = 0;
          while (neurons.length < 24 && guard++ < 800) {
            const p = { x: rnd(120, W - 120), y: rnd(110, H - 110) };
            if (neurons.every((q) => Math.hypot(p.x - q.x, p.y - q.y) > 105)) neurons.push(p);
          }
          const links = (this.deco.links = []);
          neurons.forEach((p, i) => {
            const c = this.spawn('neuron', p.x, p.y); c.anchor = [p.x, p.y]; c.idx = i;
            const near = neurons.map((q, j) => ({ j, d: Math.hypot(p.x - q.x, p.y - q.y) }))
              .filter((o) => o.j !== i && o.d < 230).sort((a, b) => a.d - b.d).slice(0, 2);
            near.forEach((o) => { if (!links.some((L) => (L[0] === o.j && L[1] === i))) links.push([i, o.j]); });
          });
          for (let i = 0; i < 12; i++) {
            const c = this.spawn('glia', rnd(120, W - 120), rnd(110, H - 110)); c.anchor = [c.x, c.y];
          }
          for (let i = 0; i < 3; i++) this.spawn('microglia', rnd(200, W - 200), rnd(150, H - 150));
          this.paths.push(this.wavyPath(H * 0.5, 0.4, 60));
          for (let i = 0; i < 14; i++) this.spawnOnPath('rbc', 0);
        },
        liver: () => {
          const channels = (this.deco.channels = []);
          for (let i = 0; i < 3; i++) {
            const y0 = 180 + i * 270, dir = i % 2 ? -1 : 1;
            channels.push({ y0, dir });
            this.paths.push(this.wavyPath(y0, 2.2 * dir, 52));
          }
          const cols = 8, rows = 5, dx = 190, dy = 168;
          for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) {
            const x = 120 + q * dx + (r % 2 ? dx / 2 : 0), y = 130 + r * dy;
            if (channels.some((ch) => Math.abs(y - ch.y0) < 60)) continue;
            if (x < W - 60) {
              const c = this.spawn('hepatocyte', x, y); c.anchor = [x, y];
            }
          }
          for (let i = 0; i < 45; i++) this.spawnOnPath('rbc', i % 3);
          for (let i = 0; i < 3; i++) this.spawn('macrophage', rnd(200, W - 200), rnd(150, H - 150));
          for (let i = 0; i < 3; i++) this.spawn('neutrophil', rnd(200, W - 200), rnd(150, H - 150));
        },
        gut: () => {
          const villi = (this.deco.villi = []);
          for (let i = 0; i < 6; i++) {
            const x = 150 + i * 260 + rnd(-25, 25);
            villi.push({ x, h: rnd(200, 300), w: rnd(46, 62), sway: rnd(0, 6) });
          }
          villi.forEach((v, vi) => {
            for (let s = -1; s <= 1; s += 2) {
              for (let k = 0; k < 4; k++) {
                const yy = H - 40 - (k / 3) * v.h;
                const xx = v.x + s * v.w + Math.sin(v.sway + yy * 0.012) * 14;
                const c = this.spawn('enterocyte', xx, yy); c.anchor = [xx, yy];
              }
            }
          });
          for (let i = 0; i < 18; i++) this.spawn('microbiome', rnd(80, W - 80), rnd(H * 0.25, H - 80));
          for (let i = 0; i < 2; i++) this.spawn('macrophage', rnd(200, W - 200), rnd(150, H - 150));
          this.paths.push(this.loopPath(80, H * 0.55, 500, 180, 40));
          for (let i = 0; i < 25; i++) this.spawnOnPath('rbc', 0);
        },
        marrow: () => {
          this.deco.trabeculae = true;
          const bands = [
            { y: 300, type: 'rbc', n: 22 }, { y: 470, type: 'neutrophil', n: 14 }, { y: 640, type: 'platelet', n: 14 },
          ];
          bands.forEach((b) => {
            for (let i = 0; i < b.n; i++) {
              const c = this.spawn(b.type, rnd(120, W - 120), b.y + rnd(-55, 55));
              c.anchor = [c.x, c.y];
            }
          });
          for (let i = 0; i < 10; i++) {
            const c = this.spawn('hsc', rnd(W * 0.35, W * 0.65), rnd(H * 0.4, H * 0.62));
            c.anchor = [c.x, c.y]; c.divT = rnd(4, 12);
          }
          this.paths.push(this.wavyPath(H * 0.86, 1.6, 46));
          for (let i = 0; i < 16; i++) this.spawnOnPath('rbc', 0);
          for (let i = 0; i < 2; i++) this.spawn('macrophage', rnd(200, W - 200), rnd(150, H - 150));
        },
        skin: () => {
          const layers = (this.deco.layers = [758, 640, 522, 404, 300]);
          layers.forEach((y, li) => {
            if (li >= 4) return;
            const n = 11;
            for (let i = 0; i < n; i++) {
              const x = 90 + (i + (li % 2 ? 0.5 : 0)) * (W - 160) / n;
              const c = this.spawn('keratinocyte', x, y + rnd(-14, 14));
              c.anchor = [c.x, c.y]; c.layer = li;
            }
          });
          for (let i = 0; i < 6; i++) {
            const c = this.spawn('fibroblast', rnd(120, W - 120), 800 + rnd(-20, 30)); c.anchor = [c.x, c.y];
          }
          for (let i = 0; i < 3; i++) this.spawn('langerhans', rnd(150, W - 150), rnd(560, 700));
          for (let i = 0; i < 2; i++) this.spawn('macrophage', rnd(200, W - 200), rnd(720, 830));
          this.paths.push(this.wavyPath(824, 1.2, 40));
          for (let i = 0; i < 20; i++) this.spawnOnPath('rbc', 0);
        },
      };
      (M[id] || (() => {
        // 未知器官：預設散佈上皮細胞 + 巨噬細胞
        for (let i = 0; i < 30; i++) { const c = this.spawn('epithelial', rnd(100, W - 100), rnd(100, H - 100)); c.anchor = [c.x, c.y]; }
        this.spawn('macrophage', W / 2, H / 2);
      }))();
    },

    /* ---- 路徑（微血管）工具 ---- */
    wavyPath(y0, slope, speed) {
      const pts = [];
      for (let x = -40; x <= W + 40; x += 55) pts.push({ x, y: y0 + Math.sin(x * 0.006 + y0) * 36 + (x - W / 2) * slope * 0.06 });
      return this.makePath(pts, speed, false);
    },
    arcPath(y0, bend, speed) {
      const pts = [];
      for (let x = -40; x <= W + 40; x += 55) pts.push({ x, y: y0 + Math.sin((x / W) * Math.PI) * bend });
      return this.makePath(pts, speed, false);
    },
    ringPath(cx, cy, r, speed) {
      const pts = [];
      for (let a = 0; a <= Math.PI * 2.001; a += Math.PI / 12) pts.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      return this.makePath(pts, speed, true);
    },
    loopPath(cx, cy, w, h, speed) {
      const pts = [];
      for (let a = 0; a <= Math.PI * 2.001; a += Math.PI / 14) pts.push({ x: cx + Math.cos(a) * w / 2 + w / 2, y: cy + Math.sin(a) * h / 2 });
      return this.makePath(pts, speed, true);
    },
    makePath(pts, speed, closed) {
      let len = 0; const cum = [0];
      for (let i = 1; i < pts.length; i++) { len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y); cum.push(len); }
      return { pts, cum, len, speed, closed };
    },
    pathPoint(P, s) {
      if (P.closed) s = ((s % P.len) + P.len) % P.len; else s = clamp(s, 0, P.len - 1);
      let i = 1; while (i < P.cum.length - 1 && P.cum[i] < s) i++;
      const t = (s - P.cum[i - 1]) / Math.max(0.001, P.cum[i] - P.cum[i - 1]);
      const a = P.pts[i - 1], b = P.pts[i];
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, ang: Math.atan2(b.y - a.y, b.x - a.x) };
    },
    spawnOnPath(type, pi) {
      const P = this.paths[pi] || this.paths[0];
      if (!P) return;
      const p = this.pathPoint(P, rnd(0, P.len));
      const c = this.spawn(type, p.x, p.y);
      c.path = pi; c.s = (p.x * 3.7) % P.len; c.offA = rnd(0, Math.PI * 2);
      return c;
    },

    /* ================= 細胞 ================= */
    spawn(type, x, y) {
      const d = CS.DATA.cellTypes[type];
      const c = {
        id: this.idSeq++, type, x, y, vx: 0, vy: 0,
        r: d ? d.r : 10, state: 'idle', target: null,
        age: 0, phase: rnd(0, 9), heading: rnd(0, Math.PI * 2),
        hp: 100, infected: 0, dead: false, scale: 1,
        phagocytosed: 0, killCount: 0, evasive: false,
        antigenStock: 0, planted: false,
        divT: type === 'cancer' ? rnd(3, 6) : 1e9,
        wpT: 0, wx: x, wy: y, dangerT: 0, anchor: null,
        apoptose: 0, captured: 0, flash: 0,
      };
      this.cells.push(c);
      return c;
    },
    byType(t) { return this.cells.filter((c) => c.type === t && !c.dead); },
    nearest(type, x, y, filter, maxD) {
      let best = null, bd = 1e9;
      for (const c of this.cells) {
        if (c.dead || c.type !== type) continue;
        if (filter && !filter(c)) continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if (maxD && d > maxD) continue;
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },

    /* ================= 訊號 ================= */
    emit(x, y, kind, opt) {
      const def = SIGDEF[kind] || SIGDEF.chemokine;
      this.signals.push({
        x, y, kind, color: def.color, r: 6,
        speed: def.speed, max: (opt && opt.max) || def.max,
        passed: new Set(), strength: (opt && opt.strength) || 1,
        src: opt && opt.src,
      });
    },
    updateSignals(dt) {
      for (const s of this.signals) {
        const r0 = s.r;
        s.r += s.speed * dt;
        for (const c of this.cells) {
          if (c.dead) continue;
          const d = Math.hypot(c.x - s.x, c.y - s.y);
          if (d > r0 && d <= s.r && !s.passed.has(c.id)) {
            s.passed.add(c.id);
            this.hearSignal(c, s);
          }
        }
      }
      this.signals = this.signals.filter((s) => s.r < s.max);
    },
    hearSignal(c, s) {
      const d = CS.DATA.cellTypes[c.type];
      if (c.type === 'microbiome' && s.kind === 'danger') {
        c.state = 'flee'; c.fx = s.x; c.fy = s.y; c.fleeT = 3;
        return;
      }
      if (!d.receptors || !d.receptors.includes(s.kind)) return;
      if (s.kind === 'danger') {
        if (['macrophage', 'langerhans', 'microglia'].includes(c.type)) {
          c.state = 'alert';
          c.target = s.src && !s.src.dead ? s.src : this.nearest('bacterium', s.x, s.y) || this.nearest('cancer', s.x, s.y);
          if (!c.target) { c.wx = s.x; c.wy = s.y; c.wpT = 5; }
        }
      } else if (s.kind === 'chemokine') {
        if (c.type === 'neutrophil' && c.state !== 'chase') {
          c.state = 'chase';
          c.target = s.src && !s.src.dead && s.src.type === 'bacterium' ? s.src : this.nearest('bacterium', s.x, s.y);
        }
        if (c.type === 'tcell' && this.tReady && c.state !== 'chase') {
          c.target = this.pickTTarget(s.x, s.y); if (c.target) c.state = 'chase';
        }
        if (['macrophage', 'langerhans', 'microglia'].includes(c.type) && c.state === 'idle') {
          c.wx = s.x; c.wy = s.y; c.wpT = 6;
        }
      } else if (s.kind === 'antigen') {
        if (c.type === 'tcell') {
          this.tReady = true; this.antigenPresented = true;
          c.target = this.pickTTarget(c.x, c.y); if (c.target) c.state = 'chase';
        }
      } else if (s.kind === 'growth') {
        if ((c.type === 'fibroblast' || c.type === 'platelet' || c.type === 'macrophage') && this.wound) {
          c.state = c.type === 'platelet' ? 'clotGo' : 'goWound';
        }
      }
    },
    pickTTarget(x, y) {
      return this.nearest('cancer', x, y, (c) => !c.evasive, 600) || this.nearestInfected(x, y, 600);
    },
    nearestInfected(x, y, maxD) {
      let best = null, bd = 1e9;
      for (const c of this.cells) {
        if (c.dead || c.infected <= 0.4) continue;
        const d = Math.hypot(c.x - x, c.y - y);
        if (maxD && d > maxD) continue;
        if (d < bd) { bd = d; best = c; }
      }
      return best;
    },

    /* ================= 主更新 ================= */
    update(rawDt) {
      if (this.paused) return;
      const dt = Math.min(0.05, rawDt) * this.timeScale;
      this.t += dt; this.sT += dt;
      this.inflam += (this.inflamTarget - this.inflam) * Math.min(1, dt * 0.35);
      this.beatFlash = Math.max(0, this.beatFlash - dt * 2.5);
      this.runScenario(dt);
      this.updateSignals(dt);
      this.updatePulses(dt);
      this.organAmbient(dt);
      for (const c of this.cells) this.updateCell(c, dt);
      this.interactions(dt);
      this.updateParticles(dt);
      this.cells = this.cells.filter((c) => !c.dead);
    },

    updateCell(c, dt) {
      if (c.dead) return; // 已標記死亡的細胞不得再執行任何行為（分裂、移動、感染進程、訊號反應）
      c.age += dt; c.phase += dt; c.flash = Math.max(0, c.flash - dt * 3);
      if (c.apoptose > 0) {
        c.apoptose -= dt;
        if (c.apoptose <= 0) {
          c.dead = true;
          if (c.type === 'keratinocyte' && !c.infected) {
            const nx = rnd(90, W - 90);
            const nc = this.spawn('keratinocyte', nx, 758);
            nc.anchor = [nx, 758]; nc.layer = 0; nc.flash = 1;
          }
        }
        return;
      }
      if (c.captured > 0) {
        c.captured -= dt; c.scale = Math.max(0.05, c.captured / 0.7);
        if (c.captured <= 0) c.dead = true;
        return;
      }
      const d = CS.DATA.cellTypes[c.type];

      /* 感染進展 */
      if (c.infected > 0) {
        c.infected += dt * 0.16;
        c.dangerT -= dt;
        if (c.dangerT <= 0) { c.dangerT = 3; this.emit(c.x, c.y, 'danger', { max: 170, src: c }); }
        if (c.infected >= 1) { c.hp -= dt * 9; c.flash = 0.4; }
        if (c.hp <= 0) {
          this.burst(c);
          for (let i = 0; i < 2; i++) this.spawn('bacterium', c.x + rnd(-14, 14), c.y + rnd(-14, 14));
          c.dead = true;
          if (CS.UI) CS.UI.showMsg('細胞裂解——病原體從崩解的細胞中釋出。');
          return;
        }
      }

      /* 路徑跟隨（紅血球 / 血血小板在血管中） */
      if (c.path !== undefined && c.path !== null) {
        const P = this.paths[c.path];
        if (P) {
          const slow = c.type === 'platelet' && this.wound && Math.hypot(c.x - this.wound.x, c.y - this.wound.y) < this.wound.r + 140 ? 0.15 : 1;
          c.s = (c.s + P.speed * slow * dt) % P.len;
          const p = this.pathPoint(P, c.s);
          c.offA += dt * 0.7;
          c.x = p.x + Math.cos(c.offA) * 10; c.y = p.y + Math.sin(c.offA) * 10;
        }
      }

      /* 錨定居民 */
      if (c.anchor && c.path === undefined) {
        if (c.type === 'keratinocyte' && !c.apoptose) {
          c.anchor[1] -= dt * 4.5;
          if (c.anchor[1] < 330) {
            c.apoptose = 1.2;
            if (Math.random() < 0.06 && CS.UI) CS.UI.showMsg('表皮更新：角質化的細胞自表層脫落。');
          }
        }
        const tx = c.anchor[0] + Math.sin(c.phase * 0.9 + c.id) * 3;
        const ty = c.anchor[1] + Math.cos(c.phase * 0.7 + c.id * 1.7) * 3;
        c.x += (tx - c.x) * Math.min(1, dt * 3);
        c.y += (ty - c.y) * Math.min(1, dt * 3);
      }

      /* 依型別的行為 */
      switch (c.type) {
        case 'neutrophil': this.hunterBrain(c, dt, ['bacterium'], 42); break;
        case 'macrophage': case 'langerhans': case 'microglia': this.macroBrain(c, dt); break;
        case 'tcell': this.tBrain(c, dt); break;
        case 'bacterium': {
          this.wanderMove(c, dt, d.speed);
          c.vy += Math.sin(c.phase * 9) * 6 * dt;
          break;
        }
        case 'microbiome': {
          if (c.state === 'flee') {
            c.fleeT -= dt;
            const a = Math.atan2(c.y - c.fy, c.x - c.fx);
            c.vx += Math.cos(a) * 60 * dt; c.vy += Math.sin(a) * 60 * dt;
            if (c.fleeT <= 0) c.state = 'idle';
          } else this.wanderMove(c, dt, d.speed);
          break;
        }
        case 'cancer': {
          c.divT -= dt;
          const n = this.byType('cancer').length;
          if (c.divT <= 0 && n < CANCER_CAP) {
            c.divT = rnd(4, 8);
            const child = this.spawn('cancer', c.x + rnd(-24, 24), c.y + rnd(-24, 24));
            child.evasive = c.evasive; child.flash = 1;
            child.planted = c.planted;              // 血統：注入種子的後代仍標記為植入
            child.gen = (c.gen || 0) + 1;           // 血統：世代計數
            this.emit(c.x, c.y, 'growth', { max: 160 });
          } else if (c.divT <= 0) c.divT = 6;
          this.wanderMove(c, dt, d.speed);
          break;
        }
        case 'hsc': {
          c.divT -= dt;
          if (c.divT <= 0) {
            c.divT = rnd(7, 13);
            const line = ['rbc', 'neutrophil', 'platelet'][Math.floor(rnd(0, 3))];
            const child = this.spawn(line, c.x + rnd(-20, 20), c.y + rnd(-20, 20));
            child.flash = 1; child.anchor = [child.x, child.y];
            child.state = 'mature';
            if (CS.UI && Math.random() < 0.4) CS.UI.showMsg('造血幹細胞分化——新的 ' + CS.DATA.cellTypes[line].name + ' 誕生。');
          }
          this.wanderMove(c, dt, d.speed);
          break;
        }
        case 'fibroblast': {
          if (this.wound) {
            const w = this.wound;
            if (c.state === 'goWound' || Math.hypot(c.x - w.x, c.y - w.y) < w.r + 160) {
              c.state = 'goWound';
              const a = Math.atan2(w.y - c.y, w.x - c.x);
              c.vx += Math.cos(a) * 40 * dt; c.vy += Math.sin(a) * 40 * dt;
              if (Math.hypot(c.x - w.x, c.y - w.y) < w.r * 0.8) {
                c.state = 'collagen';
                if (Math.random() < dt * 3) {
                  this.particles.push({
                    kind: 'strand', x: c.x, y: c.y, x2: c.x + rnd(-46, 46), y2: c.y + rnd(-46, 46),
                    life: 6, max: 6, color: '#c8f5dd',
                  });
                }
              }
            }
          } else if (c.state === 'collagen' || c.state === 'goWound') c.state = 'idle';
          this.wanderMove(c, dt, c.state === 'collagen' ? 3 : d.speed);
          break;
        }
        case 'platelet': {
          const w = this.wound;
          /* 有傷口即歸航：離開 niche（解除錨定）、離開路徑；途中保持 clotGo，
             抵達傷緣才成為 clot——遠方血小板不得遙控癒合 */
          if (w && c.state !== 'clot' && c.state !== 'clotGo') {
            c.state = 'clotGo'; c.anchor = null;
            if (c.path != null) c.path = null;
          }
          if (w && c.state === 'clotGo') {
            if (Math.hypot(c.x - w.x, c.y - w.y) <= w.r + 24) {
              c.state = 'clot';
            } else {
              const a = Math.atan2(c.y - w.y, c.x - w.x);
              const tx = w.x + Math.cos(a) * (w.r + 14), ty = w.y + Math.sin(a) * (w.r + 14);
              c.x += (tx - c.x) * Math.min(1, dt * 2.2);
              c.y += (ty - c.y) * Math.min(1, dt * 2.2);
            }
          }
          if (w && c.state === 'clot') {
            const a = Math.atan2(c.y - w.y, c.x - w.x);
            const rim = w.r + 8;
            c.x += (w.x + Math.cos(a) * rim - c.x) * Math.min(1, dt * 2);
            c.y += (w.y + Math.sin(a) * rim - c.y) * Math.min(1, dt * 2);
          }
          if (!w && (c.state === 'clot' || c.state === 'clotGo')) {
            c.state = 'idle'; c.path = undefined;
          } else if (!w && (c.path === undefined || c.path === null)) {
            this.wanderMove(c, dt, 12);
          }
          break;
        }
        case 'rbc': break;
        default:
          if (!c.anchor) this.wanderMove(c, dt, (d.speed || 8) * 0.5);
      }

      /* 自由移動的慣性整合——由資料驅動：宣告 speed>0 的型別即具移動力；
         路徑跟隨者（path 有效）與錨定居民的座標由各自分支設定 */
      const followed = c.path !== undefined && c.path !== null;
      const mobile = !followed && ((d.speed || 0) > 0 || c.type === 'platelet');
      if (mobile) {
        const fl = this.flowAt(c.x, c.y);
        c.vx += fl.x * dt * 0.25; c.vy += fl.y * dt * 0.25;
        const damp = Math.pow(0.14, dt);
        c.vx *= damp; c.vy *= damp;
        const sp = Math.hypot(c.vx, c.vy), mx = c.type === 'bacterium' ? 60 : 130;
        if (sp > mx) { c.vx = c.vx / sp * mx; c.vy = c.vy / sp * mx; }
        c.x += c.vx * dt; c.y += c.vy * dt;
        const m = 30;
        if (this.organId === 'blood' && c.type !== 'macrophage') {
          if (c.x > W + m) c.x = -m; if (c.x < -m) c.x = W + m;
        } else {
          if (c.x < m) { c.x = m; c.vx = Math.abs(c.vx); }
          if (c.x > W - m) { c.x = W - m; c.vx = -Math.abs(c.vx); }
        }
        if (c.y < m) { c.y = m; c.vy = Math.abs(c.vy); }
        if (c.y > H - m) { c.y = H - m; c.vy = -Math.abs(c.vy); }
      }
    },

    hunterBrain(c, dt, preyTypes, speed) {
      if (c.state === 'apoptosing') { c.apoptose = c.apoptose || 0.001; return; }
      if (!c.target || c.target.dead) {
        c.target = null;
        for (const t of preyTypes) {
          c.target = this.nearest(t, c.x, c.y, null, 420); // 感知半徑：遠端目標須待趨化訊號指引
          if (c.target) break;
        }
        c.state = c.target ? 'chase' : 'patrol';
      }
      if (c.target) {
        const a = Math.atan2(c.target.y - c.y, c.target.x - c.x);
        c.vx += Math.cos(a) * speed * 3 * dt; c.vy += Math.sin(a) * speed * 3 * dt;
        c.state = 'chase';
      } else this.wanderMove(c, dt, speed * 0.45);
      if (c.killCount >= 3 && c.state !== 'apoptosing') {
        c.state = 'apoptosing'; c.apoptose = 2;
        if (CS.UI && Math.random() < 0.5) CS.UI.showMsg('嗜中性球完成任務，走向程序性凋亡。');
      }
    },

    macroBrain(c, dt) {
      const speed = CS.DATA.cellTypes[c.type].speed;
      if (c.state === 'presenting') {
        c.presentT -= dt;
        if (c.presentT <= 0) {
          c.state = 'idle'; c.phagocytosed = 0;
          c.antigenStock = Math.max(0, c.antigenStock - 1); // 呈現消耗一份抗原
          this.emit(c.x, c.y, 'antigen', { src: c });
          this.antigenPresented = true; this.tReady = true;
          if (CS.UI) CS.UI.showMsg('抗原呈現：巨噬細胞把敵情通報給 T 細胞。');
        }
        return;
      }
      if (!c.target || c.target.dead) {
        c.target = this.nearest('bacterium', c.x, c.y, null, 340) ||
          this.nearest('cancer', c.x, c.y, (q) => !q.evasive, 400) ||
          this.nearest('debris', c.x, c.y);
        c.state = c.target ? 'alert' : 'patrol';
      }
      if (c.target) {
        const a = Math.atan2(c.target.y - c.y, c.target.x - c.x);
        c.vx += Math.cos(a) * speed * 3 * dt; c.vy += Math.sin(a) * speed * 3 * dt;
      } else {
        c.wpT -= dt;
        if (c.wpT <= 0) { c.wpT = rnd(3, 6); c.wx = rnd(80, W - 80); c.wy = rnd(80, H - 80); }
        const a = Math.atan2(c.wy - c.y, c.wx - c.x);
        c.vx += Math.cos(a) * speed * 2 * dt; c.vy += Math.sin(a) * speed * 2 * dt;
      }
    },

    tBrain(c, dt) {
      const speed = CS.DATA.cellTypes[c.type].speed;
      if (!this.tReady) { this.wanderMove(c, dt, speed * 0.4); return; }
      if (!c.target || c.target.dead) {
        c.target = this.pickTTarget(c.x, c.y);
        c.state = c.target ? 'chase' : 'patrol';
      }
      if (c.target) {
        const a = Math.atan2(c.target.y - c.y, c.target.x - c.x);
        c.vx += Math.cos(a) * speed * 3 * dt; c.vy += Math.sin(a) * speed * 3 * dt;
      } else this.wanderMove(c, dt, speed * 0.4);
    },

    wanderMove(c, dt, speed) {
      c.heading += (Math.sin(c.phase * 1.7 + c.id * 2.3) + Math.sin(c.phase * 0.9)) * 1.6 * dt;
      c.vx += Math.cos(c.heading) * speed * 2.4 * dt;
      c.vy += Math.sin(c.heading) * speed * 2.4 * dt;
    },

    /* ================= 互動（吞噬 / 感染 / 毒殺） ================= */
    interactions(dt) {
      const eaters = this.cells.filter((c) => ['macrophage', 'langerhans', 'microglia'].includes(c.type) && !c.dead);
      const killers = this.cells.filter((c) => c.type === 'neutrophil' && !c.dead && c.state !== 'apoptosing');
      const ts = this.cells.filter((c) => c.type === 'tcell' && !c.dead && this.tReady);
      const bact = this.cells.filter((c) => c.type === 'bacterium' && !c.dead && c.captured <= 0);
      const tumors = this.cells.filter((c) => c.type === 'cancer' && !c.dead && c.captured <= 0);
      const residents = this.cells.filter((c) => CS.DATA.cellTypes[c.type].infectable && !c.dead);

      for (const m of eaters) {
        let ate = false;
        for (const b of bact) {
          if (b.dead || b.captured > 0) continue;
          if (dist(m, b) < m.r + b.r) {
            b.captured = 0.7; b.capturedBy = m; m.phagocytosed++;
            m.antigenStock++; ate = true;
            this.particles.push({ kind: 'spark', x: b.x, y: b.y, life: 0.5, max: 0.5, color: '#ffd166', n: 8 });
            this.emit(m.x, m.y, 'chemokine', { max: 240, src: m }); // 吞噬中持續召喚友軍
            if (m.state === 'alert' || m.state === 'chase') m.target = null;
            if (this.wound) this.eatDebris(m);
            break;
          }
        }
        if (!ate) {
          for (const t of tumors) {
            if (t.dead || t.captured > 0) continue;
            if (dist(m, t) < m.r + t.r) {
              t.captured = 0.7; t.capturedBy = m; m.phagocytosed++;
              m.antigenStock++; ate = true;
              this.particles.push({ kind: 'spark', x: t.x, y: t.y, life: 0.6, max: 0.6, color: '#ff5ce1', n: 10 });
              if (m.target === t) m.target = null;
              break;
            }
          }
        }
        /* 自然抗原鏈：實際吞噬累積庫存後，哨兵自行展開呈現 */
        if (m.antigenStock >= 2 && m.state !== 'presenting') {
          m.state = 'presenting'; m.presentT = 2.6;
          if (CS.UI && Math.random() < 0.6) CS.UI.showMsg('哨兵累積足夠抗原，開始呈現給 T 細胞。');
        }
        if (!m.target) this.eatDebris(m);
      }
      for (const k of killers) {
        for (const b of bact) {
          if (b.dead) continue;
          if (dist(k, b) < k.r + b.r) {
            b.dead = true; k.killCount++;
            k.flash = 1; b.flash = 1;
            this.particles.push({ kind: 'spark', x: b.x, y: b.y, life: 0.4, max: 0.4, color: '#b7ff4a', n: 10 });
            if (k.target === b) k.target = null;
            break;
          }
        }
      }
      for (const t of ts) {
        if (!t.target || t.target.dead) continue;
        const tgt = t.target;
        if (dist(t, tgt) < t.r + tgt.r + 2) {
          tgt.dead = true; t.flash = 1;
          this.particles.push({ kind: 'spark', x: tgt.x, y: tgt.y, life: 0.6, max: 0.6, color: '#b26bff', n: 12 });
          t.target = null;
          if (tgt.type === 'cancer' && CS.UI && Math.random() < 0.5) CS.UI.showMsg('T 細胞毒殺成功——癌細胞誘導凋亡。');
        }
      }
      for (const b of bact) {
        if (b.dead) continue; // 同一輪互動中已被毒殺的病原體不得再感染細胞
        for (const r of residents) {
          if (r.dead) continue;
          if (dist(b, r) < b.r + r.r) {
            if (r.infected <= 0) r.infected = 0.05;
            const a = Math.atan2(b.y - r.y, b.x - r.x);
            b.vx += Math.cos(a) * 30 * dt; b.vy += Math.sin(a) * 30 * dt;
          }
        }
      }
      /* 血小板補充凝血網 */
      const w = this.wound;
      if (w && Math.random() < dt * 8) {
        const clot = this.cells.filter((c) => c.state === 'clot');
        for (const p of clot) {
          const q = clot[Math.floor(rnd(0, clot.length))];
          if (q !== p && dist(p, q) < 52) {
            this.particles.push({ kind: 'strand', x: p.x, y: p.y, x2: q.x, y2: q.y, life: 1.6, max: 1.6, color: '#ffcf6e' });
          }
        }
      }
    },

    eatDebris(m) {
      for (const p of this.particles) {
        if (p.kind !== 'debris' || p.life <= 0) continue;
        if (Math.hypot(m.x - p.x, m.y - p.y) < m.r + 10) { p.life = 0; m.flash = 0.6; }
      }
    },

    burst(c) {
      this.particles.push({ kind: 'spark', x: c.x, y: c.y, life: 0.7, max: 0.7, color: '#b26bff', n: 14 });
      for (let i = 0; i < 5; i++) {
        this.particles.push({
          kind: 'debris', x: c.x, y: c.y, vx: rnd(-20, 20), vy: rnd(-20, 20),
          life: 14, max: 14, color: '#9a7fd1', size: rnd(2, 3.5),
        });
      }
    },

    updateParticles(dt) {
      for (const p of this.particles) {
        p.life -= dt;
        if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.98; p.vy *= 0.98; }
      }
      this.particles = this.particles.filter((p) => p.life > 0);
      if (this.particles.length > 320) this.particles.splice(0, this.particles.length - 320);
    },

    /* 神經元脈衝的時間推進——屬於模擬狀態，暫停時必須凍結（渲染層僅負責繪製） */
    updatePulses(dt) {
      for (const p of this.pulses) {
        p.t += dt / p.dur;
        if (p.t >= 1) p.done = true;
      }
      this.pulses = this.pulses.filter((p) => !p.done);
    },

    /* ================= 器官情境氛圍 ================= */
    organAmbient(dt) {
      if (this.organ && this.organ.micro && this.organ.micro.pulse) {
        const period = 60 / 72;
        this.heartT += dt;
        if (this.heartT >= period) {
          this.heartT -= period; this.beatFlash = 1;
          this.emit(W * 0.22, H * 0.5, 'pulse', { max: 900, strength: 0.5 });
        }
      }
      if (this.organId === 'brain' && Math.random() < dt * 0.5) this.neuronBurst();
      if (this.organId === 'lungs' && Math.random() < dt * 0.8) {
        const s = this.deco.sacs && this.deco.sacs[Math.floor(rnd(0, this.deco.sacs.length))];
        if (s) this.emit(s.x + rnd(-30, 30), s.y + rnd(-30, 30), 'o2');
      }
    },
    neuronBurst() {
      const links = this.deco.links || [];
      const ns = this.cells.filter((c) => c.type === 'neuron' && !c.dead);
      if (!links.length || ns.length < 2) return;
      const L = links[Math.floor(rnd(0, links.length))];
      const a = ns[L[0]], b = ns[L[1]];
      if (!a || !b) return;
      this.pulses.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, t: 0, dur: Math.max(0.25, Math.hypot(b.x - a.x, b.y - a.y) / 480), chain: 1 });
    },

    /* ================= 情境狀態機 ================= */
    setScenario(id) {
      const sc = CS.DATA.scenarios[id];
      if (!sc) return;
      this.scenarioId = id;
      this.sT = 0; this.scriptIdx = 0; this.loopT = 0;
      this.resolved = false; this.failed = false; this.failT = 0;
      this.tReady = false; this.inflamTarget = 0; this.inflam = Math.min(this.inflam, 0.2);
      this.antigenPresented = false; this._failLastS = 0; this.tAware = false; this.failT = 0;
      /* 軟重置語義：清除異常實體與感染、中斷進行中的呈現、清除訊號環；
         哨兵 antigenStock 保留——那是本器官造訪期間真實吞噬的歷史，
         呈現可由剩餘庫存自然恢復。 */
      for (const c of this.cells) {
        if (['bacterium', 'cancer'].includes(c.type)) { c.dead = true; continue; }
        if (c.infected > 0) { c.infected = 0; c.hp = 100; }
        if (c.state === 'apoptosing') continue;
        if (c.state === 'presenting') { c.state = 'idle'; c.presentT = 0; continue; }
        if (c.state !== 'idle' && c.state !== 'clot') { c.state = 'idle'; c.target = null; }
      }
      this.signals = []; this.pulses = [];
      this.wound = null; this.msgFlags = {};
      if (CS.UI) { CS.UI.showMsg(sc.intro, 4.5); CS.UI.setPhase('起始'); CS.UI.refreshScenario(); }
    },
    runScenario(dt) {
      const sc = CS.DATA.scenarios[this.scenarioId];
      if (!sc) return;
      while (this.scriptIdx < sc.script.length && sc.script[this.scriptIdx].t <= this.sT) {
        this.execStep(sc.script[this.scriptIdx]); this.scriptIdx++;
      }
      if (sc.loop) {
        this.loopT += dt;
        if (this.loopT >= sc.loop.every) {
          this.loopT = 0;
          const A = ACTS[sc.loop.act];
          if (A) A.call(this, sc.loop);
        }
      }
      if (this.scriptIdx >= sc.script.length) this.checkResolve(sc);
    },
    checkResolve(sc) {
      const bact = this.byType('bacterium').length;
      const cancers = this.byType('cancer').length;
      if (this.scenarioId === 'infection') {
        const infected = this.cells.some((c) => !c.dead && c.infected > 0);
        this.setPhase(bact > 0 || infected ? '清除期' : '痊癒');
        if (!this.resolved && bact === 0 && !infected && this.sT > 15) { this.resolved = true; this.finish(sc.resolve); }
        if (this.resolved && (bact > 0 || infected)) this.resolved = false;
      } else if (this.scenarioId === 'repair') {
        this.setPhase(!this.wound ? '完成' : (this.wound.heal > 0.7 ? '重塑期' : '增生期'));
        if (!this.resolved && !this.wound && this.sT > 17) { this.resolved = true; this.finish(sc.resolve); }
        if (this.resolved && this.wound) this.resolved = false;
      } else if (this.scenarioId === 'cancer') {
        /* 失控計時以情境時鐘（sT）差值累計——與影格率、時間倍速無關；
           夾限 0.5s 避免外部直接跳動 sT 時把整段跳變計入持續窗口 */
        const dS = Math.min(0.5, this.sT - (this._failLastS === undefined ? this.sT : this._failLastS));
        this._failLastS = this.sT;
        if (cancers >= CANCER_CAP) this.failT += Math.max(0, dS); else this.failT = 0;
        if (!this.failed && this.failT > 7) {
          this.failed = true;
          if (CS.UI) { CS.UI.showMsg(sc.fail.msg, 5); CS.UI.setPhase(sc.fail.phase, true); }
        }
        if (this.failed && cancers < CANCER_CAP * 0.5) this.failed = false;
        if (!this.failed) {
          this.setPhase(cancers === 0 ? '清除' : cancers >= CANCER_CAP ? '失控' : this.phaseName());
          if (!this.resolved && cancers === 0 && this.sT > 16) { this.resolved = true; this.finish(sc.resolve); }
          if (this.resolved && cancers > 0) this.resolved = false;
        } else this.setPhase(sc.fail.phase, true);
      }
    },
    phaseName() {
      const sc = CS.DATA.scenarios[this.scenarioId];
      for (let i = this.scriptIdx - 1; i >= 0; i--) if (sc.script[i].phase) return sc.script[i].phase;
      return this.phase || '進行中';
    },
    setPhase(p, alert) {
      if (p === this.phase && alert === !!this.phaseAlert) return;
      this.phase = p; this.phaseAlert = !!alert;
      if (CS.UI) CS.UI.setPhase(p, !!alert);
    },
    finish(res) {
      if (!res) return;
      this.inflamTarget = 0.1;
      if (res.act && ACTS[res.act]) ACTS[res.act].call(this, res);
      if (CS.UI) { CS.UI.showMsg(res.msg, 5); CS.UI.setPhase(res.phase); }
    },

    execStep(step) {
      if (step.phase) this.setPhase(step.phase);
      if (step.msg && CS.UI) CS.UI.showMsg(step.msg, 4.2);
      if (step.act && ACTS[step.act]) ACTS[step.act].call(this, step);
    },

    /* ================= 事件動作 ================= */
    ACTS: null, // 於檔尾掛載

    flowAt(x, y) {
      const t = this.t;
      const id = this.organId;
      if (id === 'blood') return { x: 60, y: Math.sin(y * 0.008 + t * 0.6) * 7 };
      if (id === 'liver') {
        for (const ch of this.deco.channels || []) {
          if (Math.abs(y - ch.y0) < 55) return { x: 34 * ch.dir, y: 0 };
        }
        return { x: 0, y: 0 };
      }
      if (id === 'heart') return { x: 26, y: Math.sin(x * 0.004) * 8 };
      if (id === 'gut') return { x: 0, y: -9 };
      return { x: Math.sin(y * 0.006 + t * 0.3) * 7, y: Math.cos(x * 0.006 + t * 0.3) * 7 };
    },

    injectPathogen(n) {
      for (let i = 0; i < (n || 8); i++) {
        const edge = Math.floor(rnd(0, 4));
        const x = edge === 0 ? -10 : edge === 1 ? W + 10 : rnd(0, W);
        const y = edge === 2 ? -10 : edge === 3 ? H + 10 : rnd(0, H);
        this.spawn('bacterium', x, y);
      }
      this.emit(W / 2, H / 2, 'danger', { max: 1400, strength: 0.4 });
      if (CS.UI) CS.UI.showMsg('人工注入：偵測到病原體侵入微環境。');
    },
    makeWound(x, y) {
      this.wound = {
        x: x !== undefined ? x : rnd(W * 0.3, W * 0.7),
        y: y !== undefined ? y : rnd(H * 0.3, H * 0.6),
        r0: 130, r: 130, heal: 0, strands: [], scarT: 0,
      };
      const w = this.wound;
      /* 器官缺乏血小板時，自血流招募應急份額 */
      if (this.byType('platelet').length < 6) {
        for (let i = 0; i < 10; i++) {
          const edge = Math.floor(rnd(0, 4));
          const px = edge === 0 ? -14 : edge === 1 ? W + 14 : rnd(0, W);
          const py = edge === 2 ? -14 : edge === 3 ? H + 14 : rnd(0, H);
          const c = this.spawn('platelet', px, py);
          c.flash = 1;
        }
      }
      for (let i = 0; i < 22; i++) {
        const a = rnd(0, Math.PI * 2), rr = rnd(0, w.r);
        this.particles.push({
          kind: 'debris', x: w.x + Math.cos(a) * rr, y: w.y + Math.sin(a) * rr,
          vx: rnd(-8, 8), vy: rnd(-8, 8), life: 16, max: 16, color: '#ff9d7a', size: rnd(2, 4),
        });
      }
      if (CS.UI) CS.UI.showMsg('人工介入：微血管破裂，組織缺損形成。');
    },
    mutateRandom() {
      const pick = (arr) => arr.length ? arr[Math.floor(rnd(0, arr.length))] : null;
      const immune = ['bacterium', 'cancer', 'tcell', 'neutrophil', 'macrophage', 'microglia', 'langerhans', 'fibroblast', 'platelet'];
      let src = pick(this.cells.filter((c) => CS.DATA.cellTypes[c.type].infectable && !c.dead && !c.infected));
      let srcName = null;
      if (src) {
        srcName = CS.DATA.cellTypes[src.type].name;
      } else {
        src = pick(this.cells.filter((c) => c.anchor && !immune.includes(c.type) && !c.dead));
        if (src) srcName = CS.DATA.cellTypes[src.type].name;
      }
      if (src) {
        src.dead = true;
        const cc = this.spawn('cancer', src.x, src.y); cc.flash = 1;
        if (CS.UI) CS.UI.showMsg('人工誘變：一顆 ' + srcName + ' 發生癌變。');
      } else {
        const cc = this.spawn('cancer', rnd(200, W - 200), rnd(150, H - 150));
        cc.flash = 1; cc.planted = true;
        if (CS.UI) CS.UI.showMsg('示範注入：人工加入一顆腫瘤種子細胞（非自然突變事件）。');
      }
    },
    purge() {
      /* 完全重置語義：清除異常實體與感染、中斷呈現、清空哨兵抗原記憶、
         清除訊號環與脈衝。存活細胞的 antigenStock 歸零——淨化不含歷史記憶。 */
      for (const c of this.cells) {
        if (['bacterium', 'cancer'].includes(c.type)) { c.dead = true; continue; }
        if (c.infected > 0) { c.infected = 0; c.hp = 100; c.dangerT = 0; }
        c.antigenStock = 0;
        if (c.state !== 'idle' && c.state !== 'clot') { c.state = 'idle'; c.target = null; c.presentT = 0; }
      }
      this.particles = this.particles.filter((p) => p.kind !== 'debris');
      this.signals = []; this.pulses = [];
      this.wound = null; this.inflamTarget = 0; this.tReady = false;
      this.antigenPresented = false; this.msgFlags = {}; this.failT = 0; this.tAware = false; // 硬重置不得沿用已清除的歷史（M0）
      this.resolved = false; this.failed = false; this._failLastS = this.sT;
      if (CS.UI) CS.UI.showMsg('人工淨化：微環境已完全重置（含哨兵抗原記憶）。', 3.5);
    },

    snapshot() {
      const counts = {};
      for (const c of this.cells) if (!c.dead) counts[c.type] = (counts[c.type] || 0) + 1;
      return {
        t: this.t, organ: this.organId, scenario: this.scenarioId, phase: this.phase,
        inflammation: this.inflam, bacteria: counts.bacterium || 0, cancers: counts.cancer || 0,
        wound: this.wound ? { heal: this.wound.heal } : null, counts,
      };
    },
  };

  /* T 細胞展開——屬於引擎本體的行為（情境動作與自然抗原鏈皆可呼叫） */
  E.deployT = function () {
    this.tReady = true;
    for (const t of this.byType('tcell')) { t.target = this.pickTTarget(t.x, t.y); if (t.target) t.state = 'chase'; }
  };

  /* ---------- 情境動作库 ---------- */
  const ACTS = (E.ACTS = {
    spawnPathogens(s) {
      for (let i = 0; i < (s.n || 14); i++) {
        const edge = Math.floor(rnd(0, 4));
        const x = edge === 0 ? -10 : edge === 1 ? W + 10 : rnd(0, W);
        const y = edge === 2 ? -10 : edge === 3 ? H + 10 : rnd(0, H);
        E.spawn('bacterium', x, y);
      }
      if (CS.UI) CS.UI.showMsg('病原體突破屏障，自邊緣湧入微環境。');
    },
    dangerBurst() {
      for (const b of E.byType('bacterium')) E.emit(b.x, b.y, 'danger', { max: 240, src: b });
      if (CS.UI) CS.UI.showMsg('組織哨兵偵測到病原體，釋放危險訊號（DAMP / IL-1）。');
    },
    chemoBurst() {
      for (const m of E.byType('macrophage')) E.emit(m.x, m.y, 'chemokine', { src: m });
      for (const m of E.byType('microglia')) E.emit(m.x, m.y, 'chemokine', { src: m });
      for (const m of E.byType('langerhans')) E.emit(m.x, m.y, 'chemokine', { src: m });
    },
    recruitNeutrophils(s) {
      for (let i = 0; i < (s.n || 8); i++) {
        const P = E.paths[0] || E.paths[Math.floor(rnd(0, E.paths.length))];
        if (!P) break;
        const p = E.pathPoint(P, rnd(0, P.len));
        const c = E.spawn('neutrophil', p.x, p.y);
        c.target = E.nearest('bacterium', c.x, c.y);
        if (c.target) c.state = 'chase';
        c.flash = 1;
      }
    },
    inflammation(s) { E.inflamTarget = s.v || 0.6; },
    alertT() {
      E.tAware = true;
      if (CS.UI) CS.UI.showMsg('T 細胞進入待命——等待抗原呈現的確認。');
    },
    topUpPathogens(s) {
      const b = E.byType('bacterium').length;
      const max = (s && s.maxBact) || 26;
      if (b > 0 && b < max * 0.45) for (let i = 0; i < 3; i++) E.spawn('bacterium', rnd(0, W), rnd(0, H));
      /* 骨髓持續釋出嗜中性球——感染未清前補員不斷 */
      if (b > 0 && E.byType('neutrophil').length < 4) {
        const P = E.paths[0] || E.paths[Math.floor(rnd(0, E.paths.length))];
        for (let i = 0; i < 2 && P; i++) {
          const p = E.pathPoint(P, rnd(0, P.len));
          const c = E.spawn('neutrophil', p.x, p.y);
          c.target = E.nearest('bacterium', c.x, c.y);
          if (c.target) c.state = 'chase';
          c.flash = 1;
        }
      }
    },
    makeWound() { E.makeWound(); },
    growthBurst() {
      const w = E.wound; if (!w) return;
      for (let i = 0; i < 3; i++) {
        const a = rnd(0, Math.PI * 2);
        E.emit(w.x + Math.cos(a) * w.r, w.y + Math.sin(a) * w.r, 'growth');
      }
      if (CS.UI) CS.UI.showMsg('血小板釋放 PDGF——招募修復部隊抵達傷區。');
    },
    recruitRepair() {
      for (let i = 0; i < 6; i++) {
        const c = E.spawn('fibroblast', -20, rnd(100, H - 100)); c.state = 'goWound'; c.flash = 1;
      }
      for (let i = 0; i < 3; i++) {
        const c = E.spawn('macrophage', W + 20, rnd(100, H - 100)); c.state = 'alert'; c.flash = 1;
      }
    },
    mutateOne() { E.mutateRandom(); },
    alertMacs() {
      for (const m of E.byType('macrophage')) { m.target = E.nearest('cancer', m.x, m.y); if (m.target) m.state = 'alert'; }
    },
    presentAntigen() {
      /* 劇本介入性質：只能安排「已持有抗原」的哨兵呈現，不可無中生有 */
      const stocked = E.cells.filter((c) =>
        ['macrophage', 'microglia', 'langerhans'].includes(c.type) && !c.dead && c.antigenStock > 0);
      if (!stocked.length) {
        if (CS.UI) CS.UI.showMsg('哨兵尚未取得抗原——呈現將於實際吞噬完成後自然發生。');
        return;
      }
      for (const m of stocked) if (m.state !== 'presenting') { m.state = 'presenting'; m.presentT = 2.6; }
    },
    activateT() {
      /* 招募 T 細胞（不足時自血流馳援） */
      if (this.byType('tcell').length < 6) {
        for (let i = 0; i < 6; i++) {
          const edge = Math.floor(rnd(0, 4));
          const x = edge === 0 ? -14 : edge === 1 ? W + 14 : rnd(0, W);
          const y = edge === 2 ? -14 : edge === 3 ? H + 14 : rnd(0, H);
          const c = this.spawn('tcell', x, y);
          c.flash = 1;
        }
      }
      /* 契約：T 細胞僅能在抗原呈現之後啟動，且呈現必須有真實抗原庫存
         （哨兵實際吞噬過病原體／病變細胞）。缺貨時不偽造呈現者，
         僅標示劇本介入性質並等待自然吞噬完成。 */
      if (!this.antigenPresented) {
        const stocked = this.cells.filter((c) =>
          ['macrophage', 'microglia', 'langerhans'].includes(c.type) && !c.dead && c.antigenStock > 0);
        if (stocked.length > 0) {
          for (const m of stocked) if (m.state !== 'presenting') { m.state = 'presenting'; m.presentT = 1.6; }
          if (CS.UI) CS.UI.showMsg('哨兵已持有抗原——呈現即將完成，T 細胞準備啟動。');
        } else if (CS.UI) {
          CS.UI.showMsg('抗原尚未取得——T 細胞保持待命，等待哨兵吞噬病原體或病變細胞。');
        }
        return; // 自然呈現完成後，由抗原訊號啟動 tReady
      }
      this.deployT();
    },
    cancerTwist() {
      const cs = E.byType('cancer');
      if (cs.length < 3 || E.msgFlags && E.msgFlags.evasion) return;
      const c = cs[Math.floor(rnd(0, cs.length))];
      if (!c || c.evasive) return;
      c.evasive = true;
      for (const t of E.byType('tcell')) if (t.target === c) { t.target = null; t.state = 'patrol'; }
      if (CS.UI) {
        CS.UI.showMsg('部分癌細胞下调 MHC-I 表現——逃過了 T 細胞的辨認（免疫逃逸）。', 4.5);
        E.msgFlags = E.msgFlags || {}; E.msgFlags.evasion = true;
      }
    },
    ambient() {
      const org = E.organ;
      const pool = (org && org.ambient) || ['微環境恆定：細胞各司其職。'];
      const msg = pool[E.ambientIdx % pool.length]; E.ambientIdx++;
      if (CS.UI) CS.UI.showMsg(msg, 4);
      if (E.organId === 'brain') E.neuronBurst();
      if (E.organId === 'marrow' && Math.random() < 0.5) {
        const h = E.byType('hsc')[0];
        if (h) { h.divT = 0.1; }
      }
      if (E.organId === 'lungs' && Math.random() < 0.6) {
        const s = E.deco.sacs && E.deco.sacs[0];
        if (s) E.emit(s.x, s.y, 'o2');
      }
    },
    settle() {
      E.inflamTarget = 0.1;
      for (const n of E.byType('neutrophil')) if (n.killCount > 0) { n.state = 'apoptosing'; n.apoptose = 2.5; }
    },
    woundDone() {
      if (E.wound) { E.wound.scarT = 12; }
      for (const f of E.byType('fibroblast')) if (f.state === 'collagen') f.state = 'idle';
    },
  });

  /* 傷口癒合推進 */
  E._origUpdate = E.update;
  E.update = function (rawDt) {
    this._origUpdate(rawDt);
    if (this.paused) return;
    const dt = Math.min(0.05, rawDt) * this.timeScale;
    const w = this.wound;
    if (w && w.heal < 1) {
      /* 修復公式只計入「位於傷口附近、正在有效作用」的細胞 */
      const near = (c, pad) => Math.hypot(c.x - w.x, c.y - w.y) < w.r + pad;
      const fib = this.cells.filter((c) => c.state === 'collagen' && near(c, 90)).length;
      const mac = this.cells.filter((c) => c.type === 'macrophage' && near(c, 0)).length;
      const clot = this.cells.filter((c) => c.state === 'clot' && near(c, 40)).length;
      const responders = fib + mac + clot;
      if (responders > 0) {
        w.heal = Math.min(1, w.heal + dt * (0.004 + 0.006 * fib + 0.004 * mac + 0.002 * clot));
        w.r = w.r0 * (1 - w.heal * 0.92);
        if (w.heal >= 1 && !w.done) { w.done = true; this.finish(CS.DATA.scenarios.repair.resolve); }
      }
    } else if (w && w.scarT > 0) {
      w.scarT -= dt;
      if (w.scarT <= 0) this.wound = null;
    }
  };

  CS.Engine = E;
  CS.SIGDEF = SIGDEF;
  CS.CANCER_CAP = CANCER_CAP;
})();
