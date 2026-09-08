/* ============================================================
   CELLSCAPE · main.js
   啟動 / 主循環 / 互動 / 轉場調度
   ============================================================ */
(function () {
  const CS = window.CS;
  const $ = (id) => document.getElementById(id);

  const Main = (CS.Main = {
    init() {
      this.canvas = $('scene');
      CS.Render.init(this.canvas);
      CS.UI.init();
      CS.Engine.setScenario('normal');
      CS.UI.setBreadcrumb(null);
      CS.UI.showMsg('歡迎來到 CELLSCAPE——點擊任一發光節點，進入人體微觀世界。', 5);

      this._last = performance.now();
      this._down = null; this._dragging = false;

      this.bindPointer();
      this.bindKeys();
      window.addEventListener('resize', () => { CS.Render.resize(); });

      const loop = (now) => {
        const dt = Math.min(0.05, (now - this._last) / 1000);
        this._last = now;
        CS.Render._dt = dt;
        if (CS.Engine.organId) CS.Engine.update(dt);
        this.followCam(dt);
        CS.Render.frame(now);
        CS.UI.update(dt);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);

      /* 移除載入簾 */
      setTimeout(() => {
        const l = $('loading');
        if (l) { l.style.opacity = '0'; setTimeout(() => l.remove(), 900); }
      }, 500);
    },

    /* ---------- 進出器官 ---------- */
    enterOrgan(id) {
      const R = CS.Render, E = CS.Engine;
      if (!CS.DATA.organs[id] || R.trans || R.mode === 'micro') return;
      const org = CS.DATA.organs[id];
      CS.UI.clearMsg();
      E.loadOrgan(id);
      E.setScenario(E.scenarioId);
      R.cam.x = E.W / 2; R.cam.y = E.H / 2;
      R.cam.zoom = (org.micro && org.micro.zoom) || 0.9;
      R.cam.baseZoom = R.cam.zoom;
      R.mode = 'micro';
      R.trans = { dir: 'in', t: 0, dur: 1.15, focus: org.bodyPos, done: () => {
        CS.UI.buildRail();
        CS.UI.showMsg(org.name + '——' + org.brief, 3.6);
      } };
      CS.UI.setBreadcrumb(id);
      CS.UI.setHint();
      CS.UI.deselect();
    },
    exitOrgan() {
      const R = CS.Render, E = CS.Engine;
      if (!E.organId || R.trans || R.mode === 'body') return;
      const org = E.organ;
      R.mode = 'body';
      CS.UI.clearMsg();
      R.trans = { dir: 'out', t: 0, dur: 1.1, focus: org.bodyPos, done: () => {
        E.organId = null; E.organ = null;
        CS.UI.buildRail();
        CS.UI.setHint();
      } };
      CS.UI.setBreadcrumb(null);
      CS.UI.deselect();
    },
    run(organId, scenarioId) {
      if (scenarioId && CS.DATA.scenarios[scenarioId]) CS.Engine.scenarioId = scenarioId;
      const R = CS.Render;
      if (R.mode === 'micro' && !R.trans) R.mode = 'body'; // 允許微觀視圖直接跳切
      this.enterOrgan(organId);
    },
    followCam(dt) {
      const sel = CS.UI.selected;
      if (!CS.UI.follow || !sel || sel.dead || CS.Render.mode !== 'micro') return;
      const R = CS.Render, k = Math.min(1, dt * 3);
      R.cam.x += (sel.x - R.cam.x) * k;
      R.cam.y += (sel.y - R.cam.y) * k;
    },

    /* ---------- 指標互動 ---------- */
    bindPointer() {
      const R = CS.Render, cv = this.canvas;
      cv.addEventListener('pointerdown', (e) => {
        this._down = { x: e.clientX, y: e.clientY, cx: R.cam.x, cy: R.cam.y };
        this._dragging = false;
        cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener('pointermove', (e) => {
        R.mouse.x = e.clientX; R.mouse.y = e.clientY;
        if (!this._down) return;
        const dx = e.clientX - this._down.x, dy = e.clientY - this._down.y;
        if (Math.hypot(dx, dy) > 5) this._dragging = true;
        if (this._dragging && R.mode === 'micro') {
          R.cam.x = this._down.cx - dx / R.cam.zoom;
          R.cam.y = this._down.cy - dy / R.cam.zoom;
          CS.UI.follow = false;
          $('btnFollow').classList.remove('on');
        }
      });
      cv.addEventListener('pointerup', (e) => {
        const wasDrag = this._dragging;
        this._down = null; this._dragging = false;
        if (wasDrag || CS.Render.trans) return;
        if (R.mode === 'body') {
          const id = R.pickOrgan(e.clientX, e.clientY);
          if (id) this.enterOrgan(id);
        } else {
          const w = R.screenToWorld(e.clientX, e.clientY);
          const c = R.pickCell(w.x, w.y);
          if (c) CS.UI.select(c); else CS.UI.deselect();
        }
      });
      cv.addEventListener('wheel', (e) => {
        if (R.mode !== 'micro' || R.trans) return;
        e.preventDefault();
        const z0 = R.cam.zoom;
        const z1 = Math.max(0.45, Math.min(3.2, z0 * (e.deltaY < 0 ? 1.12 : 0.89)));
        const w = R.screenToWorld(e.clientX, e.clientY);
        R.cam.zoom = z1;
        R.cam.x = w.x - (e.clientX - R.cw / 2) / z1;
        R.cam.y = w.y - (e.clientY - R.ch / 2) / z1;
      }, { passive: false });
    },

    /* ---------- 鍵盤 ---------- */
    bindKeys() {
      window.addEventListener('keydown', (e) => {
        const R = CS.Render;
        if (e.code === 'Space') { e.preventDefault(); CS.UI.togglePause(); }
        else if (e.key === 'Escape') { if (R.mode === 'micro' && !R.trans) this.exitOrgan(); }
        else if (/^[1-9]$/.test(e.key)) {
          const ids = Object.keys(CS.DATA.scenarios);
          const id = ids[parseInt(e.key, 10) - 1];
          if (id) CS.Engine.setScenario(id);
        }
      });
    },
  });

  window.addEventListener('DOMContentLoaded', () => Main.init());
})();
