/* CELLSCAPE · Living Atlas — 章節 B/C 學習控制器（T-321 刀 K2）
   ============================================================
   定義來源：倉內**沒有**章節 B/C 的規格（全倉只有 docs/LOOP-NOTES.md 的
   一行未做清單與 README 一句），定義它的 v0.3 規劃包不在追蹤檔內。
   本模組採用人類 2026-09-12 具名裁定的三段式，依據是 LOOP-NOTES 的
   「跟隨→改條件→回放並說出因果」：
     A＝現行 8 步導覽（tour.js，已出貨；本模組只唯讀其進度，不改它）
     B＝使用者自己改一個條件
     C＝回放比較並自述因果

   控制器的硬規則（機械化在 docs/audit-probes/atlas-tests.cjs）：
   - **只讀世界事實判定關卡**：讀 world.params／compartments／entities 與
     CSL.Main 的分支旗標，不掃事件流——applyCommand 在參數已等於目標值時
     不發事件（core.js），靠事件判定會在使用者本來就在目標值時永遠不觸發。
   - **不代使用者下指令**：本模組絕不呼叫 queueCommand／setParam。
   - **不判對錯**：第 C4 關的自述只收不評；學習成效要由人類的五人小樣本
     驗收認定（LOOP-NOTES 的 Gate D，尚未執行）。
   - **不按時間自動前進**：沒有 maxTicks、沒有牆上時間；關卡條件不成立就是
     不成立。
   - **進度不寫進 world**：與 observe.js 同樣的邊界——章節不是模型的一部分，
     不進 snapshot／exportRun／digest。
   - 不呼叫 Observe.onWorldInstalled()：切章不是換世界，清掉觀察歷史會讓
     章節 C 的回放比較當場變成一片缺資料。
   未動 unchanged-core 凍結七檔。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL = global.CSL || {};

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  const DEFAULTS = { lungSupply: 0.85, flowSpeed: 1.0, tissueDemand: 0.5, anemia: 0, temperature: 37.0, perfusion: 1.0, altitudeM: 0, fluidRate: 0, infection: 0, glucoseIntake: 0 };
  /* 這兩支滑桿與藥物預設才會建立 A/B 基線（js/loop/main.js）；
     提示語必須照實寫，不能說「任一次介入都會建立」。 */
  const BRANCHING_KEYS = ['lungSupply', 'anemia', 'altitudeM', 'fluidRate', 'infection', 'glucoseIntake'];

  /* 每個關卡是一個純述詞：吃 ctx 快照，回傳 true/false。
     ctx = { world, baseline, main: { branchA, activeIsA, seenA, expandedEventId, seenChain } } */
  const CHAPTERS = [
    {
      id: 'B',
      zh: '章節 B：自己改一個條件',
      goalZh: '由你自己下一次介入，並看著模型怎麼反應。控制器只判斷模型事實，不會替你動任何滑桿。',
      gates: [
        {
          id: 'B1',
          zh: '把任一個模型參數調離基準值（滑桿或藥物預設都可以）',
          test: (ctx) => {
            const p = (ctx.world && ctx.world.params) || {};
            return Object.keys(DEFAULTS).some((k) => typeof p[k] === 'number' && p[k] !== DEFAULTS[k]);
          },
        },
        {
          id: 'B2',
          zh: '讓組織庫存水位相對你進入本章時變化超過一個百分點',
          test: (ctx) => {
            if (!ctx.world || !ctx.baseline || ctx.baseline.tissueLevel == null) return false;
            const c = ctx.world.compartments && ctx.world.compartments.tissue;
            if (!c || !(c.capacity > 0)) return false;
            return Math.abs(c.stock / c.capacity - ctx.baseline.tissueLevel) > 0.01;
          },
        },
        {
          id: 'B3',
          zh: '再把那個參數調回基準值，看它會不會自己回來',
          test: (ctx) => {
            const p = (ctx.world && ctx.world.params) || {};
            const movedOnce = !!(ctx.baseline && ctx.baseline.everMoved);
            return movedOnce && Object.keys(DEFAULTS).every((k) => typeof p[k] === 'number' && p[k] === DEFAULTS[k]);
          },
        },
      ],
    },
    {
      id: 'C',
      zh: '章節 C：回放比較，並自己說出因果',
      goalZh: '用 A/B 兩側與事件記錄，自己把「誰造成誰」講出來。控制器不判定你說得對不對。',
      gates: [
        {
          id: 'C1',
          zh: '建立 A/B 基線分支（動「肺端供氧」、「貧血程度」、「海拔」、「補水速率」或「感染嚴重度」滑桿，或按任一個藥物預設）',
          test: (ctx) => !!(ctx.main && ctx.main.branchA),
        },
        {
          id: 'C2',
          zh: '切到 A 基線那一側看過一次',
          test: (ctx) => !!(ctx.main && ctx.main.seenA),
        },
        {
          id: 'C3',
          zh: '在事件記錄裡展開過一次因果鏈',
          test: (ctx) => !!(ctx.main && ctx.main.seenChain),
        },
        {
          id: 'C4',
          zh: '用一句話寫下你認為的因果（只收不評，不寫入模型、不進匯出包、不上傳）',
          test: (ctx) => !!(ctx.selfReport && String(ctx.selfReport).trim().length > 0),
        },
      ],
    },
  ];

  /* ---------- 純函式層：不碰 DOM、不寫世界 ---------- */

  /* 逐關評估。回傳每關的 met 與整章進度；不做任何副作用。 */
  function evaluate(chapterId, ctx) {
    const ch = CHAPTERS.find((x) => x.id === chapterId);
    if (!ch) return { chapterId, found: false, gates: [], met: 0, total: 0, complete: false };
    const gates = ch.gates.map((g) => ({ id: g.id, zh: g.zh, met: !!g.test(ctx) }));
    const met = gates.reduce((n, g) => n + (g.met ? 1 : 0), 0);
    return { chapterId, found: true, gates, met, total: gates.length, complete: met === gates.length };
  }

  /* 章節 A 的進度只唯讀 tour.js 的公開狀態；本模組不改 tour.js、不跳步。 */
  function chapterAProgress() {
    const T = CSL.Tour;
    if (!T) return { available: false, reason: 'no-tour', step: null, total: null, active: false };
    const total = (T.steps && T.steps.length) || 0;
    return {
      available: total > 0,
      reason: total > 0 ? null : 'not-started',
      step: total > 0 ? Math.min(T.idx + 1, total) : null,
      total: total || null,
      active: !!T.active,
    };
  }

  function render(vm) {
    const C = (k, zh) => (CSL.I18n && CSL.I18n.chapter ? CSL.I18n.chapter(k) : null) || zh;
    const a = vm.chapterA;
    const aLine = a.available
      ? esc(C('aProgress', '章節 A（跟隨導覽）：第 ') + a.step + C('aOf', ' / 共 ') + a.total + C('aStep', ' 步'))
      : esc(C('aNotStarted', '章節 A（跟隨導覽）：尚未開始——按「跟著一顆紅血球」即可走一次。'));
    const chapters = vm.chapters.map((ev) => {
      const ch = CHAPTERS.find((x) => x.id === ev.chapterId);
      const gates = ev.gates.map((g) =>
        '<li class="' + (g.met ? 'gateMet' : 'gateOpen') + '">'
        + esc(g.met ? C('doneMark', '✓ ') : C('openMark', '○ ')) + esc(C('gate.' + g.id, g.zh)) + '</li>').join('');
      return '<div class="chapBlock"><b>' + esc(C('chapter.' + ev.chapterId, ch.zh)) + '</b>'
        + '<span class="dim tiny"> ' + ev.met + '/' + ev.total + '</span>'
        + '<div class="dim tiny">' + esc(C('goal.' + ev.chapterId, ch.goalZh)) + '</div>'
        + '<ul class="gateList">' + gates + '</ul></div>';
    }).join('');
    return '<div class="learnBody"><h3>' + esc(C('title', '學習章節（關卡式）')) + '</h3>'
      + '<div class="dim tiny">' + aLine + '</div>'
      + chapters
      + '<label class="dim tiny" for="chapSelfReport">'
      + esc(C('selfReportLabel', '你的因果敘述（只收不評；重整即消失，不寫入模型、不進匯出包、不上傳）')) + '</label>'
      + '<textarea id="chapSelfReport" rows="2" class="chapInput"></textarea>'
      + '<div class="note">' + esc(C('noJudgement',
        '本章不判定你的說法對不對——判定學習成效需要人類的五人小樣本驗收，尚未執行。控制器也不會替你動任何滑桿。'))
      + '</div>'
      + '<button id="chapClose" class="btn2 tiny">' + esc(C('close', '關閉')) + '</button></div>';
  }

  /* ---------- 狀態與 DOM 層 ---------- */
  let openState = false;
  let baseline = null;      // 進入本控制器時的世界事實快照（模組內，不寫世界）
  let seenA = false;        // 是否切到過 A 側
  let seenChain = false;    // 是否展開過因果鏈
  let selfReport = '';      // 自述文字（不保存、不上傳）

  function _ctx() {
    const M = CSL.Main;
    const world = M ? M.world : null;
    return {
      world,
      baseline,
      selfReport,
      main: {
        branchA: M ? !!M.branchA : false,
        activeIsA: M ? !!M.activeIsA : false,
        seenA, seenChain,
        expandedEventId: M ? M._expandedEventId : null,
      },
    };
  }

  function _snapshotBaseline() {
    const M = CSL.Main;
    const w = M ? M.world : null;
    const c = w && w.compartments ? w.compartments.tissue : null;
    baseline = {
      tick: w ? w.tick : null,
      tissueLevel: c && c.capacity > 0 ? c.stock / c.capacity : null,
      everMoved: false,
    };
  }

  function viewModel() {
    const ctx = _ctx();
    return {
      chapterA: chapterAProgress(),
      chapters: CHAPTERS.map((ch) => evaluate(ch.id, ctx)),
      baseline,
    };
  }

  function _box() {
    let box = global.document.getElementById('learnModal');
    if (!box) {
      box = global.document.createElement('div');
      box.id = 'learnModal';
      box.className = 'modal hidden';
      box.innerHTML = '<div class="mbox" id="learnMbox"></div>';
      global.document.body.appendChild(box);
      box.addEventListener('click', (ev) => {
        if (ev.target === box || ev.target.id === 'chapClose') close();
      });
      box.addEventListener('input', (ev) => {
        if (ev.target && ev.target.id === 'chapSelfReport') selfReport = ev.target.value;
      });
      global.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && openState) close(); });
    }
    return box;
  }

  function _paint() {
    const box = _box();
    const focused = global.document.activeElement;
    const typing = focused && focused.id === 'chapSelfReport';
    if (typing) return;            // 使用者正在打字時不重繪，免得吃掉輸入
    box.firstElementChild.innerHTML = render(viewModel());
    const ta = global.document.getElementById('chapSelfReport');
    if (ta) ta.value = selfReport;
  }

  function open() { openState = true; if (!baseline) _snapshotBaseline(); _paint(); _box().classList.remove('hidden'); }
  function close() { openState = false; const b = global.document.getElementById('learnModal'); if (b) b.classList.add('hidden'); }
  function isOpen() { return openState; }

  /* 由主迴圈的 UI 節流呼叫：只更新旗標與畫面，絕不動世界。 */
  function tick() {
    const M = CSL.Main;
    if (M) {
      if (M.activeIsA) seenA = true;
      if (M._expandedEventId != null) seenChain = true;
      if (baseline && !baseline.everMoved && M.world && M.world.params) {
        const p = M.world.params;
        if (Object.keys(DEFAULTS).some((k) => typeof p[k] === 'number' && p[k] !== DEFAULTS[k])) baseline.everMoved = true;
      }
    }
    if (openState) _paint();
  }

  /* 匯入＝換世界：章節進度與自述歸零，但**不呼叫** Observe.onWorldInstalled()
     （那是觀察模組自己的事，且會清掉章節 C 要回放的歷史）。 */
  function onImport() { baseline = null; seenA = false; seenChain = false; selfReport = ''; close(); }

  CSL.Chapters = {
    CHAPTERS, DEFAULTS, BRANCHING_KEYS,
    evaluate, chapterAProgress, render, viewModel,
    open, close, tick, isOpen, onImport,
    _resetForTest() { baseline = null; seenA = false; seenChain = false; selfReport = ''; openState = false; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
