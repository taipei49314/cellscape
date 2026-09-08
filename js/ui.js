/* ============================================================
   CELLSCAPE · ui.js
   HUD：導覽 / 圖例 / 檢閱面板 / 敘事 / 情境控制
   ============================================================ */
(function () {
  const CS = window.CS;
  const $ = (id) => document.getElementById(id);
  const stateNames = {
    idle: '靜候', patrol: '巡邏中', alert: '警覺', chase: '追擊中',
    presenting: '抗原呈現', apoptosing: '凋亡中', clot: '凝血栓堵', clotGo: '趨向傷口',
    goWound: '遷移至傷口', collagen: '分泌膠原蛋白', flee: '避離危險', mature: '成熟分化中',
  };
  const taskNames = {
    idle: '維持微環境恆定', patrol: '掃描周遭異常', alert: '前往訊號來源查證',
    chase: '追擊目標並執行清除', presenting: '向 T 細胞通報敵情',
    apoptosing: '程序性凋亡——由巨噬細胞回收', clot: '與纖維蛋白交聯封堵缺損',
    clotGo: '附著傷緣形成止血栓', goWound: '沿趨化梯度遷移至傷區',
    collagen: '沉積膠原蛋白、重建細胞外基質', flee: '遠離發炎戰區以保存共生菌相',
    mature: '待在 niche 旁完成分化成熟',
  };

  const UI = (CS.UI = {
    selected: null,
    follow: false,
    msgQueue: [], msgTimer: 0,
    legendT: 0,

    init() {
      this.buildChips();
      this.buildRail();
      this.bind();
      this.setHint();
    },

    bind() {
      $('btnPause').addEventListener('click', () => this.togglePause());
      document.querySelectorAll('.spd').forEach((b) => {
        b.addEventListener('click', () => {
          document.querySelectorAll('.spd').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          CS.Engine.timeScale = parseFloat(b.dataset.spd);
        });
      });
      $('insClose').addEventListener('click', () => this.deselect());
      $('btnFollow').addEventListener('click', () => {
        this.follow = !this.follow;
        $('btnFollow').classList.toggle('on', this.follow);
      });
      document.querySelectorAll('#events .btn').forEach((b) => {
        b.addEventListener('click', () => {
          const E = CS.Engine;
          if (!E.organId) return;
          if (b.dataset.ev === 'pathogen') E.injectPathogen(8);
          if (b.dataset.ev === 'wound') E.makeWound();
          if (b.dataset.ev === 'mutate') E.mutateRandom();
          if (b.dataset.ev === 'purge') E.purge();
        });
      });
    },

    togglePause() {
      const E = CS.Engine;
      E.paused = !E.paused;
      $('btnPause').textContent = E.paused ? '▶' : '❚❚';
      $('btnPause').classList.toggle('active', E.paused);
    },

    /* ---------- 情境 chips ---------- */
    buildChips() {
      const box = $('chips');
      box.innerHTML = '';
      for (const id in CS.DATA.scenarios) {
        const sc = CS.DATA.scenarios[id];
        const b = document.createElement('button');
        b.className = 'chip' + (CS.Engine.scenarioId === id ? ' on' : '');
        b.textContent = sc.name;
        b.title = sc.en;
        b.addEventListener('click', () => CS.Engine.setScenario(id));
        box.appendChild(b);
      }
    },
    refreshScenario() {
      document.querySelectorAll('#chips .chip').forEach((b, i) => {
        b.classList.toggle('on', Object.keys(CS.DATA.scenarios)[i] === CS.Engine.scenarioId);
      });
    },

    /* ---------- 左欄：器官清單 / 細胞圖例 ---------- */
    buildRail() {
      const rail = $('rail');
      const E = CS.Engine;
      let html = '';
      if (E.organId) {
        html += '<div id="railTitle">CELL CENSUS · 細胞普查</div>';
        const counts = {};
        for (const c of E.cells) if (!c.dead) counts[c.type] = (counts[c.type] || 0) + 1;
        const rows = Object.keys(counts)
          .map((t) => ({ t, n: counts[t], d: CS.DATA.cellTypes[t] }))
          .filter((r) => r.d)
          .sort((a, b) => b.n - a.n).slice(0, 9);
        for (const r of rows) {
          html += `<div class="railRow" data-ct="${r.t}">
            <span class="dot" style="color:${r.d.color}"></span>
            <span class="rowName">${r.d.name}</span>
            <span class="rowEn">${r.d.en}</span>
            <span class="rowN">${r.n}</span></div>`;
        }
        html += `<div class="railRow" data-back style="margin-top:6px;border-top:1px solid rgba(96,222,255,.12);border-radius:0">
          <span class="rowName" style="color:var(--accent2)">↩ 返回人體全景（Esc）</span></div>`;
      } else {
        html += '<div id="railTitle">ORGAN ATLAS · 器官圖譜</div>';
        for (const id in CS.DATA.organs) {
          const o = CS.DATA.organs[id];
          html += `<div class="railRow" data-organ="${id}">
            <span class="dot" style="color:${o.color}"></span>
            <span class="rowName">${o.name}</span>
            <span class="rowEn">${o.en}</span></div>`;
        }
      }
      rail.innerHTML = html;
      rail.querySelectorAll('[data-organ]').forEach((el) =>
        el.addEventListener('click', () => CS.Main.enterOrgan(el.dataset.organ)));
      rail.querySelectorAll('[data-back]').forEach((el) =>
        el.addEventListener('click', () => CS.Main.exitOrgan()));
      rail.querySelectorAll('[data-ct]').forEach((el) =>
        el.addEventListener('click', () => {
          const t = el.dataset.ct;
          const c = CS.Engine.cells.find((x) => x.type === t && !x.dead);
          if (c) this.select(c);
        }));
    },

    /* ---------- 導覽列 ---------- */
    setBreadcrumb(organId) {
      const bc = $('breadcrumb');
      if (!organId) {
        bc.innerHTML = '<span class="crumb here">◉ 人體全景 BODY OVERVIEW</span>';
      } else {
        const o = CS.DATA.organs[organId];
        bc.innerHTML = `<span class="crumb link" id="crumbBody">人體全景</span>
          <span class="sep">/</span>
          <span class="crumb here">${o.name} · ${o.en} — 微觀視界</span>`;
        $('crumbBody').addEventListener('click', () => CS.Main.exitOrgan());
      }
    },

    setHint() {
      const h = $('hint');
      h.textContent = CS.Engine.organId
        ? '滾輪 縮放 · 拖曳 平移 · 點擊細胞 檢閱\n空白鍵 暫停 · 1-4 切換情境 · Esc 返回'
        : '點擊發光節點或左側圖譜，進入器官微觀世界\n空白鍵 暫停 · 1-4 切換情境';
    },

    /* ---------- 檢閱面板 ---------- */
    select(c) {
      this.selected = c;
      this.follow = false;
      $('btnFollow').classList.remove('on');
      const d = CS.DATA.cellTypes[c.type];
      $('insSwatch').style.color = d.color;
      $('insSwatch').style.background = d.color;
      $('insName').textContent = d.name;
      $('insEn').textContent = d.en + ' · #' + c.id + (c.gen ? ' · 第' + c.gen + '代' : '');
      $('insRole').textContent = d.role;
      $('insDesc').textContent = d.desc;
      $('inspector').classList.remove('hidden');
      this.updateInspector();
    },
    deselect() {
      this.selected = null;
      $('inspector').classList.add('hidden');
    },
    updateInspector() {
      const c = this.selected;
      if (!c || c.dead) { this.deselect(); return; }
      const d = CS.DATA.cellTypes[c.type];
      const idleTask = { cancer: '推進細胞週期——準備下一次分裂', bacterium: '穿透組織間隙，繁殖擴散' };
      $('insState').textContent = stateNames[c.state] || c.state;
      $('insState').style.color = c.state === 'chase' ? 'var(--warn)' : 'var(--accent2)';
      $('insTask').textContent = taskNames[c.state] || idleTask[c.type] || '執行細胞任務';
      let sig = [];
      if (c.planted) sig.push('⚗ 人工植入種子（示範注入，非自然突變）');
      if (c.infected > 0) sig.push('⚠ 病原體入侵中 ' + Math.min(99, Math.round(c.infected * 100)) + '%');
      if (c.evasive) sig.push('MHC-I 下調（免疫逃逸）');
      if (d.emits) sig = sig.concat(d.emits.slice(0, 3));
      $('insSignals').textContent = sig.length ? sig.join('、') : '—';
    },

    /* ---------- 敘事 ---------- */
    showMsg(text, dur) {
      this.msgQueue.push({ text, dur: dur || 3.6 });
      if (this.msgQueue.length > 3) this.msgQueue.shift();
      this.pumpMsg();
    },
    clearMsg() {
      this.msgQueue.length = 0;
      this._showing = false; this._msgUntil = 0;
      const el = $('tickerText');
      el.classList.remove('show');
    },
    pumpMsg() {
      if (this._showing || !this.msgQueue.length) return;
      const m = this.msgQueue.shift();
      const el = $('tickerText');
      this._showing = true;
      el.classList.remove('show');
      setTimeout(() => {
        el.textContent = m.text;
        el.classList.add('show');
        this._msgUntil = performance.now() + m.dur * 1000;
      }, 240);
    },
    tickMsg() {
      if (this._showing && this._msgUntil && performance.now() > this._msgUntil) {
        $('tickerText').classList.remove('show');
        this._showing = false;
        setTimeout(() => this.pumpMsg(), 300);
      }
    },

    setPhase(p, alert) {
      const el = $('phaseBadge');
      el.textContent = p || '—';
      el.classList.toggle('alert', !!alert);
    },

    /* ---------- 每幀更新 ---------- */
    update(dt) {
      const E = CS.Engine;
      this.tickMsg();
      const m = Math.floor(E.sT / 60), s = Math.floor(E.sT % 60);
      $('clock').textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
      $('inflBar').style.width = Math.round(Math.min(1, E.inflam) * 100) + '%';
      this.updateInspector();

      this.legendT += dt;
      if (this.legendT > 0.6) {
        this.legendT = 0;
        if (E.organId && document.querySelector('#rail [data-ct]')) this.buildRail();
      }

      /* 游標回饋 */
      if (CS.Render) {
        const R = CS.Render;
        if (R.mode === 'body' && !R.trans) {
          R.canvas.style.cursor = R.hoverOrgan ? 'pointer' : 'crosshair';
        } else {
          const hit = R.mode === 'micro' && !R.trans && R.pickCell(...this._mouseWorld() || [0, 0]);
          R.canvas.style.cursor = hit ? 'pointer' : 'grab';
        }
      }
    },
    _mouseWorld() {
      const R = CS.Render;
      if (R.mouse.x < 0) return null;
      const w = R.screenToWorld(R.mouse.x, R.mouse.y);
      return [w.x, w.y];
    },
  });
})();
