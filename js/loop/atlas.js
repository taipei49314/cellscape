/* ============================================================
   CELLSCAPE v0.3 · Living Atlas — atlas.js
   四頁籤檢閱（認識它／看此刻／懂機制／查來源）、搜尋、
   肺泡交換剖面（示意）、選取負載曲線。
   邊界：只讀（Content + Observe + 模型欄位投影），不改世界；
   解說只用白名單規則與已讀欄位——無法證明就降級措辭；
   內容字串一律 esc() 後才進 innerHTML（IMPORT_TEXT_PLAINTEXT）。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (ch) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const pct = (v) => (v == null ? '—' : Math.round(v * 100) + '%');
  const RATE_FMT = (v) => (v == null ? '—' : v.toFixed(4));

  const TABS = ['know', 'now', 'mech', 'src'];
  const TAB_NAMES = { know: '認識它', now: '看此刻', mech: '懂機制', src: '查來源' };
  /* T-299 C3：EN 取 ContentEN.shell，否則回繁中原文 */
  const L = (key, zh) => ((CSL.I18n && CSL.I18n.get() === 'en' && CSL.I18n.shell(key)) || zh);
  const CT_LABEL = {
    biology_reference: '文獻知識（背景）',
    model_assumption: '模型近似（本版工程假設）',
    runtime_observation: '本次運行觀測',
    illustrative: '示意圖／動畫（非數值證明）',
    unresolved: '依據不足'
  };
  const RS_LABEL = {
    'verified': '已審核（人類裁定）',
    'draft-pending': '編輯草稿・待審',
    'verified-implementation': '已對照本版實作核對'
  };

  const Atlas = {
    activeTab: 'know',
    activeCard: 'rbc',
    _lastKey: null,
    _xsecOpen: false,
    _xsecStamp: null,

    /* ---------- 啟動與接線 ---------- */
    init() {
      $('atlasTabs').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-tab]');
        if (!b) return;
        this.activeTab = b.dataset.tab;
        this._syncTabs();
        this.render();
      });
      $('atlasSearch').addEventListener('input', () => this.render());
      $('atlasSection').addEventListener('click', () => this.openSection());
      $('xsecClose').addEventListener('click', () => {
        $('xsecModal').classList.add('hidden');
        this._xsecOpen = false; this._xsecStamp = null;
      });
      this._syncTabs();
    },

    _syncTabs() {
      document.querySelectorAll('#atlasTabs button').forEach((b) =>
        b.classList.toggle('on', b.dataset.tab === this.activeTab));
    },

    _sel() {
      const M = CSL.Main;
      const view = M.activeIsA && M.branchA ? M.branchA : M.world;
      const branchId = M.activeIsA && M.branchA ? 'A' : 'B';
      const entityId = M.selectedId != null ? M.selectedId : M.followedId;
      return { M, view, branchId, entityId };
    },

    onImport() {
      this._lastKey = null;
      this._xsecOpen = false; this._xsecStamp = null;
      $('xsecModal').classList.add('hidden');
      this.render();
    },

    _contextKey(view, branchId, entityId) {
      return [CSL.Observe.sessionEpoch, view.runId, branchId, entityId, view.tick].join('|');
    },

    /* 每 ~10 tick 的動態刷新（由 _tickUI 呼叫）。
       刷新鍵＝session+分支+實體+tick：暫停中切換分支/選取（tick 不變）也必須重繪
       （PAUSED_BRANCH_VIEW_CONTEXT 契約）。搜尋詞非空時不被即時刷新覆寫
       （SEARCH_CLICK_AND_LIVE_REFRESH 契約）；剖面 modal 開啟中隨 tick 重繪並標時點
       （SECTION_MODAL_TIME_VALIDITY 契約）。 */
    tick(view, branchId, entityId) {
      if (this._xsecOpen) {
        const stamp = this._contextKey(view, branchId, entityId);
        if (this._xsecStamp !== stamp) { this._xsecStamp = stamp; this.openSection(); }
      }
      if ($('inspector').classList.contains('closed')) return;
      if (($('atlasSearch').value || '').trim()) return;
      if (this.activeTab !== 'now') return;
      const key = this._contextKey(view, branchId, entityId);
      if (key === this._lastKey) return;
      this._lastKey = key;
      this._setBody(this.renderNow());
      this.drawChart(view, branchId, entityId);
    },

    render() {
      const body = $('atlasBody');
      /* 搜尋詞非空 ⇒ 任何頁籤都先顯示搜尋結果（搜尋框位於頁籤上方） */
      const q = ($('atlasSearch').value || '').trim().toLowerCase();
      if (q) {
        body.innerHTML = this._renderSearch(q);
        this._bind(body);
        return;
      }
      let html;
      if (this.activeTab === 'know') html = this.renderKnow();
      else if (this.activeTab === 'now') html = this.renderNow();
      else if (this.activeTab === 'mech') html = this.renderMech();
      else html = this.renderSources();
      this._setBody(html);
      if (this.activeTab === 'now') {
        const { view, branchId, entityId } = this._sel();
        this.drawChart(view, branchId, entityId);
      }
      this._bind(body);
    },

    /* 換入 innerHTML 前，保留 <details> 展開狀態（EXPANDED_DETAILS_PERSISTENCE 契約） */
    _setBody(html) {
      const body = $('atlasBody');
      const open = [...body.querySelectorAll('details')].map((d) => d.open);
      body.innerHTML = html;
      [...body.querySelectorAll('details')].forEach((d, i) => { if (open[i]) d.open = true; });
    },

    _bind(root) {
      this._bindChips(root);
      root.querySelectorAll('button[data-claim]').forEach((b) =>
        b.addEventListener('click', () => { this.activeTab = 'src'; this._syncTabs(); this.render(); }));
    },

    _bindChips(el) {
      el.querySelectorAll('button[data-card]').forEach((b) => b.addEventListener('click', () => {
        this.activeCard = b.dataset.card;
        /* 搜尋結果點擊＝導覽到該卡：清除搜尋詞，避免停在結果頁（SEARCH_CLICK 契約） */
        const si = $('atlasSearch');
        if ((si.value || '').trim()) { si.value = ''; }
        this.activeTab = 'know';
        this._syncTabs();
        this.render();
      }));
    },

    /* ---------- 共用小件 ---------- */
    _capTag(cap) {
      const ic = CSL.I18n ? CSL.I18n.cap(cap) : null;
      const legend = CSL.Content.capabilityLegend.find((l) => l.id === cap);
      const label = ic ? ic.label : (legend ? legend.label : cap);
      const note = ic ? ic.note : (legend ? legend.note : '');
      return `<span class="capTag cap-${esc(cap)}" title="${esc(note)}">${esc(label)}</span>`;
    },
    _claimRow(claimId) {
      const c = CSL.Content.claims[claimId];
      if (!c) return `<div class="claim missing">（主張 ${esc(claimId)} 未登錄）</div>`;
      const srcs = (c.sourceIds || []).map((sid) => {
        const s = CSL.Content.sources.find((x) => x.id === sid);
        return s ? `<a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" class="srcChip" title="${esc(s.title)}">[${esc(s.id)}] ${esc(s.publisher)}</a>` : '';
      }).join(' ');
      const impl = c.implRef ? `<div class="dim small">${esc(L('meta.impl', '實作對照'))}：${esc(c.implRef)}</div>` : '';
      const limit = c.supportedLimit ? `<div class="dim small">${esc(L('meta.limit', '適用限制'))}：${esc(c.supportedLimit)}</div>` : '';
      const text = (CSL.I18n && CSL.I18n.claimText(claimId)) || c.text;   // C3：EN 覆蓋層，缺鍵回繁中
      return `<div class="claim"><div>${esc(text)}</div>
        <div class="meta"><span class="ctTag ct-${esc(c.contentType)}">${esc(CT_LABEL[c.contentType] || c.contentType)}</span>
        <span class="rsTag">${esc(RS_LABEL[c.reviewStatus] || c.reviewStatus)}</span> ${srcs}</div>${impl}${limit}</div>`;
    },
    _cardChips() {
      return '<div class="chips">' + CSL.Content.cards.map((c) =>
        `<button class="chip${c.id === this.activeCard ? ' on' : ''}" data-card="${esc(c.id)}">${esc(c.name)}</button>`).join('') + '</div>';
    },

    /* ---------- 認識它 ---------- */
    renderKnow() {
      const card = CSL.Content.cards.find((c) => c.id === this.activeCard);
      const V = CSL.I18n ? CSL.I18n.card(card.id) : card;   // C3：EN 覆蓋層視圖（缺鍵回繁中）
      const qLabel = (CSL.I18n && CSL.I18n.get() === 'en') ? 'Q' : '問';
      const isRbc = this.activeCard === 'rbc';
      const live = isRbc
        ? '<div class="dim small">此卡對應即時模型實體：選取的紅血球即為動態對象（看此刻頁籤）。</div>'
        : '<div class="note warn2">本連動模式未個別模擬——數值欄位不適用（以「不適用」標示，不以 0 頂替）。</div>';
      return this._cardChips() + `
        <div class="cardHead">${this._capTag(card.capability)}
          <h3>${esc(V.name)} <span class="dim small">${esc(card.en)}</span></h3>
          <p class="headline">${esc(V.headline)}</p>
          <ul class="kps">${V.keyPoints.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>
          <button id="insideBtn" class="btn2 tiny" data-card="${esc(card.id)}">${esc(L('inside.entry', '🔬 細胞內部（示意）'))}</button>
          ${V.capabilityNote ? `<div class="note">${esc(V.capabilityNote)}</div>` : ''}
          ${live}
        </div>
        ${V.qa.map((qa, i) => `
          <div class="qa" id="qa-${i}">
            <div class="q">${esc(qLabel)}${i + 1}：${esc(qa.q)}</div>
            <div class="a">${esc(qa.a)}</div>
            <div class="claimLinks">${qa.claimIds.map((cid) =>
              `<button class="srcChip" data-claim="${esc(cid)}">${esc(L('meta.basis', '依據'))}：${esc(cid)}</button>`).join(' ')}</div>
          </div>`).join('')}`;
    },

    /* 搜尋（繁中／EN／別名；qa 全文） */
    _renderSearch(q) {
      const hits = [];
      for (const c of CSL.Content.cards) {
        const hay = [c.name, c.en, ...(c.aliases || []), c.category, c.headline, ...(c.keyPoints || [])].join(' ').toLowerCase();
        if (hay.includes(q)) hits.push({ type: 'card', card: c });
        c.qa.forEach((qa, i) => {
          if ((qa.q + ' ' + qa.a).toLowerCase().includes(q)) hits.push({ type: 'qa', card: c, i });
        });
      }
      if (!hits.length) {
        return `<div class="dim">沒有符合「${esc(q)}」的收錄項目。</div>
          <div class="note">此版僅收錄 8 卡 32 問；未收錄的問題明示「此版尚未提供」，不捏造答案或來源。</div>`;
      }
      return this._cardChips() + `<div class="dim small">符合 ${hits.length} 項：</div>` + hits.map((h) => `
        <div class="hit"><button class="chip" data-card="${esc(h.card.id)}">${esc(h.card.name)}</button>
        ${h.type === 'qa' ? `<span class="small"> 問${h.i + 1}：${esc(h.card.qa[h.i].q)}</span>` :
          `<span class="small"> ${esc(h.card.headline)}</span>`}</div>`).join('');
    },

    /* ---------- 看此刻（來源僅為顯示中的分支模型） ---------- */
    renderNow() {
      const { view, branchId, entityId } = this._sel();
      const vc = CSL.Observe.viewContext(view, branchId, entityId);
      const e = entityId != null ? view.entities[entityId] : null;
      const edge = e ? CSL.EDGES[e.edge] : null;
      const ro = {};
      for (const def of CSL.Content.readouts) ro[def.id] = CSL.Observe.readout(view, branchId, entityId, def.id);

      /* 白名單解說：位置／負載變化／可證明的交換 */
      const NW = (k, vars) => (CSL.I18n ? CSL.I18n.now(k, vars) : null);
      let exchangeLine;
      if (!e) exchangeLine = NW('noEntity') || '尚未選取紅血球——點擊場景中的細胞，或使用「跟著一顆紅血球」。';
      else if (edge && edge.exchange === 'lung') {
        const r = ro.flux_lung_rate;
        if (r.state === 'ok' && r.value > 0) exchangeLine = NW('lungLoading', { rate: RATE_FMT(r.value) }) || `最近 3 模型秒實測到肺部裝載通量：約 ${RATE_FMT(r.value)} 模型單位／模型秒。`;
        else if (r.state === 'ok') exchangeLine = NW('lungZero') || '位於肺部交換區域；最近窗口內實測通量為零——不宣稱「正在裝載」。';
        else exchangeLine = NW('lungWindow', { have: r.have || 0, need: r.need }) || `位於肺部交換區域；觀察窗尚未取得（${r.have || 0}/${r.need} tick），不推測交換狀態。`;
      } else if (edge && edge.exchange === 'tissue') {
        const r = ro.flux_tissue_rate;
        if (r.state === 'ok' && r.value > 0) exchangeLine = NW('tissueUnloading', { rate: RATE_FMT(r.value) }) || `最近 3 模型秒實測到組織卸載通量：約 ${RATE_FMT(r.value)} 模型單位／模型秒。`;
        else if (r.state === 'ok') exchangeLine = NW('tissueZero') || '位於組織交換區域；最近窗口內實測通量為零——不宣稱「正在卸載」。';
        else exchangeLine = NW('tissueWindow', { have: r.have || 0, need: r.need }) || `位於組織交換區域；觀察窗尚未取得（${r.have || 0}/${r.need} tick），不推測交換狀態。`;
      } else if (edge) exchangeLine = NW('nonExchange', { label: edge.label }) || `位於${edge.label}（非交換界面段）——此段無交換可證明。`;

      const change = CSL.Observe.recentChange(branchId, entityId);
      const changeLine = (change.state === 'missing'
        ? (NW('changeMissing') || '負載最近變化：資料不足（本實體樣本尚少）。')
        : (NW('changeMeasured', { sec: change.seconds.toFixed(1), text: change.text, delta: change.delta != null ? '（' + (change.delta > 0 ? '+' : '') + change.delta.toFixed(3) + '）' : '' })
          || `負載最近變化（觀測 ${change.seconds.toFixed(1)} 模型秒）：${change.text}${change.delta != null ? '（' + (change.delta > 0 ? '+' : '') + change.delta.toFixed(3) + '）' : ''}。`))
        .replace('上升', 'rising').replace('下降', 'falling');   // change.text 方向詞來自 observe 資料值
      const cov = CSL.Observe.coverageSeconds(branchId, entityId);
      const covLine = cov == null
        ? (NW('covMissing') || '觀察覆蓋：選取剛改變或剛匯入——本實體尚無歷史樣本（明示缺資料，不捏造曲線）。')
        : (NW('covMeasured', { sec: cov.toFixed(1) }) || `觀察覆蓋：窗口內已觀測約 ${cov.toFixed(1)} 模型秒（空窗不計入）。`);
      /* 卡片語境：看此刻永遠顯示「選取的模型實體」；知識卡未個別模擬（非阻塞觀察修復） */
      const activeCard = CSL.Content.cards.find((c) => c.id === this.activeCard);
      const cardNote = this.activeCard !== 'rbc' && activeCard
        ? `<div class="note warn2">${esc(NW(activeCard.capability === 'aggregate' ? 'cardNoteAggregate' : 'cardNoteKnowledge', { name: activeCard.name })
          || `目前卡片「${activeCard.name}」為${activeCard.capability === 'aggregate' ? '聚合近似' : '知識卡'}（本連動模式未個別模擬）；下方數值來自你選取的紅血球。`)}</div>`
        : '';

      const readoutRows = CSL.Content.readouts.map((def) => {
        const r = ro[def.id];
        let v;
        if (r.state === 'ok') v = def.unit.includes('%') ? pct(r.value) : RATE_FMT(r.value);
        else if (r.state === 'missing-window') v = `<span class="missing">${esc(NW('roMissingWindow', { have: r.have, need: r.need }) || `缺資料（窗口 ${r.have}/${r.need} tick）`)}</span>`;
        else if (r.state === 'no-entity') v = `<span class="missing">${esc(NW('roNoEntity') || '未選取實體')}</span>`;
        else v = `<span class="missing">${esc(NW('roMissing') || '缺資料')}</span>`;
        const rn = CSL.I18n ? CSL.I18n.readout(def.id) : { name: def.name };
        return `<div class="kv${def.def ? '' : ' ext'}"><i>${esc(rn.name || def.name)}${def.unit.includes('模型秒') ? ' <span class="dim">（模型單位／模型秒）</span>' : ''}</i><b>${v}</b></div>`;
      }).join('');

      const defList = CSL.Content.readouts.filter((d) => !d.def).map((d) => {
        const rn2 = CSL.I18n ? CSL.I18n.readout(d.id) : { name: d.name };
        return `<div class="dim tiny">${esc(rn2.name || d.name)}：${esc(d.formula)}（${esc(d.unit)}）</div>`;
      }).join('');

      return `
        <div class="vc mono tiny">${esc(NW('vcLine', { session: vc.sessionEpoch, branch: vc.branchId, run: vc.runId || '—', tick: vc.tick, entity: vc.entityId == null ? '—' : '#' + vc.entityId })
          || `session #${vc.sessionEpoch} · 分支 ${vc.branchId} · run ${vc.runId || '—'} · tick ${vc.tick} · 實體 ${vc.entityId == null ? '—' : '#' + vc.entityId}`)}<br>
          ${esc(NW('vcLine2', { content: vc.contentVersion, obs: vc.observationVersion }) || `內容包 ${vc.contentVersion} · 觀察規則 ${vc.observationVersion}`)}</div>
        ${cardNote}
        <div class="nowLine">${esc(exchangeLine)}</div>
        <div class="nowLine dim">${esc(changeLine)}</div>
        <div class="nowLine dim">${esc(covLine)}</div>
        ${readoutRows}
        <div class="note">${esc(NW('defaultsNote') || '顯示前三項為預設讀值；其餘三項展開顯示。')}${defList ? '<details><summary class="dim small">' + esc(NW('expandLedger') || '展開守恆帳與規則細節') + '</summary>' + defList +
          `<div class="dim tiny">${esc(NW('ledgerLine', { initial: String(view.ledger.initialTotal.toFixed(3)), input: String(view.ledger.input.toFixed(3)), usage: String(view.ledger.usage.toFixed(3)), expelled: String(view.ledger.expelled.toFixed(3)), residual: view.ledger.lastResidual.toExponential(2) })
            || `守恆帳（每 30 tick 檢查，殘差 ≤1e-6）：初始 ${view.ledger.initialTotal.toFixed(3)}、累積輸入 ${view.ledger.input.toFixed(3)}、使用 ${view.ledger.usage.toFixed(3)}、呼出 ${view.ledger.expelled.toFixed(3)}、最近殘差 ${view.ledger.lastResidual.toExponential(2)}。`)}</div></details>` : ''}</div>
        <div class="note">${esc(NW('spo2Note') || '這裡的百分比是相對模型容量，不是 SpO₂；速率以模型時間換算（dt = 1/30 模型秒）。')}</div>
        <div class="chartBox"><canvas id="loadChart" width="10" height="10"></canvas>
          <div id="chartNote" class="dim tiny"></div></div>`;
    },

    /* 曲線：只在樣本存在處畫線；缺口不連接；介入點畫時間標記。
       x 軸定義域＝[最早樣本, 最新樣本]（上界 120 模型秒）——「現在」恆在右緣
       （CHART_CURRENT_AT_RIGHT_EDGE 契約）。 */
    drawChart(view, branchId, entityId) {
      const cv = $('loadChart');
      if (!cv) return;
      const dpr = global.devicePixelRatio || 1;
      const wCss = cv.parentElement.clientWidth || 240, hCss = 96;
      if (cv.width !== wCss * dpr) { cv.width = wCss * dpr; cv.height = hCss * dpr; cv.style.width = wCss + 'px'; cv.style.height = hCss + 'px'; }
      const g = cv.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, wCss, hCss);
      const h = CSL.Observe.loadHistory(branchId, entityId);
      const note = $('chartNote');
      if (!h.available) {
        g.fillStyle = 'rgba(160,180,200,.55)';
        g.font = '11px sans-serif';
        g.fillText(h.reason === 'disabled' ? '觀察模組已停用（明示錯誤）' : '缺資料：本實體尚無觀察樣本', 8, hCss / 2);
        if (note) note.textContent = '尚無曲線——缺資料不以 0 或虛線頂替。';
        return;
      }
      const pts = h.points;
      const tEnd = view.tick; // 現在由模型時鐘定義，不由舊選取最後的樣本定義
      const t0 = Math.max(0, tEnd - 3600);                     // 上界 120 模型秒
      const win = pts.filter((p) => p.t >= t0);
      const span = Math.max(1, tEnd - t0);
      const x = (t) => 30 + (wCss - 38) * ((t - t0) / span);
      const y = (v) => hCss - 14 - (hCss - 24) * Math.max(0, Math.min(1, v));
      g.strokeStyle = 'rgba(140,160,180,.35)';
      g.strokeRect(30.5, 4.5, wCss - 38, hCss - 18);
      g.font = '9px sans-serif'; g.fillStyle = 'rgba(160,180,200,.8)';
      g.fillText('100%', 2, 10); g.fillText('0%', 2, hCss - 14);
      g.fillText('−' + (span / 30).toFixed(0) + ' 模型秒', 32, hCss - 2);
      g.fillText('現在', wCss - 26, hCss - 2);
      /* 介入標記（actions：u=使用者 t=導覽） */
      for (const a of view.actions || []) {
        if (a.tick < t0 || a.tick > tEnd) continue;
        const ax = x(a.tick);
        g.strokeStyle = 'rgba(255,210,120,.6)';
        g.beginPath(); g.moveTo(ax, 5); g.lineTo(ax, hCss - 14); g.stroke();
        g.fillStyle = 'rgba(255,210,120,.9)';
        g.fillText(a.source === 'user' ? '介入' : 'tour', ax + 1, 12);
      }
      /* 曲線：相鄰樣本 Δt == 6 tick 才連線；缺口斷開（不插補） */
      g.strokeStyle = '#6fd3ff'; g.lineWidth = 1.6; g.beginPath();
      let pen = false;
      for (let i = 0; i < win.length; i++) {
        const p = win[i];
        if (i > 0 && win[i].t - win[i - 1].t !== CSL.Observe.SAMPLE_EVERY) pen = false;
        if (!pen) { g.moveTo(x(p.t), y(p.v)); pen = true; }
        else g.lineTo(x(p.t), y(p.v));
      }
      g.stroke();
      if (note) note.textContent = `選取 RBC 氧負載時間線（每 6 tick 一點＝0.2 模型秒；圖窗 ${((tEnd - t0) / 30).toFixed(1)} 模型秒，上限 120；右端＝目前 tick ${view.tick}，空白代表未觀察）。`;
    },

    /* ---------- 懂機制 ---------- */
    renderMech() {
      const card = CSL.Content.cards.find((c) => c.id === this.activeCard);
      const claimIds = new Set();
      card.qa.forEach((qa) => qa.claimIds.forEach((cid) => claimIds.add(cid)));
      if (this.activeCard === 'rbc') ['C-model-load', 'C-model-aggregate', 'C-model-lungsupply', 'C-model-flowspeed', 'C-model-tissuedemand'].forEach((c) => claimIds.add(c));
      const K = { KL: CSL.K_LUNG, KT: CSL.K_TISSUE, KU: CSL.K_USE, DT: 1 / 30 };
      const rulesBlock = `
        <div class="note"><b>本版（MODEL_VERSION ${esc(CSL.MODEL_VERSION)}）的三種規則——文字與實作綁定：</b>
        <ul class="kps">
          <li>肺端裝載：flux = K_LUNG × max(0, 肺泡水位 − 負載) × lungSupply，受庫存與可用容量限制。K_LUNG = ${K.KL}（模型單位）。</li>
          <li>組織卸載：flux = K_TISSUE × max(0, 負載 − 組織水位) × (0.5 + tissueDemand)，受負載與組織容量限制。K_TISSUE = ${K.KT}。</li>
          <li>組織使用：usage = K_USE × (0.5 + tissueDemand) × 組織水位，受現有庫存限制；庫存為零即無消耗。K_USE = ${K.KU}。</li>
        </ul>
        負載欄位是攜帶狀態的近似——沒有逐分子結合、沒有血紅素解離曲線；動畫節奏不代表結合/解離時間。</div>`;
      return this._cardChips() + `
        <h3>${esc(L('tab.mech', '懂機制'))}：${esc(card.name)}</h3>
        ${this.activeCard === 'rbc' ? '<div class="ill"><svg viewBox="0 0 240 90" role="img" aria-label="紅血球與血紅素示意">' +
          '<ellipse cx="70" cy="45" rx="46" ry="30" fill="#c0392b" opacity=".85"/><ellipse cx="70" cy="45" rx="18" ry="9" fill="#8e2a20" opacity=".9"/>' +
          '<text x="70" y="86" fill="#9fb6c9" font-size="9" text-anchor="middle">雙凹圓盤（示意）</text>' +
          '<g transform="translate(150,20)"><circle cx="0" cy="0" r="9" fill="#e67e22"/><circle cx="22" cy="14" r="9" fill="#e67e22"/><circle cx="14" cy="34" r="9" fill="#e67e22"/><circle cx="-8" cy="38" r="9" fill="#e67e22"/><text x="14" y="60" fill="#9fb6c9" font-size="9" text-anchor="middle">血紅素四聚體（示意）</text></g></svg>' +
          '<div class="dim tiny">機制示意／非本次分子模擬；展開時此標記持續顯示。</div></div>' : ''}
        ${card.capability === 'dynamic' ? rulesBlock : `<div class="note">${esc(L('mech.knowledgeNote', '此卡為知識／結構說明；本連動世界的交換由聚合規則近似（見紅血球卡的規則區塊）。'))}</div>`}
        <div class="dim small">相關依據：</div>
        ${[...claimIds].map((cid) => this._claimRow(cid)).join('')}`;
    },

    /* ---------- 查來源 ---------- */
    renderSources() {
      const card = CSL.Content.cards.find((c) => c.id === this.activeCard);
      const usedIds = new Set();
      card.qa.forEach((qa) => qa.claimIds.forEach((cid) => {
        usedIds.add(cid);
        (CSL.Content.claims[cid] && CSL.Content.claims[cid].sourceIds || []).forEach((s) => usedIds.add(s));
      }));
      const claimsHtml = [...usedIds].filter((id) => CSL.Content.claims[id]).map((cid) => this._claimRow(cid)).join('');
      const sourcesHtml = CSL.Content.sources.filter((s) => [...usedIds].some((cid) => {
        const c = CSL.Content.claims[cid]; return c && (c.sourceIds || []).includes(s.id);
      })).map((s) => `
        <div class="srcRow">
          <b>[${esc(s.id)}] ${esc(s.publisher)} — ${esc(s.title)}</b>
          <div class="tiny"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a></div>
          <div class="dim tiny">${esc(L('src.usage', '用途範圍'))}：${esc(s.use)}</div>
          ${s.assetNote ? `<div class="dim tiny">${esc(L('src.assetNote', '素材注意'))}：${esc(s.assetNote)}</div>` : ''}
          ${s.licenseNote ? `<div class="dim tiny">授權：${esc(s.licenseNote)}</div>` : ''}
          <div class="dim tiny">${esc(L('src.checked', '核對日期'))}：${esc(s.checkedOn)}</div>
        </div>`).join('');
      return this._cardChips() + `
        <h3>${esc(L('tab.src', '查來源'))}：${esc(card.name)}</h3>
        <div class="note warn2">${esc(L('src.warn', '「來源存在」不等於「主張已被來源支持」——biology_reference 條目目前為編輯草稿（待審），model_assumption 條目已對照本版實作核對。'))}</div>
        <div class="dim small">本卡主張：</div>${claimsHtml || '<div class="dim small">（無）</div>'}
        <div class="dim small">對應來源：</div>${sourcesHtml || '<div class="dim small">（本卡主張皆為模型近似，無外部文獻來源）</div>'}
        <div class="note">分類對應：${CSL.Content.classification.filter((x) => x.cardId === card.id)
          .map((x) => x.mappings.map((m) => `${esc(m.kind)}：${esc(m.label)}${m.note ? '（' + esc(m.note) + '）' : ''}`).join('；')).join('')}</div>`;
    },

    /* ---------- 肺泡交換剖面（示意） ----------
       內容標記觀察時點（tick），模型運行中由 tick() 隨新 tick 重繪
       （SECTION_MODAL_TIME_VALIDITY 契約——零通量文案不得過期充數）。 */
    openSection() {
      const { view, branchId, entityId } = this._sel();
      this._xsecOpen = true;
      this._xsecStamp = this._contextKey(view, branchId, entityId);
      const e = entityId != null ? view.entities[entityId] : null;
      const onLung = e && CSL.EDGES[e.edge] && CSL.EDGES[e.edge].exchange === 'lung';
      const rate = CSL.Observe.readout(view, branchId, entityId, 'flux_lung_rate');
      let rbcNote, fluxNote;
      if (!e) { rbcNote = '尚未選取紅血球。'; fluxNote = ''; }
      else if (onLung) {
        rbcNote = `選取的紅血球 #${e.id} 位於肺微血管（LUNG_CAP），負載 ${pct(e.cap > 0 ? e.load / e.cap : null)}（模型容量）。`;
        if (rate.state === 'ok' && rate.value > 0) fluxNote = `最近窗口實測裝載通量 ≈ ${RATE_FMT(rate.value)} 模型單位／模型秒（箭頭＝實測流向，非逐分子動畫）。`;
        else if (rate.state === 'ok') fluxNote = '最近窗口實測通量為零——不顯示流動動畫、不宣稱正在交換。';
        else fluxNote = `觀察窗尚未取得（${rate.have || 0}/${rate.need} tick）——不推測交換狀態。`;
      } else if (e) {
        rbcNote = `選取的紅血球 #${e.id} 目前不在肺部交換段（位於${esc(CSL.EDGES[e.edge].label)}）；剖面僅為結構知識示意。`;
        fluxNote = '';
      }
      const showFlux = rate.state === 'ok' && rate.value > 0;
      $('xsecBody').innerHTML = `
        <svg viewBox="0 0 420 200" role="img" aria-label="肺泡毛細血管交換剖面示意">
          <rect x="0" y="0" width="150" height="200" fill="#274b63" opacity=".45"/>
          <text x="75" y="24" fill="#bfe3ff" font-size="11" text-anchor="middle">肺泡氣側（alveolus）</text>
          <rect x="150" y="0" width="26" height="200" fill="#7fd4a8" opacity=".5"/>
          <text x="163" y="194" fill="#c9f2dc" font-size="9" text-anchor="middle" transform="rotate(-90 163 194)">AT1 上皮（薄壁）</text>
          <rect x="176" y="0" width="18" height="200" fill="#d9b96a" opacity=".5"/>
          <text x="185" y="194" fill="#f2e2b3" font-size="9" text-anchor="middle" transform="rotate(-90 185 194)">基底膜＋內皮</text>
          <rect x="194" y="0" width="226" height="200" fill="#6e2b2b" opacity=".55"/>
          <text x="307" y="24" fill="#ffc9c9" font-size="11" text-anchor="middle">毛細血管管腔（血漿＋RBC）</text>
          <ellipse cx="290" cy="110" rx="26" ry="17" fill="#c0392b"/>
          <ellipse cx="290" cy="110" rx="10" ry="5" fill="#8e2a20"/>
          <text x="290" y="146" fill="#ffb3b3" font-size="9" text-anchor="middle">紅血球（示意位置）</text>
          ${showFlux ? `<defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="#9fe0ff"/></marker></defs>
          <line x1="90" y1="100" x2="240" y2="105" stroke="#9fe0ff" stroke-width="2.5" marker-end="url(#arr)"/>
          <text x="150" y="90" fill="#9fe0ff" font-size="9" text-anchor="middle">O₂（實測通量流向）</text>` : ''}
          <circle cx="60" cy="150" r="11" fill="#f2c14e" opacity=".8"/>
          <text x="60" y="176" fill="#f2e2b3" font-size="8" text-anchor="middle">AT2／巨噬（知識層示意，不在模型實體清單）</text>
        </svg>
        <div class="nowLine">${esc(rbcNote)}</div>
        ${fluxNote ? `<div class="nowLine dim">${esc(fluxNote)}</div>` : ''}
        <div class="vc mono tiny">觀察時點：session ${CSL.Observe.sessionEpoch} · 分支 ${esc(branchId)} · tick ${view.tick}${M_paused() ? '（模型暫停中，內容不隨時間變化）' : '（模型運行中，內容隨 tick 更新）'}</div>
        <div class="dim tiny">AT2 與巨噬細胞僅為知識層示意——不混入活體數量、氧守恆帳與世界實體清單（48 顆 RBC 之外無其他模型實體）。</div>`;
      $('xsecModal').classList.remove('hidden');

      function M_paused() { return !!(CSL.Main && CSL.Main.paused); }
    }
  };

  CSL.Atlas = Atlas;
})(typeof window !== 'undefined' ? window : globalThis);
