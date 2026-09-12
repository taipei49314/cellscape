/* ============================================================
   CELLSCAPE v0.3 · Living Atlas — observe.js
   觀察緩衝與 ViewContext adapter。
   邊界（v0.3 規格 §6/§8）：
   - 觀察資料**不是模型的一部分**：只讀模型欄位（load/cap、
     compartments、_fluxLung/_fluxTissue、ledger.usage），绝不寫回；
     本模組故障時由呼叫端停用並明示，不得改變模型 RNG 或補樣本。
   - 每 6 tick 一個顯示樣本（0.2 模型秒）；最近 120 模型秒最多 600 點。
   - 歷史以身分鍵 (sessionEpoch, branchId, entityId) 儲存；
     匯入/新世界安裝 ⇒ sessionEpoch 前進、全部清空（開新觀察工作階段）。
   - 缺資料要明示為缺資料：窗口不足不是零；不插補、不捏造過去。
   - selectorId 白名單 = Content.readouts，不得新增其他讀取。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});

  const DT = 1 / 30;                 // 模型秒/tick（與 core 一致；唯讀常數）
  const SAMPLE_EVERY = 6;            // 顯示樣本間隔（tick）＝ 0.2 模型秒
  const MAX_SAMPLES = 600;           // 120 模型秒上限
  const TICK_RING = 3660;            // 每 tick 通量環（>3600=120 模型秒）
  const RATE_WINDOW = 90;            // 速率窗口 N（tick）＝ 3 模型秒
  const NEAR_ZERO = 0.005;           // 負載「近乎不變」閾值

  const Observe = {
    observationVersion: 'v0.3.2-obs.2',
    sessionEpoch: 0,
    enabled: true,
    _branches: null,      // branchId → { tickRing:[{t,fl,ft,u}], lastRecorded, samples:{entityId:[{t,v}]} }
    _lastError: null,

    /* ---------- 工作階段邊界 ---------- */
    init() { this.sessionEpoch = 0; this._newSession(); },
    _newSession() {
      this.sessionEpoch++;
      this._branches = {};
      this._lastError = null;
    },
    /* 匯入/新世界安裝/章節重啟時呼叫：舊觀察全數作廢 */
    onWorldInstalled() { if (this.enabled) this._newSession(); },

    _branch(branchId) {
      let b = this._branches[branchId];
      if (!b) { b = this._branches[branchId] = { tickRing: [], lastRecorded: -1, samples: {} }; }
      return b;
    },

    /* ---------- 每 tick 記錄（由 Main 主循環在每個完成 tick 後呼叫） ----------
       只讀；不得修改 w 的任何欄位。 */
    recordTick(w, branchId, selectedEntityId) {
      if (!this.enabled) return;
      try {
        const b = this._branch(branchId);
        if (w.tick === b.lastRecorded) return;          // 同 tick 不重複記帳
        if (w.tick < b.lastRecorded) return;            // 被替換的舊世界，忽略
        b.lastRecorded = w.tick;
        b.tickRing.push({ t: w.tick, fl: w._fluxLung || 0, ft: w._fluxTissue || 0, u: w.ledger ? w.ledger.usage : 0 });
        if (b.tickRing.length > TICK_RING) b.tickRing.splice(0, b.tickRing.length - TICK_RING);
        /* 選取實體的負載顯示樣本（每 6 tick） */
        if (selectedEntityId != null && w.tick % SAMPLE_EVERY === 0) {
          const e = w.entities[selectedEntityId];
          if (e) {
            let arr = b.samples[selectedEntityId];
            if (!arr) arr = b.samples[selectedEntityId] = [];
            arr.push({ t: w.tick, v: e.cap > 0 ? e.load / e.cap : 0 });
            if (arr.length > MAX_SAMPLES) arr.splice(0, arr.length - MAX_SAMPLES);
          }
        }
      } catch (err) {
        /* 觀察模組故障：停用並明示，不掩蓋、不補樣本、不碰模型 */
        this.enabled = false;
        this._lastError = String((err && err.stack) || err);
      }
    },

    _lastErrorText() { return this._lastError; },

    /* ---------- ViewContext（不可變快照） ---------- */
    viewContext(w, branchId, entityId) {
      return Object.freeze({
        sessionEpoch: this.sessionEpoch,
        runId: w ? w.runId : null,
        branchId: branchId,
        tick: w ? w.tick : null,
        entityId: entityId == null ? null : entityId,
        contentVersion: (CSL.Content && CSL.Content.contentVersion) || null,
        observationVersion: this.observationVersion
      });
    },

    /* ---------- selectorId 白名單讀值 ----------
       回傳 { id, value|null, state: 'ok'|'missing-window'|'no-entity'|'disabled' }；
       value 恒為數字或 null——缺資料絶不以 0 頂替。 */
    readout(w, branchId, entityId, selectorId) {
      const def = CSL.Content.readouts.find((r) => r.id === selectorId);
      if (!def) return { id: selectorId, value: null, state: 'unknown-selector' };
      if (!this.enabled) return { id: selectorId, value: null, state: 'disabled' };
      if (def.windowTicks > 0) {
        const win = this._window(w, branchId, def.windowTicks);
        if (!win.complete) return { id: selectorId, value: null, state: 'missing-window', have: win.have, need: def.windowTicks };
        const n = def.windowTicks, dt = DT;
        if (selectorId === 'flux_lung_rate') return { id: selectorId, value: win.sumFl / (n * dt), state: 'ok' };
        if (selectorId === 'flux_tissue_rate') return { id: selectorId, value: win.sumFt / (n * dt), state: 'ok' };
        if (selectorId === 'usage_rate') return { id: selectorId, value: (win.uNow - win.uThen) / (n * dt), state: 'ok' };
        return { id: selectorId, value: null, state: 'unknown-selector' };
      }
      if (selectorId === 'sel_load') {
        const e = entityId != null && w ? w.entities[entityId] : null;
        if (!e) return { id: selectorId, value: null, state: 'no-entity' };
        return { id: selectorId, value: e.cap > 0 ? e.load / e.cap : null, state: 'ok' };
      }
      if (selectorId === 'tissue_level') {
        const c = w.compartments.tissue;
        return { id: selectorId, value: c.capacity > 0 ? c.stock / c.capacity : null, state: 'ok' };
      }
      if (selectorId === 'alveolar_level') {
        const c = w.compartments.alveolar;
        return { id: selectorId, value: c.capacity > 0 ? c.stock / c.capacity : null, state: 'ok' };
      }
      if (selectorId === 'co2_blood') {
        if (!w.co2 || !isFinite(w.co2.blood)) return { id: selectorId, value: null, state: 'missing' };
        return { id: selectorId, value: w.co2.blood, state: 'ok' };
      }
      return { id: selectorId, value: null, state: 'unknown-selector' };
    },

    /* 窗口聚合：通量＝最近 N 個完成 tick（t−N+1..t）的每 tick 值總和；
       使用率差分基線＝tick t−N 的累積使用（tick 0 之 usage=0 為 createWorld
       的模型事實）；任一端點缺記錄 ⇒ missing-window（不以 0 頂替）。 */
    _window(w, branchId, n) {
      const b = this._branch(branchId);
      const ring = b.tickRing;
      const needTo = w.tick, needFrom = w.tick - n, fluxFrom = w.tick - n + 1;
      if (!ring.length || ring[ring.length - 1].t < needTo) return { complete: false, have: 0 };
      let sumFl = 0, sumFt = 0, have = 0, uThen = null, uNow = null, haveBase = false;
      for (let i = ring.length - 1; i >= 0; i--) {
        const r = ring[i];
        if (r.t > needTo) continue;
        if (r.t < needFrom) break;
        if (r.t === needFrom) { uThen = r.u; haveBase = true; }
        if (r.t >= fluxFrom) { sumFl += r.fl; sumFt += r.ft; have++; }
        if (uNow === null) uNow = r.u;
      }
      /* tick 0 的 usage=0 為模型事實（ledgerReset）；其餘缺基線即缺資料 */
      if (needFrom === 0) { haveBase = true; if (uThen === null) uThen = 0; }
      const complete = have >= n && haveBase && uNow !== null;
      return { complete, have, sumFl, sumFt, uNow, uThen };
    },

    /* 選取實體的負載歷史（顯示樣本；給曲線用）。
       以「本分支最後記錄 tick」為時界修剪：歷史上界是模型時間（120 模型秒），
       不是樣本數——離開選取造成的空窗不保留過期樣本。 */
    loadHistory(branchId, entityId) {
      if (!this.enabled) return { available: false, reason: 'disabled', points: [] };
      const b = this._branches[branchId];
      if (!b) return { available: false, reason: 'no-session', points: [] };
      const arr = b.samples[entityId];
      if (!arr || arr.length === 0) return { available: false, reason: 'no-samples-for-entity', points: [] };
      const cutoff = b.lastRecorded - 3600;               // 120 模型秒
      const points = arr.filter((p) => p.t >= cutoff);
      if (points.length === 0) return { available: false, reason: 'outside-time-window', points: [] };
      return { available: true, reason: null, points };
    },

    /* 最近變化描述（白名單措辭；無法證明就降級）。
       基準點取約 2 模型秒前（10 個顯示樣本）；若該基準與最新樣本間的
       時間斷裂超過 60 tick（2 模型秒），不得跨斷裂比較 ⇒ 缺資料。 */
    recentChange(branchId, entityId) {
      const h = this.loadHistory(branchId, entityId);
      if (!h.available || h.points.length < 2) return { state: 'missing', text: null };
      const pts = h.points;
      const tail = pts.slice(-11), latest = tail[tail.length - 1], ref = tail[0];
      const b = this._branches[branchId];
      // A selected entity may have old samples: never label them as a current trend.
      const contiguous = tail.every((p, i) => i === 0 || p.t - tail[i - 1].t === SAMPLE_EVERY);
      if (!contiguous || b.lastRecorded - latest.t >= SAMPLE_EVERY)
        return { state: 'missing', text: null, reason: 'observation-gap' };
      const d = latest.v - ref.v;
      const window = { delta: d, seconds: (latest.t - ref.t) * DT,
        fromTick: ref.t, toTick: latest.t };
      if (d > NEAR_ZERO) return { state: 'up', text: '上升', ...window };
      if (d < -NEAR_ZERO) return { state: 'down', text: '下降', ...window };
      return { state: 'flat', text: '近乎不變', ...window };
    },

    /* ---------- 速率序列（T-319 速率曲線圖） ----------
       以既有 tickRing 產生時間序列：每點都是「以該 tick 為右端、長度 n 的滾動窗口」，
       與 readout() 的 flux_lung_rate／flux_tissue_rate／usage_rate 同一套算法。
       契約：
       - 窗口不完整（缺右端、缺基線、或環內有缺口）⇒ 該點標 missing，
         **不插補、不以 0 頂替**，呼叫端必須畫成空白而非零線。
       - 只讀 tickRing，不寫模型欄位、不改觀察狀態（含不重排 ring）。
       - 時間上界沿用 120 模型秒；右端恆為本分支最後記錄的 tick。 */
    rateSeries(w, branchId, opts) {
      opts = opts || {};
      const n = opts.windowTicks || RATE_WINDOW;
      const every = opts.every || SAMPLE_EVERY;
      const spanTicks = opts.spanTicks || 3600;
      const meta = { window: { ticks: n, seconds: n * DT }, dt: DT, everyTicks: every };
      if (!this.enabled) return { available: false, reason: 'disabled', points: [], ...meta };
      const b = this._branches[branchId];
      if (!b || !b.tickRing.length) return { available: false, reason: 'no-session', points: [], ...meta };
      const ring = b.tickRing;
      const endTick = w && typeof w.tick === 'number' ? Math.min(w.tick, b.lastRecorded) : b.lastRecorded;
      if (endTick < 0) return { available: false, reason: 'no-session', points: [], ...meta };
      /* 單次線性掃描建索引與前綴和；之後每點 O(1)，不改動 ring 本身 */
      const pos = new Map();
      const pfl = new Array(ring.length + 1).fill(0);
      const pft = new Array(ring.length + 1).fill(0);
      for (let i = 0; i < ring.length; i++) {
        pos.set(ring[i].t, i);
        pfl[i + 1] = pfl[i] + ring[i].fl;
        pft[i + 1] = pft[i] + ring[i].ft;
      }
      const startTick = Math.max(0, endTick - spanTicks);
      const first = startTick + ((every - (startTick % every)) % every);
      const points = [];
      for (let t = first; t <= endTick; t += every) {
        const i = pos.get(t);
        const baseTick = t - n;
        const j = baseTick >= 0 ? pos.get(baseTick) : undefined;
        /* 右端、基線都要有實際記錄，且兩者之間必須連續 n 筆（i − j === n）——
           任一不成立即為缺資料；baseTick < 0 代表窗口尚未填滿，同樣是缺資料。 */
        if (i === undefined || j === undefined || i - j !== n) {
          points.push({ t, sec: t * DT, missing: true });
          continue;
        }
        points.push({
          t, sec: t * DT, missing: false,
          lung: (pfl[i + 1] - pfl[j + 1]) / (n * DT),
          tissue: (pft[i + 1] - pft[j + 1]) / (n * DT),
          usage: (ring[i].u - ring[j].u) / (n * DT),
        });
      }
      const observed = points.reduce((c, p) => c + (p.missing ? 0 : 1), 0);
      return {
        available: observed > 0,
        reason: observed > 0 ? null : 'missing-window',
        points, observedPoints: observed, totalPoints: points.length,
        fromTick: first, toTick: endTick, ...meta,
      };
    },

    /* 覆蓋樣本所涵蓋的時間（模型秒） */
    coverageSeconds(branchId, entityId) {
      const h = this.loadHistory(branchId, entityId);
      if (!h.available || h.points.length < 2) return null;
      // Count observed adjacent intervals, not unobserved gaps between selections.
      return h.points.reduce((sum, p, i, pts) =>
        sum + (i > 0 && p.t - pts[i - 1].t === SAMPLE_EVERY ? SAMPLE_EVERY * DT : 0), 0);
    }
  };

  Observe.RATE_WINDOW = RATE_WINDOW;
  Observe.SAMPLE_EVERY = SAMPLE_EVERY;
  Observe.MAX_SAMPLES = MAX_SAMPLES;
  Observe.DT = DT;
  CSL.Observe = Observe;
})(typeof window !== 'undefined' ? window : globalThis);
