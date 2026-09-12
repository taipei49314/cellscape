/* CELLSCAPE · Living Atlas — 血紅素放大視角（T-321 刀 K1）
   ============================================================
   這是**模型欄位的放大**，不是光學放大、不是分子模擬：放大的是
   「這顆代表性紅血球在模型裡的攜氧狀態」，不是血紅素的實體構造。

   誠實規則（機械化在 docs/audit-probes/atlas-tests.cjs）：
   - 內容一律住在 LAYERS 結構表，每筆非 kind:'claim'（claimIds 必須能在
     CSL.Content.claims 解析，並由 UI 就地印出依據與適用限制）即
     kind:'illustrative'（明示示意，且不得夾帶數量或單位）。
   - 模組自撰字串不得出現未登錄的生理詞彙；引用自 CSL.Content 的文字
     不在此限（那是登錄過的正本）。
   - 填充條是**連續**的：刻度不對應任何分子數量，因為 C-model-load 明寫
     本模型以 0–1 負載欄位近似攜帶狀態、沒有逐分子結合。
   - 缺資料明示為缺資料：沒有選取實體、觀察樣本不足時不以 0 頂替。
   - 純函式層（viewModel/render）不碰 DOM，可在 Node VM 內受測。
   未動 unchanged-core 凍結七檔。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL = global.CSL || {};

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* 放大視角的內容層：每筆都要有依據，或明示為示意。
     zh 是模組自撰字串（受禁用詞探針約束）；claimIds 指向既有登錄主張。 */
  const LAYERS = [
    { id: 'frame', kind: 'illustrative',
      zh: '以下把這顆紅血球在模型裡的狀態放大來看；圖為示意，不是顯微影像，也不是分子模擬。' },
    { id: 'carrier', kind: 'claim', claimIds: ['C-rbc-hemo', 'C-hemo-iron'],
      zh: '攜氧靠血紅素：在肺裝載、到組織釋放。' },
    { id: 'shape', kind: 'claim', claimIds: ['C-rbc-morph', 'C-rbc-nucleus'],
      zh: '成熟紅血球是雙凹圓盤、沒有細胞核。' },
    { id: 'field', kind: 'claim', claimIds: ['C-model-load'],
      zh: '模型用一個 0–1 的負載欄位近似攜帶狀態——下面的填充條就是這個欄位，刻度不代表分子數目。' },
    { id: 'sample', kind: 'claim', claimIds: ['C-model-48'],
      zh: '畫面上的這顆是固定抽樣的代表之一，不是全身總量。' },
    { id: 'interface', kind: 'claim', claimIds: ['C-model-aggregate'],
      zh: '裝載與卸載由聚合界面規則處理，沒有個別上皮或內皮細胞實體。' },
    { id: 'ceiling', kind: 'claim', claimIds: ['C-model-anemia'],
      zh: '貧血參數只壓低肺端可裝載的上限，不會回頭改變已經攜帶的量。' },
    { id: 'unload', kind: 'claim', claimIds: ['C-model-co2', 'C-model-perfusion'],
      zh: '卸載快慢同時受血中 CO₂ 指數與組織灌流影響；這兩個是全世界共用的量，不是這一顆的私有欄位。' },
  ];

  /* 純資料層：不碰 DOM、不寫模型欄位。
     entityId 必須與 Observe 記樣本的同一顆（主迴圈只記選取／跟隨的那顆），
     否則趨勢必為缺資料。 */
  function viewModel(view, branchId, entityId) {
    const O = CSL.Observe;
    const vm = {
      observationVersion: O ? O.observationVersion : null,
      contentVersion: (CSL.Content && CSL.Content.contentVersion) || null,
      tick: view ? view.tick : null,
      entityId: entityId == null ? null : entityId,
      layers: LAYERS,
      available: false,
      reason: null,
      load: null, cap: null, ratio: null, ceiling: null, anemia: null,
      edgeLabel: null, exchange: null, loops: null,
      co2: null, perfusion: null,
      trend: { available: false, reason: 'not-computed', points: [] },
    };
    if (!view) { vm.reason = 'no-world'; return vm; }
    if (entityId == null) { vm.reason = 'no-entity'; return vm; }
    const e = view.entities ? view.entities[entityId] : null;
    if (!e) { vm.reason = 'no-entity'; return vm; }
    const p = view.params || {};
    const edge = CSL.EDGES ? CSL.EDGES[e.edge] : null;
    vm.available = true;
    vm.load = e.load;
    vm.cap = e.cap;
    vm.ratio = e.cap > 0 ? e.load / e.cap : null;
    vm.anemia = typeof p.anemia === 'number' ? p.anemia : null;
    vm.ceiling = vm.anemia == null ? null : (1 - vm.anemia);
    vm.edgeLabel = edge ? edge.label : null;
    vm.exchange = edge ? (edge.exchange || null) : null;
    vm.loops = e.loops;
    vm.co2 = view.co2 && typeof view.co2.blood === 'number' ? view.co2.blood : null;
    vm.perfusion = typeof p.perfusion === 'number' ? p.perfusion : null;
    /* 迷你趨勢沿用既有觀察樣本；缺樣本就是缺樣本，不補點 */
    if (O && O.loadHistory) {
      const h = O.loadHistory(branchId, entityId);
      vm.trend = h.available
        ? { available: true, reason: null, points: h.points.slice(-40) }
        : { available: false, reason: h.reason, points: [] };
    }
    return vm;
  }

  /* 純呈現層：吃 viewModel 的輸出，回傳 HTML 字串（不碰 document） */
  function render(vm) {
    const L = (k, zh) => (CSL.I18n && CSL.I18n.shell(k)) || zh;
    const H = (k, zh) => (CSL.I18n && CSL.I18n.hemo ? CSL.I18n.hemo(k) : null) || zh;
    const claimRows = (ids) => (CSL.Atlas && CSL.Atlas._claimRow)
      ? ids.map((cid) => CSL.Atlas._claimRow(cid)).join('') : '';
    const layerHtml = vm.layers.map((ly) => {
      const text = esc(H('layer.' + ly.id, ly.zh));
      if (ly.kind === 'illustrative') {
        return '<div class="hemoLayer"><div class="dim">' + text + '</div>'
          + '<div class="dim tiny">' + esc(H('illustrativeTag', '示意・教育簡化，非分子模擬')) + '</div></div>';
      }
      return '<div class="hemoLayer"><div>' + text + '</div>' + claimRows(ly.claimIds) + '</div>';
    }).join('');
    const closeBtn = '<button id="hemoClose" class="btn2 tiny">' + esc(L('close', '關閉')) + '</button>';
    const title = esc(H('title', '血紅素放大視角（模型欄位）'));
    if (!vm.available) {
      const why = vm.reason === 'no-entity'
        ? H('missingEntity', '缺資料：目前沒有選取任何一顆紅血球——先按「跟著一顆紅血球」或點一顆再看。')
        : H('missingWorld', '缺資料：目前沒有可讀的世界狀態。');
      return '<div class="hemoBody"><h3>' + title + '</h3>'
        + '<div class="note warn2">' + esc(why) + '</div>' + layerHtml + closeBtn + '</div>';
    }
    const pct = (v) => (v == null ? '—' : (v * 100).toFixed(1) + '%');
    const ceilingMark = (vm.ceiling == null || vm.ceiling >= 1) ? ''
      : '<div class="hemoCeil" style="left:' + (vm.ceiling * 100).toFixed(2) + '%"></div>';
    const bar = '<div class="hemoBar"><div class="hemoFill" style="width:'
      + ((vm.ratio == null ? 0 : Math.max(0, Math.min(1, vm.ratio))) * 100).toFixed(2) + '%"></div>'
      + ceilingMark + '</div>';
    const rows = [
      [H('rowLoad', '負載比例（load ÷ cap）'), pct(vm.ratio)],
      [H('rowCeiling', '肺端可裝載上限（1 − anemia）'), pct(vm.ceiling)],
      [H('rowWhere', '目前所在'), vm.edgeLabel == null ? '—' : vm.edgeLabel
        + (vm.exchange ? '（' + H('exchangeHere', '交換界面段') + '）' : '')],
      [H('rowLoops', '已完成圈數'), vm.loops == null ? '—' : String(vm.loops)],
      [H('rowCo2', '血中 CO₂ 指數（全世界共用）'), vm.co2 == null ? '—' : vm.co2.toFixed(3)],
      [H('rowPerfusion', '組織灌流（全世界共用）'), vm.perfusion == null ? '—' : vm.perfusion.toFixed(2)],
    ].map((r) => '<div class="hemoRow"><i>' + esc(r[0]) + '</i><b class="mono">' + esc(r[1]) + '</b></div>').join('');
    const trend = vm.trend.available
      ? '<div class="dim tiny">' + esc(H('trendOk', '下方細線＝這顆的負載樣本（最近觀測）')) + '</div>'
        + '<div class="hemoSpark">' + vm.trend.points.map((p) =>
          '<i style="height:' + (Math.max(0, Math.min(1, p.v)) * 100).toFixed(1) + '%"></i>').join('') + '</div>'
      : '<div class="dim tiny">' + esc(H('trendMissing', '缺資料：這顆還沒有觀察樣本（不以 0 或直線頂替）')) + '</div>';
    return '<div class="hemoBody"><h3>' + title + '</h3>'
      + '<div class="note">' + esc(H('frameNote', '放大的是模型欄位，不是顯微影像；填充是連續的，刻度不對應分子數目。')) + '</div>'
      + bar + '<div class="hemoRows">' + rows + '</div>' + trend + layerHtml
      + '<div class="dim tiny">' + esc(H('stamp', '時點')) + '：tick ' + esc(String(vm.tick))
      + ' · ' + esc(String(vm.contentVersion)) + ' · ' + esc(String(vm.observationVersion)) + '</div>'
      + closeBtn + '</div>';
  }

  /* ---------- DOM 層 ---------- */
  let openState = false;

  function _box() {
    let box = global.document.getElementById('hemoModal');
    if (!box) {
      box = global.document.createElement('div');
      box.id = 'hemoModal';
      box.className = 'modal hidden';
      box.innerHTML = '<div class="mbox" id="hemoMbox"></div>';
      global.document.body.appendChild(box);
      box.addEventListener('click', (ev) => {
        if (ev.target === box || ev.target.id === 'hemoClose') close();
      });
      global.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && openState) close(); });
    }
    return box;
  }

  function _paint() {
    const sel = CSL.Atlas && CSL.Atlas._sel ? CSL.Atlas._sel() : null;
    if (!sel) return;
    const vm = viewModel(sel.view, sel.branchId, sel.entityId);
    _box().firstElementChild.innerHTML = render(vm);
  }

  function open() { openState = true; _paint(); _box().classList.remove('hidden'); }
  function close() {
    openState = false;
    const b = global.document.getElementById('hemoModal');
    if (b) b.classList.add('hidden');
  }
  function isOpen() { return openState; }
  /* 由主迴圈的 UI 節流呼叫：開啟中才重繪，避免過期讀值充數 */
  function tick() { if (openState) _paint(); }

  CSL.Hemo = { viewModel, render, open, close, tick, isOpen, LAYERS };
})(typeof window !== 'undefined' ? window : globalThis);
