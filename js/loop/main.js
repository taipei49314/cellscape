/* ============================================================
   CELLSCAPE v0.2 · Living Loop — main.js
   啟動、模型/視覺分離主循環、模式與面板、A/B 分支、
   匯出匯入、行動面板、reduced-motion、頁籤隱藏策略、效能取樣。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});
  const $ = (id) => document.getElementById(id);
  /* 事件文字一律跳脫後才進 innerHTML——匯入包內字串不得被當成標記解析
     （IMPORT_TEXT_PLAINTEXT 契約） */
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const M = (CSL.Main = {
    speed: 1,
    paused: false,
    mode: 'explore',          // tour | explore
    branchA: null,            // 基線分支（無介入；與主世界鎖步推進）
    activeIsA: false,
    reduced: false,

    init() {
      /* URL：?seed=（僅種子與小型參數，不放快照） */
      const url = new URL(location.href);
      const seed = parseInt(url.searchParams.get('seed') || '0', 10) || 0x51EED;

      this.world = CSL.createWorld({ seed });
      CSL.Observe.init();                      // 觀察工作階段（v0.3 Atlas；非模型一部分）
      CSL.Render.init($('r3d'));
      CSL.Atlas.init();
      this._bind();
      this._syncParamsUI();
      if (CSL.I18n) { CSL.I18n.applyShell(); this._syncLang(); }   // T-299 C3：還原已存語言
      this._setBranchBadge();
      this.setMode('explore');
      $('worldClock').textContent = this._clock();

      this.reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (this.reduced) this._setReduced(true);

      /* 頁籤隱藏策略：隱藏 = 模型暫停（不做追趕；可見時從當下狀態續行） */
      document.addEventListener('visibilitychange', () => {
        this._hiddenPaused = document.hidden;
        if (!document.hidden) this._acc = 0;
        $('pauseNote').style.display = this._hiddenPaused ? 'block' : 'none';
      });

      this._last = performance.now();
      this._acc = 0;
      this._frames = [];
      global.__loopErrors = global.__loopErrors || [];
      const loop = (now) => {
        try {
          const wall = Math.min(0.25, (now - this._last) / 1000);
          this._last = now;
          this._perf(wall);
          if (!this.paused && !this._hiddenPaused) {
            this._acc += wall * this.speed;
            let n = 0;
          while (this._acc >= CSL.DT && n < 12) {      // 單幀上限：不追趕過量
            const hadBranch = !!this.branchA;          // 本 tick 開始前分支是否已存在
            CSL.step(this.world);
            CSL.Tour.update(this.world, this.api);     // 導覽由模型 tick 驅動（字幕只描述已發生事件）
            if (this.branchA && hadBranch) CSL.step(this.branchA);  // 基線分支鎖步（建立當 tick 不多走，避免 ±1 偏移）
            /* 觀察記錄（每個完成 tick；只讀模型，非模型一部分） */
            const sel = this.selectedId != null ? this.selectedId : this.followedId;
            CSL.Observe.recordTick(this.world, 'B', sel);
            if (this.branchA && hadBranch) CSL.Observe.recordTick(this.branchA, 'A', sel);
            this._acc -= CSL.DT;
            n++;
          }
          }
          const showWorld = this.activeIsA && this.branchA ? this.branchA : this.world;
          CSL.Render.followedId = this.followedId;
          CSL.Render.sync(showWorld, wall);
          this._tickUI();
        } catch (err) {
          global.__loopErrors.push(String((err && err.stack) || err));
          if (global.__loopErrors.length > 8) global.__loopErrors.shift();
        }
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    },

    /* ---------- 主動作：跟著一顆紅血球 ---------- */
    followNextRBC() {
      /* 選即將進入肺微血管的實體（最小 s 的 LUNG_CAP 實體；否則任一） */
      let best = null;
      for (const k in this.world.entities) {
        const e = this.world.entities[k];
        if (e.edge === 1 && (!best || e.s < best.s)) best = e;
      }
      if (!best) best = Object.values(this.world.entities)[0];
      this.followedId = best.id;
      this.selectedId = best.id;
      CSL.Render.followedId = best.id;
      $('landing').classList.add('hidden');
      this.setMode('tour');
      CSL.Tour.start(this.world, this.api, best.id);
      CSL.Render.setView('FOLLOW', this.world, best.id);   // 跟隨視角由 UI/導覽觸發
      this._inspector(true);
    },

    setMode(m) {
      this.mode = m;
      $('modeBadge').textContent = m === 'tour' ? '導覽' : '探索';
      document.querySelectorAll('#paramPanel input').forEach((el) => { el.disabled = (m === 'tour'); });
      if (m === 'explore') CSL.Tour.stop();
      $('exploreBtn').classList.toggle('on', m === 'explore');
    },

    /* ---------- A/B 分支 ---------- */
    ensureBranch() {
      if (this.branchA) return;
      const snap = CSL.snapshot(this.world);
      this.branchA = CSL.createWorld({ seed: this.world.seed, runId: 'A-' + this.world.runId, branchOf: this.world.runId });
      CSL.restore(this.branchA, snap);
      this.branchA.actions = [];               // 基線分支：無介入歷史
      this.branchA.pendingCommands = [];       // 基線分支：不得繼承尚未套用的介入
      this._setBranchBadge();
      $('abToggle').style.display = 'inline-block';
    },
    toggleBranch() {
      if (!this.branchA) return;
      this.activeIsA = !this.activeIsA;
      /* eventId 為分支局部配號——切換顯示世界即收合展開，不得以同號事件
         在另一世界凑鏈（EVENT_ID_BRANCH_LOCAL 契約） */
      this._expandedEventId = null;
      this._setBranchBadge();
      this._tickUI(true);      // 暫停中切換也必須立即刷新 HUD（PAUSED_AB_HUD 契約）
    },
    _setBranchBadge() {
      $('branchBadge').textContent = this.activeIsA && this.branchA ? 'A 基線' : 'B 進行中';
      $('branchBadge').style.display = this.branchA ? 'inline-block' : 'none';
      /* 切換鈕只在分支存在時可見——匯入/無分支時不得殘留無效控制項 */
      $('abToggle').style.display = this.branchA ? 'inline-block' : 'none';
      $('abToggle').textContent = this.activeIsA ? '▶ 切到 B（介入中）' : '▶ 切到 A（基線）';
    },

    /* ---------- UI ---------- */
    _bind() {
      $('followBtn').addEventListener('click', () => this.followNextRBC());
      $('exploreBtn').addEventListener('click', () => this.setMode('explore'));
      $('btnPause2').addEventListener('click', () => {
        this.paused = !this.paused;
        $('btnPause2').textContent = this.paused ? '▶' : '❚❚';
      });
      document.querySelectorAll('#speedBox2 .spd').forEach((b) => {
        b.addEventListener('click', () => {
          document.querySelectorAll('#speedBox2 .spd').forEach((x) => x.classList.remove('on'));
          b.classList.add('on');
          this.speed = parseFloat(b.dataset.spd);
        });
      });
      $('abToggle').addEventListener('click', () => this.toggleBranch());
      $('camOverview').addEventListener('click', () => CSL.Render.setView('OVERVIEW'));
      $('camLung').addEventListener('click', () => CSL.Render.setView('LUNG'));
      $('camTissue').addEventListener('click', () => CSL.Render.setView('TISSUE'));
      $('btnExport').addEventListener('click', () => {
        const blob = new Blob([CSL.exportRun(this.world)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `cellscape-loop-${this.world.runId}.json`;
        a.click(); URL.revokeObjectURL(a.href);
      });
      $('fileImport').addEventListener('change', (e) => {
        const f = e.target.files[0]; if (!f) return;
        const rd = new FileReader();
        rd.onload = () => {
          try {
            this.world = CSL.importRun(String(rd.result));
            /* 匯入＝替換顯示世界：舊世界的進行中導覽不得介入新世界
               （IMPORT_STOPS_TOUR 契約——否則舊步驟的 onEnter 會對匯入狀態
               下 source='tour' 的指令，污染有效存檔）。 */
            this.setMode('explore');        // 內含 Tour.stop()：active=false、收字幕
            CSL.Tour.idx = 0; CSL.Tour.waited = 0;   // 殘留步驟指標一併復位
            this.activeIsA = false;         // A/B 顯示狀態屬舊世界，一併復位
            this.branchA = null; this._setBranchBadge();
            this._expandedEventId = null;   // 展開屬舊世界（EVENT_ID_BRANCH_LOCAL 同契約）
            CSL.Observe.onWorldInstalled(); // 新觀察工作階段：舊曲線/窗口全數作廢
            this._syncParamsUI();           // 滑桿位置屬舊世界——以載入世界的參數為準
            this._tickUI(true);
            CSL.Atlas.onImport();
            this.api.subtitle('已載入執行包：run ' + this.world.runId + '（tick ' + this.world.tick + '）', 5);
          } catch (err) { this.api.subtitle(String(err.message), 6); }
        };
        rd.readAsText(f);
      });
      document.querySelectorAll('#paramPanel input[type=range]').forEach((el) => {
        el.addEventListener('input', () => {
          const key = el.dataset.key;
          const v = parseFloat(el.value);
          $('pv_' + key).textContent = v.toFixed(2);
          CSL.queueCommand(this.world, { kind: 'setParam', key, value: v, source: 'user' });
          if (key === 'lungSupply' || key === 'anemia') this.ensureBranch();   // 首次介入建立 A/B
        });
      });
      /* 藥物介入快速預設：與滑桿同一 setParam 事件路徑（CSL.queueCommand 唯一入口），
         模型單位、非用藥建議；介入即建立 A/B 基線（首次介入語義同 lungSupply 滑桿）。 */
      const DRUG_PRESETS = {
        bronchodilator: { params: { lungSupply: 1 }, note: '藥物介入（模型）：支氣管擴張劑——肺端供氧升至 1.00。模型單位，非用藥建議。' },
        betaBlocker: { params: { flowSpeed: 0.6 }, note: '藥物介入（模型）：乙型阻斷劑——循環流速降至 0.60。模型單位，非用藥建議。' },
        fever: { params: { tissueDemand: 0.85, temperature: 39.5 }, note: '藥物介入（模型）：發燒／敗血症——組織需求升至 0.85、體溫升至 39.5 °C（Q10 使使用與 CO₂ 連動上升）。模型單位，非用藥建議。' },
        transfusion: { params: { anemia: 0 }, note: '藥物介入（模型）：輸血——貧血程度歸零（Hb 可用上限恢復）。模型單位，非用藥建議。' },
        antipyretic: { params: { temperature: 37 }, note: '藥物介入（模型）：退燒——體溫回復 37.0 °C。模型單位，非用藥建議。' },
        baseline: { params: { lungSupply: 0.85, flowSpeed: 1, tissueDemand: 0.5, anemia: 0, temperature: 37 }, note: '藥物介入（模型）：參數回復基準值（含貧血與體溫）。' },
      };
      document.querySelectorAll('#drugPanel .drug').forEach((el) => {
        el.addEventListener('click', () => {
          const preset = DRUG_PRESETS[el.dataset.preset];
          if (!preset) return;
          for (const [key, value] of Object.entries(preset.params)) {
            CSL.queueCommand(this.world, { kind: 'setParam', key, value, source: 'user' });
            /* 指令下一 tick 才套用且 _tickUI 不同步滑桿——比照滑桿 input 先寫顯示值 */
            const input = document.querySelector(`#paramPanel input[data-key=${key}]`);
            if (input) input.value = value;
            $('pv_' + key).textContent = Number(value).toFixed(2);
          }
          this.ensureBranch();
          const noteKey = 'drug.note.' + el.dataset.preset;
          this.api.subtitle((CSL.I18n && CSL.I18n.shell(noteKey)) || preset.note, 6);
        });
      });
      $('lowLoad').addEventListener('change', (e) => CSL.Render.setQuality(e.target.checked ? 'low' : 'high'));
      $('reduced').addEventListener('change', (e) => this._setReduced(e.target.checked));
      /* T-299 C3：語言切換（content-en 平行層；缺鍵退回繁中；tour 字幕屬凍結檔維持繁中） */
      $('langToggle').addEventListener('click', () => {
        if (!CSL.I18n) return;
        CSL.I18n.toggle();
        CSL.I18n.applyShell();
        this._syncLang();
        CSL.Atlas.render();            // 檢閱內容若開啟即重繪；未開啟時 render 為安全無操作
      });
      $('r3d').addEventListener('click', (e) => {
        const id = CSL.Render.pickAt(e.clientX, e.clientY, this.world);
        if (id != null) { this.selectedId = id; this._inspector(true); }
      });
      $('insClose2').addEventListener('click', () => this._inspector(false));
      $('inspector').addEventListener('click', (e) => {
        const btn = e.target.closest('#insideBtn');
        if (btn && global.CSL.Inside) CSL.Inside.open(btn.dataset.card);   // T-299 C4：內部示意（唯讀 content 卡）
      });
      $('evidenceToggle').addEventListener('click', () => this._panel('evidence'));
      $('insToggle').addEventListener('click', () => this._panel('inspector'));
      $('eventList').addEventListener('click', (e) => {
        if (e.target.closest('[data-collapse]')) {           // 收合因果鏈
          this._expandedEventId = null;
          this._tickUI(true);
          return;
        }
        const row = e.target.closest('.ev');
        if (!row || !row.dataset.id) return;
        const evId = parseInt(row.dataset.id, 10);
        const ev = (this.activeIsA && this.branchA ? this.branchA : this.world).events.find((x) => x.eventId === evId);
        if (ev && ev.parentEventIds && ev.parentEventIds.length) {
          this._expandedEventId = (this._expandedEventId === evId) ? null : evId;  // 再點一次收合
          this._tickUI(true);
        }
      });
    },

    _panel(name) {
      /* 行動/窄幕：一次只開一個主要面板（並同步 body class，讓參數面板讓位） */
      const ev = $('evidencePanel'), ins = $('inspector');
      if (name === 'evidence') {
        ev.classList.toggle('closed'); ins.classList.add('closed');
      } else {
        ins.classList.toggle('closed'); ev.classList.add('closed');
      }
      document.body.classList.toggle('atlas-open', !ins.classList.contains('closed'));
      document.body.classList.toggle('evidence-open', !ev.classList.contains('closed'));
    },
    _inspector(show) {
      $('inspector').classList.toggle('closed', !show);
      $('evidencePanel').classList.add('closed');
      document.body.classList.toggle('atlas-open', !!show);
      document.body.classList.remove('evidence-open');
      if (show && CSL.Atlas) CSL.Atlas.render();   // 開啟檢閱即渲染當前頁籤
    },
    _setReduced(on) {
      this.reduced = on;
      CSL.Render.setReducedMotion(on);
      $('reduced').checked = on;
    },

    api: {
      subtitle(text, dur) {
        const el = $('subtitle');
        if (!text) { el.classList.remove('show'); return; }
        el.textContent = text;
        el.classList.add('show');
        clearTimeout(M._subT);
        M._subT = setTimeout(() => el.classList.remove('show'), (dur || 4) * 1000);
      },
      setCamera(v) { CSL.Render.setView(v, M.world, M.followedId); },
      enableBranch() { M.ensureBranch(); },
      tourDone() {
        $('modeBadge').textContent = '導覽完成';
        M.setMode('explore');
      },
    },

    _clock(view) {
      const s = (view || this.world).tick * CSL.DT;
      return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    },
    _tickUI(force) {
      const view = this.activeIsA && this.branchA ? this.branchA : this.world;  // HUD 讀取「顯示中的世界」
      if (!force && view.tick % 10 !== 0) return;
      /* Atlas 動態區（看此刻）與 HUD 同步率刷新 */
      if (CSL.Atlas) CSL.Atlas.tick(view, this.activeIsA && this.branchA ? 'A' : 'B',
        this.selectedId != null ? this.selectedId : this.followedId);
      const ro = CSL.readout(view);
      /* HUD 數值欄位在因果鏈展開期間**持續更新**——鏈持久化不得凍結
         時鐘/tick/水位/檢閱（EXPANDED_CHAIN_HUD_LIVE 契約） */
      $('worldClock').textContent = this._clock(view);
      $('tickN').textContent = 'tick ' + view.tick;
      $('statAlv').textContent = Math.round(ro.alveolarLevel * 100) + '%';
      $('statTis').textContent = Math.round(ro.tissueLevel * 100) + '%';
      $('statMean').textContent = ro.meanLoad.toFixed(2);
      $('tisBar').style.width = Math.round(ro.tissueLevel * 100) + '%';
      /* 檢閱面板 */
      const id = this.selectedId != null ? this.selectedId : this.followedId;
      if (id != null && view.entities[id]) {
        const e = view.entities[id];
        const edge = CSL.EDGES[e.edge];
        $('insTitle').textContent = '紅血球 #' + e.id;
        $('insRegion').textContent = edge.label + ' · ' + edge.en;
        $('insProg').textContent = Math.round(CSL.entityGlobalProgress(view, e) * 100) + '%';
        $('insLoops').textContent = '×' + e.loops;
        $('insLoad').textContent = Math.round(e.load * 100) + '%';
        $('loadBar').style.width = Math.round(e.load * 100) + '%';
      }
      /* 事件記錄：展開中持續渲染鏈內容（不被例行清單覆寫，
         EVENT_CHAIN_OVERWRITTEN 契約）；否則渲染例行清單 */
      if (this._expandedEventId != null) { this._renderChain(this._expandedEventId); return; }
      const evList = $('eventList');
      const rows = view.events.slice(-9).reverse().map((ev) => {
        const src = { user: '使用者', tour: '導覽', rule: '規則', demo: '示範' }[ev.source] || esc(ev.source);
        let text = '';
        if (ev.kind === 'command') text = (ev.after && ev.after.key != null)
          ? `參數 ${esc(ev.after.key)} → ${esc(ev.after.value)}` : esc(ev.ruleId || '參數變更');
        else if (ev.kind === 'handoff') text = `RBC #${ev.actorId} 抵達 ${esc(ev.regionId)}`;
        else if (ev.kind === 'threshold') text = ev.ruleId === 'co2BloodHigh' ? '血中 CO₂ 指數高於閾值' : '組織氧庫存低於閾值';
        else text = esc(ev.ruleId || ev.kind);
        const par = ev.parentEventIds && ev.parentEventIds.length
          ? `<span class="parents" data-ev="${ev.eventId}"> ← 因果鏈（${ev.parentEventIds.length}）</span>` : '';
        return `<div class="ev" data-id="${ev.eventId}"><span class="tick mono">t${ev.tick}</span> <b>${text}</b>${par}<span class="src">${src}</span></div>`;
      });
      evList.innerHTML = rows.join('');
    },
    /* 因果鏈展開：沿 parentEventIds 回溯（程式內來源證明）。
       展開狀態持久——_tickUI 在展開期間持續渲染鏈內容。
       展開屬「顯示中的世界」：切換分支即收合（EVENT_ID_BRANCH_LOCAL 契約）。 */
    _renderChain(eventId) {
      const view = this.activeIsA && this.branchA ? this.branchA : this.world;
      const byId = {};
      for (const ev of view.events) byId[ev.eventId] = ev;
      const chain = [];
      const walk = (id, depth) => {
        const ev = byId[id];
        if (!ev || depth > 6) return;
        chain.push(ev);
        for (const p of ev.parentEventIds || []) walk(p, depth + 1);
      };
      walk(eventId, 0);
      const el = $('eventList');
      const seen = new Set();
      el.innerHTML = (chain.length ? chain : [view.events.find(e => e.eventId === eventId)].filter(Boolean))
        .filter((ev) => !seen.has(ev.eventId) && seen.add(ev.eventId))
        .map((ev) => {
          const src = { user: '使用者', tour: '導覽', rule: '規則', demo: '示範' }[ev.source] || esc(ev.source);
          let text = '';
          if (ev.kind === 'command') text = (ev.after && ev.after.key != null)
            ? `參數 ${esc(ev.after.key)}：${esc(ev.before && ev.before.value)} → ${esc(ev.after.value)}`
            : esc(ev.ruleId || '參數變更');
          else if (ev.kind === 'handoff') text = `RBC #${ev.actorId} 抵達 ${esc(ev.regionId)}`;
          else if (ev.kind === 'threshold') text = (ev.ruleId === 'co2BloodHigh' ? '血中 CO₂ 指數高於閾值' : '組織氧庫存低於閾值') + '（因果鏈根）';
          else text = esc(ev.ruleId || ev.kind);
          return `<div class="ev chain"><span class="tick mono">t${ev.tick}</span> <b>${text}</b><span class="src">${src}</span></div>`;
        }).join('') + '<div class="ev dim" data-collapse="1" style="cursor:pointer">— 點此收合因果鏈（程式內來源證明，非自然界因果）—</div>';
    },
    _syncParamsUI() {
      for (const key of ['lungSupply', 'flowSpeed', 'tissueDemand', 'anemia', 'temperature']) {
        const el = document.querySelector(`#paramPanel input[data-key=${key}]`);
        el.value = this.world.params[key];
        $('pv_' + key).textContent = Number(this.world.params[key]).toFixed(2);
      }
    },
    _syncLang() {
      const el = $('langToggle');
      if (el && CSL.I18n) el.textContent = CSL.I18n.get() === 'en' ? '中文' : 'EN';
    },
    _perf(wallMs) {
      this._frames.push(wallMs * 1000);
      if (this._frames.length > 240) this._frames.shift();
      if (this.world.tick % 60 === 0 && this._frames.length > 30) {
        const sorted = this._frames.slice().sort((a, b) => a - b);
        const med = sorted[Math.floor(sorted.length / 2)];
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        $('perfBadge').textContent = `frame ${med.toFixed(1)}ms / p95 ${p95.toFixed(1)}ms`;
        global.__perfLog = { median: med, p95, samples: sorted.length };
      }
    },
  });

  global.addEventListener('DOMContentLoaded', () => M.init());
})(typeof window !== 'undefined' ? window : globalThis);
