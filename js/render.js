/* ============================================================
   CELLSCAPE · render.js
   渲染層：人體全景 / 微觀場景 / 細胞精靈圖 / 訊號特效 / 轉場
   ============================================================ */
(function () {
  const CS = window.CS;
  const TAU = Math.PI * 2;
  const rnd = (a, b) => a + Math.random() * (b - a);

  const R = (CS.Render = {
    cam: { x: 800, y: 450, zoom: 1, baseZoom: 1 },
    mode: 'body',
    trans: null,
    mouse: { x: -1, y: -1 },
    sprites: {},
    bg: null,
    streaks: [],
    hoverOrgan: null,

    init(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.resize();
      for (let i = 0; i < 46; i++) {
        this.streaks.push({ a: rnd(0, TAU), r0: rnd(0.2, 0.55), len: rnd(0.1, 0.4), w: rnd(0.6, 2) });
      }
      this._streakSeed = [];
      for (let i = 0; i < 40; i++) this._streakSeed.push(rnd(0, TAU));
    },

    resize() {
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.cw = window.innerWidth; this.ch = window.innerHeight;
      this.canvas.width = this.cw * this.dpr;
      this.canvas.height = this.ch * this.dpr;
      /* 繪圖緩衝區可為 dpr 倍解析度，CSS 顯示尺寸必須固定為視窗大小，
         否則高 DPI 畫面會被放大裁切 */
      this.canvas.style.width = this.cw + 'px';
      this.canvas.style.height = this.ch + 'px';
    },

    /* ================= 主繪製 ================= */
    frame(tReal) {
      const { ctx, cw, ch } = this;
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      const g = ctx.createLinearGradient(0, 0, 0, ch);
      g.addColorStop(0, '#02060e'); g.addColorStop(0.55, '#041022'); g.addColorStop(1, '#02060e');
      ctx.fillStyle = g; ctx.fillRect(0, 0, cw, ch);

      const E = CS.Engine;
      const tr = this.trans;
      if (tr) {
        tr.t += Math.min(0.05, this._dt || 0.016);
        const p = Math.min(1, tr.t / tr.dur);
        if (tr.dir === 'in') {
          const pA = Math.min(1, p / 0.55);
          if (p < 0.55) this.drawBody(1 - pA * 1.05, 1 + pA * pA * 7, tr.focus);
          else this.drawMicro(Math.min(1, (p - 0.5) * 2.4), 1 + (1 - (p - 0.5) / 0.5) * 2.1);
        } else {
          if (p < 0.55) this.drawMicro(1 - p / 0.52, 1 + (p / 0.5) * 2.4);
          else {
            const pA = (p - 0.5) / 0.5;
            this.drawBody(Math.min(1, (p - 0.45) * 2), Math.max(1, 8 - pA * 7), tr.focus);
          }
        }
        this.drawStreaks(Math.sin(p * Math.PI));
        if (p >= 1) { const cb = tr.done; this.trans = null; if (cb) cb(); }
      } else if (this.mode === 'body') {
        this.drawBody(1, 1, null);
      } else {
        this.drawMicro(1, 1);
      }

      /* 螢幕級氛圍：發炎紅暈 / 心跳閃爍 */
      const infl = E.organId ? E.inflam : 0;
      if (infl > 0.02) {
        ctx.globalCompositeOperation = 'source-over';
        const vg = ctx.createRadialGradient(cw / 2, ch / 2, ch * 0.32, cw / 2, ch / 2, ch * 0.85);
        vg.addColorStop(0, 'rgba(255,60,70,0)');
        vg.addColorStop(1, `rgba(255,50,70,${(0.28 * infl).toFixed(3)})`);
        ctx.fillStyle = vg; ctx.fillRect(0, 0, cw, ch);
      }
      if (E.organId && E.organ && E.organ.micro && E.organ.micro.pulse && E.beatFlash > 0) {
        ctx.fillStyle = `rgba(255,120,150,${(E.beatFlash * 0.05).toFixed(3)})`;
        ctx.fillRect(0, 0, cw, ch);
      }
    },

    drawStreaks(alpha) {
      if (alpha <= 0.01) return;
      const { ctx, cw, ch } = this;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.translate(cw / 2, ch / 2);
      for (let i = 0; i < this.streaks.length; i++) {
        const s = this.streaks[i];
        const a = s.a + this._streakSeed[i % 40] * 0.1;
        const r0 = s.r0 * Math.max(cw, ch), r1 = r0 + s.len * Math.max(cw, ch);
        ctx.globalAlpha = alpha * 0.5;
        ctx.strokeStyle = '#9fe9ff'; ctx.lineWidth = s.w;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
        ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },

    /* ================= 人體全景 ================= */
    bodyMap(bx, by, zoom, focus) {
      const s = this._bodyScale, cx = this.cw / 2, cy = this.ch * 0.53;
      let x = cx + (bx - 50) * s, y = cy + (by - 100) * s;
      if (zoom && zoom !== 1 && focus) {
        const fx = cx + (focus[0] - 50) * s, fy = cy + (focus[1] - 100) * s;
        x = fx + (x - fx) * zoom; y = fy + (y - fy) * zoom;
      }
      return { x, y, s };
    },
    drawBody(alpha, zoom, focus) {
      const { ctx, cw, ch } = this;
      const D = CS.DATA;
      this._bodyScale = Math.min(cw / 150, ch / 250) * 0.92;

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));

      /* 背景環 */
      const t = performance.now() / 1000;
      ctx.save();
      ctx.translate(cw / 2, ch * 0.53);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const rr = 130 + i * 110 + Math.sin(t * 0.4 + i) * 6;
        ctx.strokeStyle = `rgba(77,227,255,${0.05 + i * 0.02})`;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 14]);
        ctx.rotate(t * 0.02 * (i % 2 ? 1 : -1));
        ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.restore();

      /* 輪廓 */
      const pts = D.bodyPath;
      const mirror = pts.slice(0, -2).reverse().map((p) => [100 - p[0], p[1]]);
      const full = pts.concat(mirror);
      this.tracePath(full, zoom, focus);
      ctx.fillStyle = 'rgba(10,30,52,0.55)';
      ctx.fill();
      ctx.shadowColor = 'rgba(77,227,255,0.8)'; ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(140,235,255,0.85)'; ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* 頭 */
      const hp = this.bodyMap(50, 15, zoom, focus);
      ctx.beginPath();
      ctx.arc(hp.x, hp.y + (hp.s * -1) * 0, this._bodyScale * 10.5, 0, TAU);
      ctx.fillStyle = 'rgba(10,30,52,0.55)';
      ctx.fill();
      ctx.shadowColor = 'rgba(77,227,255,0.8)'; ctx.shadowBlur = 18;
      ctx.strokeStyle = 'rgba(140,235,255,0.85)'; ctx.lineWidth = 1.6;
      ctx.stroke();
      ctx.shadowBlur = 0;

      /* 血管流 */
      ctx.save();
      ctx.lineCap = 'round';
      for (const v of D.bodyVessels) {
        const P = v.map((p) => this.bodyMap(p[0], p[1], zoom, focus));
        ctx.beginPath();
        ctx.moveTo(P[0].x, P[0].y);
        for (let i = 1; i < P.length - 1; i++) {
          const mx = (P[i].x + P[i + 1].x) / 2, my = (P[i].y + P[i + 1].y) / 2;
          ctx.quadraticCurveTo(P[i].x, P[i].y, mx, my);
        }
        ctx.lineTo(P[P.length - 1].x, P[P.length - 1].y);
        ctx.strokeStyle = 'rgba(255,93,115,0.28)'; ctx.lineWidth = 4; ctx.stroke();
        ctx.strokeStyle = 'rgba(255,93,115,0.75)'; ctx.lineWidth = 1.4;
        ctx.setLineDash([3, 26]); ctx.lineDashOffset = -t * 60;
        ctx.stroke(); ctx.setLineDash([]);
      }
      ctx.restore();

      /* 掃描線 */
      const sy = ((t * 40) % (ch * 1.3)) - ch * 0.15;
      const sg = ctx.createLinearGradient(0, sy - 60, 0, sy + 60);
      sg.addColorStop(0, 'rgba(77,227,255,0)');
      sg.addColorStop(0.5, 'rgba(77,227,255,0.055)');
      sg.addColorStop(1, 'rgba(77,227,255,0)');
      ctx.fillStyle = sg; ctx.fillRect(0, sy - 60, cw, 120);

      /* 器官節點 */
      this.hoverOrgan = null;
      for (const id in D.organs) {
        const o = D.organs[id];
        const p = this.bodyMap(o.bodyPos[0], o.bodyPos[1], zoom, focus);
        const m = this.mouse;
        const hov = this.mode === 'body' && !this.trans && Math.hypot(m.x - p.x, m.y - p.y) < 24;
        if (hov) this.hoverOrgan = id;
        const beat = (id === 'heart') ? Math.pow(Math.max(0, Math.sin(t * 2.2)), 6) : 0;
        const pulse = 0.5 + 0.5 * Math.sin(t * (1.6 + beat * 4) + o.bodyPos[0]);
        const base = hov ? 17 : 14;

        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.strokeStyle = o.color; ctx.fillStyle = o.color;
        ctx.globalAlpha = alpha * (0.5 + pulse * 0.3);
        ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.arc(p.x, p.y, base + pulse * 5, 0, TAU); ctx.stroke();
        ctx.globalAlpha = alpha * 0.35;
        ctx.beginPath(); ctx.arc(p.x, p.y, base + 14 + pulse * 10, 0, TAU); ctx.stroke();
        ctx.globalAlpha = alpha * (hov ? 0.95 : 0.8);
        ctx.shadowColor = o.color; ctx.shadowBlur = 16;
        ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, TAU);
        ctx.fillStyle = 'rgba(5,15,28,0.9)'; ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.restore();

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = hov ? '#fff' : o.color;
        ctx.font = '600 13px "Noto Sans TC","Microsoft JhengHei",sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.shadowColor = o.color; ctx.shadowBlur = hov ? 14 : 8;
        ctx.fillText(o.glyph, p.x, p.y + 0.5);
        ctx.shadowBlur = 0;
        ctx.font = '600 12px "Noto Sans TC","Microsoft JhengHei",sans-serif';
        ctx.fillStyle = hov ? '#ffffff' : 'rgba(216,237,246,0.85)';
        ctx.fillText(o.name, p.x, p.y + base + 18);
        ctx.font = '9px Consolas,monospace';
        ctx.fillStyle = 'rgba(127,162,184,0.7)';
        ctx.fillText(o.en.toUpperCase(), p.x, p.y + base + 31);
        if (hov) {
          ctx.font = '11px "Noto Sans TC","Microsoft JhengHei",sans-serif';
          ctx.fillStyle = 'rgba(159,242,255,0.95)';
          ctx.fillText(o.brief, p.x, p.y - base - 14);
        }
        ctx.restore();
      }
      ctx.restore();
    },

    tracePath(full, zoom, focus) {
      const { ctx } = this;
      ctx.beginPath();
      let prev = null;
      for (let i = 0; i < full.length; i++) {
        const p = this.bodyMap(full[i][0], full[i][1], zoom, focus);
        if (i === 0) ctx.moveTo(p.x, p.y);
        else {
          const mx = (prev.x + p.x) / 2, my = (prev.y + p.y) / 2;
          ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
        }
        prev = p;
      }
      ctx.closePath();
    },

    /* ================= 微觀場景 ================= */
    worldToScreen(wx, wy) {
      return {
        x: (wx - this.cam.x) * this.cam.zoom + this.cw / 2,
        y: (wy - this.cam.y) * this.cam.zoom + this.ch / 2,
      };
    },
    screenToWorld(sx, sy) {
      return {
        x: (sx - this.cw / 2) / this.cam.zoom + this.cam.x,
        y: (sy - this.ch / 2) / this.cam.zoom + this.cam.y,
      };
    },

    buildBg() {
      const E = CS.Engine;
      const scale = 2;
      const cv = document.createElement('canvas');
      cv.width = E.W * scale; cv.height = E.H * scale;
      const c = cv.getContext('2d');
      c.scale(scale, scale);
      /* 依器官「宣告的背景樣式」路由（micro.bg），而非器官 id */
      const style = (E.organ && E.organ.micro && E.organ.micro.bg) || '';
      const drawer = BG[style] || BG.default;
      drawer(c, E, this);
      this.bg = cv;
    },

    drawMicro(alpha, zoomMul) {
      const { ctx, cw, ch } = this;
      const E = CS.Engine;
      const z = this.cam.zoom * zoomMul;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.setTransform(this.dpr * z, 0, 0, this.dpr * z, this.dpr * (cw / 2 - this.cam.x * z), this.dpr * (ch / 2 - this.cam.y * z));

      if (this.bg) ctx.drawImage(this.bg, 0, 0, E.W, E.H);
      this.drawWound(ctx, E);
      this.drawParticlesUnder(ctx, E);
      this.drawCells(ctx, E);
      this.drawSignals(ctx, E);
      this.drawPulses(ctx, E);
      this.drawSparks(ctx, E);
      this.drawSelection(ctx, E);

      ctx.restore();
      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      ctx.globalAlpha = 1;
    },

    drawCells(ctx, E) {
      const beat = E.organ && E.organ.micro && E.organ.micro.pulse
        ? (E.heartT / (60 / 72)) % 1 : -1;
      for (const c of E.cells) {
        if (c.dead) continue;
        const sp = this.sprite(c.type);
        if (!sp) continue;
        let sc = c.scale * (1 + Math.sin(c.phase * 2.6 + c.id) * 0.035);
        let alpha = 1;
        if (c.apoptose > 0) alpha = Math.max(0, Math.min(1, c.apoptose / 1.6));
        if (c.type === 'cardiomyocyte' && beat >= 0) {
          const off = (c.x / E.W) * 0.22;
          const wv = Math.pow(Math.max(0, Math.sin((beat - off) * TAU)), 3);
          sc *= 1 + wv * 0.13;
          alpha = 0.85 + wv * 0.15;
        }
        let rot = 0;
        if (c.type === 'rbc') rot = c.phase * 1.1;
        else if (c.type === 'bacterium' || c.type === 'microbiome') rot = Math.atan2(c.vy, c.vx);
        else rot = Math.sin(c.phase * 0.5 + c.id) * 0.3;

        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(rot);
        if (c.type === 'rbc') ctx.scale(1, 0.78 + 0.22 * Math.sin(c.phase * 1.4));
        ctx.scale(sc, sc);
        ctx.globalAlpha = alpha * 0.96;
        ctx.drawImage(sp.cv, -sp.half, -sp.half, sp.size, sp.size);
        ctx.restore();

        /* 感染斑 */
        if (c.infected > 0) {
          ctx.save();
          ctx.translate(c.x, c.y);
          ctx.globalAlpha = Math.min(1, c.infected) * 0.8;
          ctx.fillStyle = '#b26bff';
          ctx.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 3; k++) {
            const a = c.phase * 0.4 + k * 2.1 + c.id;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * c.r * 0.45, Math.sin(a) * c.r * 0.45, c.r * 0.3, 0, TAU);
            ctx.fill();
          }
          ctx.restore();
        }
        if (c.flash > 0) {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = c.flash * 0.55;
          ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r * 1.1, 0, TAU); ctx.fill();
          ctx.restore();
        }
        /* 狀態光環 */
        if (c.state === 'chase' || c.state === 'alert') {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.35 + 0.2 * Math.sin(c.phase * 8);
          ctx.strokeStyle = c.state === 'chase' ? '#ff5470' : '#ffd166';
          ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 5, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        if (c.state === 'presenting') {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = '#b26bff'; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(c.x, c.y, c.r + 7 + Math.sin(c.phase * 6) * 2, 0, TAU); ctx.stroke();
          ctx.restore();
        }
        /* 神經元樹突 */
        if (c.type === 'neuron') this.drawDendrites(ctx, c);
        if (c.type === 'langerhans' || c.type === 'microglia') this.drawRays(ctx, c, 5);
      }
    },
    drawDendrites(ctx, c) {
      if (!c._den) {
        c._den = [];
        for (let i = 0; i < 4; i++) c._den.push({ a: rnd(0, TAU), l: rnd(16, 30) });
      }
      ctx.save();
      ctx.strokeStyle = 'rgba(201,179,255,0.4)'; ctx.lineWidth = 1;
      for (const d of c._den) {
        const a = d.a + Math.sin(c.phase * 0.4 + c.id) * 0.08;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.quadraticCurveTo(
          c.x + Math.cos(a) * d.l * 0.6 + Math.cos(a + 1.2) * 6,
          c.y + Math.sin(a) * d.l * 0.6 + Math.sin(a + 1.2) * 6,
          c.x + Math.cos(a) * d.l, c.y + Math.sin(a) * d.l
        );
        ctx.stroke();
      }
      ctx.restore();
    },
    drawRays(ctx, c, n) {
      ctx.save();
      ctx.strokeStyle = 'rgba(215,179,77,0.35)'; ctx.lineWidth = 1;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU + c.phase * 0.3 + c.id;
        ctx.beginPath();
        ctx.moveTo(c.x + Math.cos(a) * c.r * 0.8, c.y + Math.sin(a) * c.r * 0.8);
        ctx.lineTo(c.x + Math.cos(a) * (c.r + 9), c.y + Math.sin(a) * (c.r + 9));
        ctx.stroke();
      }
      ctx.restore();
    },

    drawSignals(ctx, E) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const s of E.signals) {
        const k = 1 - s.r / s.max;
        ctx.globalAlpha = k * 0.5 * (s.strength || 1);
        ctx.strokeStyle = s.color;
        ctx.lineWidth = 2.4;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.stroke();
        ctx.globalAlpha = k * 0.16 * (s.strength || 1);
        ctx.lineWidth = 9;
        ctx.beginPath(); ctx.arc(s.x, s.y, Math.max(1, s.r - 5), 0, TAU); ctx.stroke();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
    drawPulses(ctx, E) {
      /* 脈衝的時間推進由引擎負責（updatePulses）——暫停時不得繼續移動 */
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of E.pulses) {
        if (p.done || p.t >= 1) continue;
        const x = p.ax + (p.bx - p.ax) * p.t, y = p.ay + (p.by - p.ay) * p.t;
        ctx.globalAlpha = 0.25;
        ctx.strokeStyle = '#c9b3ff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.ax, p.ay); ctx.lineTo(p.bx, p.by); ctx.stroke();
        ctx.globalAlpha = 0.95;
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = '#c9b3ff'; ctx.shadowBlur = 12;
        ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
    drawParticlesUnder(ctx, E) {
      for (const p of E.particles) {
        if (p.kind === 'debris') {
          ctx.globalAlpha = Math.min(1, p.life / 3) * 0.85;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size || 2.6, 0, TAU); ctx.fill();
        } else if (p.kind === 'strand') {
          ctx.globalAlpha = Math.min(1, p.life / p.max) * 0.55;
          ctx.strokeStyle = p.color; ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x2, p.y2); ctx.stroke();
        }
      }
      ctx.globalAlpha = 1;
    },
    drawSparks(ctx, E) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of E.particles) {
        if (p.kind !== 'spark') continue;
        const k = p.life / p.max;
        ctx.globalAlpha = k;
        ctx.strokeStyle = p.color; ctx.lineWidth = 1.4;
        const n = p.n || 8;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * TAU + p.x;
          const r0 = (1 - k) * 18 + 3, r1 = r0 + 6 * k;
          ctx.beginPath();
          ctx.moveTo(p.x + Math.cos(a) * r0, p.y + Math.sin(a) * r0);
          ctx.lineTo(p.x + Math.cos(a) * r1, p.y + Math.sin(a) * r1);
          ctx.stroke();
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    },
    drawWound(ctx, E) {
      const w = E.wound;
      if (!w) return;
      if (!w._jag) {
        w._jag = [];
        for (let i = 0; i < 40; i++) w._jag.push(rnd(-9, 9));
      }
      ctx.save();
      ctx.translate(w.x, w.y);
      ctx.beginPath();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * TAU;
        const rr = w.r + w._jag[i % 40];
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(20,6,10,0.85)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,84,112,0.75)';
      ctx.lineWidth = 2.5;
      ctx.shadowColor = 'rgba(255,84,112,0.8)'; ctx.shadowBlur = 16;
      ctx.stroke();
      ctx.shadowBlur = 0;
      /* 肉芽組織 */
      if (w.heal > 0) {
        ctx.beginPath();
        for (let i = 0; i <= 40; i++) {
          const a = (i / 40) * TAU;
          const rr = (w.r + w._jag[i % 40]) * 0.92;
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = `rgba(125,255,168,${(0.05 + w.heal * 0.16).toFixed(3)})`;
        ctx.fill();
      }
      /* 疤痕 */
      if (w.scarT > 0) {
        ctx.globalAlpha = (w.scarT / 12) * 0.3;
        ctx.strokeStyle = '#e8d9b0'; ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-w.r0 * 0.4, 0); ctx.lineTo(w.r0 * 0.4, 0);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    },
    drawSelection(ctx, E) {
      const c = CS.UI && CS.UI.selected;
      if (!c || c.dead) return;
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(performance.now() / 900);
      ctx.strokeStyle = '#ffffff';
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 1.4;
      ctx.setLineDash([7, 9]);
      ctx.beginPath(); ctx.arc(0, 0, c.r + 15, 0, TAU); ctx.stroke();
      ctx.setLineDash([]);
      for (let i = 0; i < 4; i++) {
        ctx.rotate(TAU / 4);
        ctx.beginPath();
        ctx.moveTo(c.r + 22, 0); ctx.lineTo(c.r + 30, 0);
        ctx.stroke();
      }
      ctx.restore();
      if (c.target && !c.target.dead) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.4;
        ctx.strokeStyle = '#ff5470';
        ctx.setLineDash([4, 7]);
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(c.x, c.y); ctx.lineTo(c.target.x, c.target.y); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    },

    /* ================= 精靈圖快取 ================= */
    sprite(type) {
      if (this.sprites[type]) return this.sprites[type];
      const d = CS.DATA.cellTypes[type];
      if (!d) return null;
      const SS = 4, glow = d.r * 0.9 + 8;
      const size = (d.r + glow) * 2 * SS;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const c = cv.getContext('2d');
      c.scale(SS, SS);
      const cx = d.r + glow, cy = cx;
      const col = d.color;

      /* 外圍光暈 */
      let g = c.createRadialGradient(cx, cy, d.r * 0.4, cx, cy, d.r + glow * 0.75);
      g.addColorStop(0, hexA(col, 0.5));
      g.addColorStop(0.55, hexA(col, 0.14));
      g.addColorStop(1, hexA(col, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(cx, cy, d.r + glow * 0.75, 0, TAU); c.fill();

      const shape = d.shape || 'blob';
      c.save();
      c.translate(cx, cy);

      if (shape === 'disc') {
        g = c.createRadialGradient(0, 0, d.r * 0.15, 0, 0, d.r);
        g.addColorStop(0, hexA(col, 0.55));
        g.addColorStop(0.62, hexA(col, 0.95));
        g.addColorStop(1, hexA(col, 0.55));
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, d.r, 0, TAU); c.fill();
        c.fillStyle = 'rgba(3,8,18,0.5)';
        c.beginPath(); c.arc(0, 0, d.r * 0.38, 0, TAU); c.fill();
      } else if (shape === 'blob' || shape === 'irregular') {
        const wob = shape === 'irregular' ? 0.28 : 0.14;
        c.beginPath();
        for (let a = 0; a <= TAU + 0.01; a += TAU / 22) {
          const rr = d.r * (1 + Math.sin(a * 3 + type.length) * wob + Math.sin(a * 5 + 2) * wob * 0.5);
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          a === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.closePath();
        g = c.createRadialGradient(-d.r * 0.3, -d.r * 0.3, d.r * 0.1, 0, 0, d.r * 1.2);
        g.addColorStop(0, hexA(col, 0.95));
        g.addColorStop(0.7, hexA(col, 0.55));
        g.addColorStop(1, hexA(col, 0.4));
        c.fillStyle = g; c.fill();
        c.strokeStyle = hexA(col, 0.9); c.lineWidth = 1; c.stroke();
        nucleus(c, shape === 'irregular' ? d.r * 0.62 : d.r * 0.42, shape === 'irregular' ? '#7a1fa8' : '#06202e');
      } else if (shape === 'star') {
        c.beginPath();
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * TAU;
          const rr = i % 2 ? d.r * 0.5 : d.r * 1.25;
          const x = Math.cos(a) * rr, y = Math.sin(a) * rr;
          i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.closePath();
        c.fillStyle = hexA(col, 0.92); c.fill();
        c.strokeStyle = hexA(col, 1); c.lineWidth = 0.8; c.stroke();
      } else if (shape === 'rod') {
        c.strokeStyle = hexA(col, 0.65); c.lineWidth = 1.2;
        for (let i = -1; i <= 1; i++) {
          c.beginPath();
          c.moveTo(-d.r, 0);
          c.quadraticCurveTo(-d.r * 1.8, i * d.r * 0.7, -d.r * 2.3, i * d.r * 1.3);
          c.stroke();
        }
        c.beginPath();
        c.ellipse(0, 0, d.r * 1.15, d.r * 0.62, 0, 0, TAU);
        g = c.createLinearGradient(-d.r, 0, d.r, 0);
        g.addColorStop(0, hexA(col, 0.95));
        g.addColorStop(1, hexA(col, 0.6));
        c.fillStyle = g; c.fill();
        c.strokeStyle = hexA(col, 1); c.lineWidth = 0.9; c.stroke();
        c.fillStyle = 'rgba(3,8,18,0.55)';
        c.beginPath(); c.arc(d.r * 0.35, 0, d.r * 0.22, 0, TAU); c.fill();
      } else if (shape === 'hex' || shape === 'poly') {
        const n = shape === 'hex' ? 6 : 7;
        c.beginPath();
        for (let i = 0; i <= n; i++) {
          const a = (i / n) * TAU + 0.4;
          const x = Math.cos(a) * d.r, y = Math.sin(a) * d.r;
          i === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.closePath();
        g = c.createLinearGradient(-d.r, -d.r, d.r, d.r);
        g.addColorStop(0, hexA(col, 0.9));
        g.addColorStop(1, hexA(col, 0.55));
        c.fillStyle = g; c.fill();
        c.strokeStyle = hexA(col, 1); c.lineWidth = 1; c.stroke();
        nucleus(c, d.r * 0.4, '#06202e');
      } else if (shape === 'columnar') {
        c.beginPath();
        c.moveTo(-d.r * 0.75, d.r);
        c.lineTo(-d.r * 0.75, -d.r * 0.4);
        c.arc(0, -d.r * 0.4, d.r * 0.75, Math.PI, 0);
        c.lineTo(d.r * 0.75, d.r);
        c.closePath();
        c.fillStyle = hexA(col, 0.8); c.fill();
        c.strokeStyle = hexA(col, 1); c.lineWidth = 1; c.stroke();
        nucleus(c, d.r * 0.34, '#06202e', 0, d.r * 0.25);
      } else if (shape === 'ring') {
        c.beginPath(); c.arc(0, 0, d.r, 0, TAU);
        c.arc(0, 0, d.r * 0.55, 0, TAU, true);
        c.fillStyle = hexA(col, 0.5);
        c.fill('evenodd');
        c.strokeStyle = hexA(col, 1); c.lineWidth = 1.4;
        c.beginPath(); c.arc(0, 0, d.r, 0, TAU); c.stroke();
        c.beginPath(); c.arc(0, 0, d.r * 0.55, 0, TAU); c.stroke();
      } else if (shape === 'neuron') {
        g = c.createRadialGradient(0, 0, 1, 0, 0, d.r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.4, hexA(col, 0.95));
        g.addColorStop(1, hexA(col, 0.5));
        c.fillStyle = g;
        c.beginPath(); c.arc(0, 0, d.r, 0, TAU); c.fill();
        nucleus(c, d.r * 0.4, '#1a0a33');
      } else if (shape === 'oval') {
        c.beginPath(); c.ellipse(0, 0, d.r, d.r * 0.68, 0, 0, TAU);
        c.fillStyle = hexA(col, 0.85); c.fill();
        c.strokeStyle = hexA(col, 1); c.lineWidth = 1; c.stroke();
        c.strokeStyle = 'rgba(3,8,18,0.35)'; c.lineWidth = 1.6;
        for (let i = -2; i <= 2; i++) {
          c.beginPath();
          c.moveTo(i * d.r * 0.32, -d.r * 0.5);
          c.lineTo(i * d.r * 0.32, d.r * 0.5);
          c.stroke();
        }
        nucleus(c, d.r * 0.3, '#33060f');
      } else if (shape === 'spindle') {
        c.beginPath();
        c.moveTo(-d.r * 1.35, 0);
        c.quadraticCurveTo(0, -d.r * 0.75, d.r * 1.35, 0);
        c.quadraticCurveTo(0, d.r * 0.75, -d.r * 1.35, 0);
        c.closePath();
        c.fillStyle = hexA(col, 0.85); c.fill();
        c.strokeStyle = hexA(col, 1); c.lineWidth = 1; c.stroke();
        nucleus(c, d.r * 0.32, '#06202e', d.r * 0.15, 0);
      } else if (shape === 'dendritic') {
        c.strokeStyle = hexA(col, 0.6); c.lineWidth = 1.1;
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * TAU + 0.5;
          c.beginPath(); c.moveTo(0, 0);
          c.quadraticCurveTo(Math.cos(a) * d.r * 1.2, Math.sin(a) * d.r * 1.2, Math.cos(a + 0.4) * d.r * 1.9, Math.sin(a + 0.4) * d.r * 1.9);
          c.stroke();
        }
        c.beginPath(); c.arc(0, 0, d.r * 0.8, 0, TAU);
        c.fillStyle = hexA(col, 0.9); c.fill();
        nucleus(c, d.r * 0.4, '#06202e');
      }

      c.restore();
      const sp = { cv, size: size / SS, half: (d.r + glow) };
      this.sprites[type] = sp;
      return sp;
    },

    /* ================= 揀選 ================= */
    pickOrgan(sx, sy) {
      const D = CS.DATA;
      for (const id in D.organs) {
        const p = this.bodyMap(D.organs[id].bodyPos[0], D.organs[id].bodyPos[1], 1, null);
        if (Math.hypot(sx - p.x, sy - p.y) < 26) return id;
      }
      return null;
    },
    pickCell(wx, wy) {
      const E = CS.Engine;
      let best = null, bd = 1e9;
      for (const c of E.cells) {
        if (c.dead) continue;
        const d = Math.hypot(c.x - wx, c.y - wy);
        const lim = Math.max(c.r + 9, 14 / this.cam.zoom);
        if (d < lim && d < bd) { bd = d; best = c; }
      }
      return best;
    },
  });

  function nucleus(c, r, color, ox, oy) {
    const g = c.createRadialGradient((ox || 0) - r * 0.3, (oy || 0) - r * 0.3, r * 0.1, ox || 0, oy || 0, r);
    g.addColorStop(0, '#3a5a74');
    g.addColorStop(1, color || '#06202e');
    c.fillStyle = g;
    c.beginPath(); c.arc(ox || 0, oy || 0, r, 0, TAU); c.fill();
  }
  function hexA(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /* ================= 器官微觀背景 ================= */
  const BG = {
    default(c, E) {
      c.fillStyle = 'rgba(20,50,80,0.12)';
      for (let i = 0; i < 60; i++) c.fillRect(Math.random() * E.W, Math.random() * E.H, 2, 2);
    },
    vessel(c, E) {
      for (const P of E.paths) {
        c.beginPath();
        P.pts.forEach((p, i) => i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y));
        c.strokeStyle = 'rgba(70,10,20,0.55)';
        c.lineWidth = 130; c.lineCap = 'round'; c.stroke();
        c.strokeStyle = 'rgba(255,93,115,0.14)'; c.lineWidth = 126; c.stroke();
        c.strokeStyle = 'rgba(255,140,160,0.35)'; c.lineWidth = 2; c.stroke();
      }
      c.fillStyle = 'rgba(255,255,255,0.03)';
      for (let i = 0; i < 40; i++) {
        const y = Math.random() * E.H;
        c.fillRect(Math.random() * E.W, y, Math.random() * 200 + 60, 1);
      }
    },
    alveoli(c, E) {
      for (const s of E.deco.sacs || []) {
        const g = c.createRadialGradient(s.x, s.y, s.r * 0.2, s.x, s.y, s.r);
        g.addColorStop(0, 'rgba(127,216,232,0.10)');
        g.addColorStop(0.85, 'rgba(127,216,232,0.045)');
        g.addColorStop(1, 'rgba(127,216,232,0.12)');
        c.fillStyle = g;
        c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.fill();
        c.strokeStyle = 'rgba(165,240,232,0.28)'; c.lineWidth = 2;
        c.beginPath(); c.arc(s.x, s.y, s.r, 0, Math.PI * 2); c.stroke();
        c.strokeStyle = 'rgba(127,216,232,0.10)';
        c.beginPath(); c.arc(s.x, s.y, s.r + 30, 0, Math.PI * 2); c.stroke();
      }
    },
    fiber(c, E) {
      for (const f of E.deco.fibers || []) {
        c.beginPath();
        for (let x = -40; x <= E.W + 40; x += 40) {
          const y = f.y0 + Math.sin((x / E.W) * Math.PI) * f.bend;
          x === -40 ? c.moveTo(x, y) : c.lineTo(x, y);
        }
        c.strokeStyle = 'rgba(255,143,163,0.10)'; c.lineWidth = 34; c.stroke();
        for (let k = -1; k <= 1; k++) {
          c.beginPath();
          for (let x = -40; x <= E.W + 40; x += 40) {
            const y = f.y0 + Math.sin((x / E.W) * Math.PI) * f.bend + k * 9;
            x === -40 ? c.moveTo(x, y) : c.lineTo(x, y);
          }
          c.strokeStyle = 'rgba(255,143,163,0.18)'; c.lineWidth = 1.2; c.stroke();
        }
      }
    },
    neural(c, E) {
      c.strokeStyle = 'rgba(183,139,255,0.16)'; c.lineWidth = 1;
      for (const L of E.deco.links || []) {
        const ns = E.cells.filter((x) => x.type === 'neuron');
        const a = ns[L[0]], b = ns[L[1]];
        if (!a || !b) continue;
        c.beginPath(); c.moveTo(a.anchor[0], a.anchor[1]); c.lineTo(b.anchor[0], b.anchor[1]); c.stroke();
      }
      c.fillStyle = 'rgba(143,179,217,0.14)';
      for (let i = 0; i < 90; i++) {
        c.beginPath(); c.arc(Math.random() * E.W, Math.random() * E.H, Math.random() * 1.6 + 0.4, 0, Math.PI * 2); c.fill();
      }
    },
    hex(c, E) {
      const dx = 95, dy = 84;
      c.strokeStyle = 'rgba(255,180,107,0.09)'; c.lineWidth = 1.2;
      for (let r = -1; r < 14; r++) for (let q = -1; q < 20; q++) {
        const x = q * dx + (r % 2 ? dx / 2 : 0), y = r * dy;
        c.beginPath();
        for (let i = 0; i <= 6; i++) {
          const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
          const px = x + Math.cos(a) * dx * 0.56, py = y + Math.sin(a) * dx * 0.56;
          i === 0 ? c.moveTo(px, py) : c.lineTo(px, py);
        }
        c.stroke();
      }
      for (const P of E.paths) {
        c.beginPath();
        P.pts.forEach((p, i) => i === 0 ? c.moveTo(p.x, p.y) : c.lineTo(p.x, p.y));
        c.strokeStyle = 'rgba(70,25,8,0.6)'; c.lineWidth = 62; c.lineCap = 'round'; c.stroke();
        c.strokeStyle = 'rgba(255,180,107,0.13)'; c.lineWidth = 58; c.stroke();
      }
    },
    villi(c, E) {
      for (const v of E.deco.villi || []) {
        c.beginPath();
        c.moveTo(v.x - v.w * 1.6, E.H);
        c.bezierCurveTo(
          v.x - v.w * 1.5, E.H - v.h * 0.6,
          v.x - v.w * 0.9 + Math.sin(v.sway) * 12, E.H - v.h,
          v.x + Math.sin(v.sway) * 14, E.H - v.h - 14
        );
        c.bezierCurveTo(
          v.x + v.w * 0.9 + Math.sin(v.sway) * 12, E.H - v.h,
          v.x + v.w * 1.5, E.H - v.h * 0.6,
          v.x + v.w * 1.6, E.H
        );
        c.closePath();
        c.fillStyle = 'rgba(255,217,138,0.12)';
        c.fill();
        c.strokeStyle = 'rgba(255,217,138,0.38)'; c.lineWidth = 2.4; c.stroke();
      }
      c.fillStyle = 'rgba(110,231,168,0.03)';
      c.fillRect(0, E.H * 0.2, E.W, E.H * 0.8);
    },
    trabecula(c, E) {
      c.fillStyle = 'rgba(232,217,176,0.07)';
      const blobs = [[80, 80, 150], [1520, 60, 170], [100, 820, 160], [1500, 830, 150], [800, 60, 120], [800, 850, 120], [60, 450, 110], [1545, 460, 110]];
      for (const [x, y, r] of blobs) {
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      }
      c.strokeStyle = 'rgba(232,217,176,0.14)'; c.lineWidth = 2;
      for (const [x, y, r] of blobs) {
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
      }
    },
    layers(c, E) {
      const bands = [
        [0, 320, 'rgba(242,201,160,0.045)'],
        [320, 120, 'rgba(242,201,160,0.07)'],
        [440, 120, 'rgba(242,185,138,0.08)'],
        [560, 120, 'rgba(235,160,110,0.09)'],
        [680, 220, 'rgba(230,140,100,0.10)'],
      ];
      for (const [y, h, col] of bands) { c.fillStyle = col; c.fillRect(0, y, E.W, h); }
      c.strokeStyle = 'rgba(242,201,160,0.25)'; c.lineWidth = 1.5;
      for (const y of [320, 440, 560, 680]) {
        c.beginPath(); c.moveTo(0, y); c.lineTo(E.W, y); c.stroke();
      }
      c.strokeStyle = 'rgba(159,232,194,0.2)'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, 800); c.lineTo(E.W, 800); c.stroke();
    },
  };
})();
