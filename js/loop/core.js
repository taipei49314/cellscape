/* ============================================================
   CELLSCAPE v0.2 · Living Loop — core.js
   持續世界核心：RNG 雙流、固定時間步、世界 registry、
   快照 / digest / 匯出匯入。
   邊界：本檔與 model.js / replay.js 不得讀取 DOM、鏡頭或渲染狀態。
   （可在 Node VM 中執行，供契約探針使用）
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});

  /* ---------- 版本 ----------
     MODEL_VERSION 語義：交換方程式、規則、或**檢查點身分契約**（digest 正規化、
     匯入驗證範圍）變更必須升版——舊版本的執行包不得被靜默續用
     （MODEL_RULE_IDENTITY 契約）。
     0.2.2：digest 納入 eventSeq（DIGEST_SCOPE 修復）＋事件 kind 相依 payload
     深驗證。舊包之 digestChainTail 以舊正規化計算，無法跨版延續，故顯式拒絕。 */
  CSL.MODEL_VERSION = '0.10.0';  /* 0.10.0：生理縱深第一軸——海拔／吸入氧（T-347）。新增參數
     altitudeM（0–6000 m，預設 0）：氣壓比值 o2Press=(1−2.25577e-5·h)^5.25588（海平面=1）
     乘外部輸入項與肺端裝載驅動；CO₂ 排出項乘高地過度換氣因子 (1+0.6·(1−o2Press))
     ——模型指數近似，非個體生理。params 入 digest ⇒ 新參數即身分契約變更，升版後
     0.9.0 舊包匯入顯式拒絕。
     0.9.0：檢查點身分契約修補（T-343）——digest 實體序列納入
     e.loops：0.8.0 起 loops 影響未來演化（滿圈退役時機），未納入即「摘要相等」
     不再保證後續一致（實證：loops 0 vs 7 digest 相等）。digest 正規化變更屬
     MODEL_RULE_IDENTITY 身分契約，舊版執行包無法跨版延續，匯入顯式拒絕。
     0.8.0：RBC 世代輪替（T-329 刀 F3）——滿 RBC_MAX_LOOPS 圈退役，
     殘餘 load 記 expelled，同槽肺端替換；總量仍 48。
     0.7.0：拓樸版血流再分配（T-329 刀 F2）——EDGES 新增 TISSUE_CAP_2 次要組織床；
     perfusion≤1 時主床乘 perfusion、次床乘 max(0,1−perfusion)，合計名目血流≈1；perfusion>1 全給主床。1.0＝0.6.0 單床行為。
     0.6.0：新增 perfusion 參數（T-317 D4 血流再分配；只乘組織端卸載通量，1.0＝0.5.1 行為，
                                    守恆帳結構與 digest 正規化不變；參數界限新增一鍵，舊包依版本閘拒絕）。
                                    0.5.1：檢查點身分契約修復（T-316 刀 D2）——匯入驗證接受 co2BloodHigh 閾值事件、
                                    exportRun 帶出 co2High/lastCo2、CO₂ 閾值補上文件所述遲滯；交換方程式與守恆帳結構不變。
                                    0.5.0：新增 temperature 參數（T-303 體溫刀；O₂ 使用量乘 Q10 因子，守恆帳結構不變） */
  CSL.SCHEMA_VERSION = 1;
  CSL.DT = 1 / 30;                 // 固定模型時間步（模型秒／tick）

  /* ---------- RNG（可序列化狀態；模型與視覺各自獨立串流） ---------- */
  function Rng(seed) {
    this.s = seed >>> 0;
  }
  Rng.prototype.next = function () {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.getState = function () { return this.s; };
  Rng.prototype.setState = function (s) { this.s = s >>> 0; };
  CSL.Rng = Rng;

  /* ---------- digest：FNV-1a 32bit（對正規化模型狀態字串） ----------
     檢查點身分涵蓋「影響未來演化的全部狀態」：tick、參數、庫存、
     實體（含 cap）、待處理 command 佇列。 */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  const f6 = (x) => (typeof x === 'number' && isFinite(x)) ? x.toFixed(6) : String(x);

  /* ---------- 世界建立 ---------- */
  CSL.ENTITY_COUNT = 48;           // 固定模型實體數（抽樣代表，非全身總量）
  CSL.createWorld = function (opts) {
    opts = opts || {};
    const seed = (opts.seed >>> 0) || 0xC5CA1E5;
    const world = {
      modelVersion: CSL.MODEL_VERSION,
      schemaVersion: CSL.SCHEMA_VERSION,
      dt: CSL.DT,
      seed: seed,
      runId: opts.runId || ('run-' + seed.toString(16) + '-' + Date.now().toString(36)),
      branchOf: opts.branchOf || null,
      tick: 0,
      rng: new Rng(seed).getState(),          // 模型 RNG 狀態（唯一；視覺 RNG 在渲染層）
      params: { lungSupply: 0.85, flowSpeed: 1.0, tissueDemand: 0.5, anemia: 0, temperature: 37.0, perfusion: 1.0, altitudeM: 0 },
      entities: {},                            // id → {id, kind:'rbc', edge, s, load, cap, loops}
      compartments: {
        alveolar: { stock: 6.0, capacity: 40 }, // 肺泡側氧庫存（模型單位）
        tissue: { stock: 10.0, capacity: 25 },  // 組織氧庫存（模型單位）
      },
      ledger: { initialTotal: 0, input: 0, usage: 0, expelled: 0, lastCheckTick: -1, lastResidual: 0 },
      /* CO₂ 指數（0–1；0.4.0）：血液 CO₂ 相對量的聚合指標（非分子帳）。
         基準點 0.30＝預設參數下的穩態；生產隨 O₂ 使用量，排出隨肺端通氣。 */
      co2: { blood: 0.30, produced: 0, expelled: 0, retained: 0, lastCheckTick: -30, lastResidual: 0 },
      events: [], eventSeq: 1,
      actions: [],                             // 正式動作（command）記錄
      pendingCommands: [],                     // {tick, cmd}
      idSeq: 1,
      digestChain: [],                         // 每 tick 摘要（hex 字串）
      _tissueLow: false, _lastTissueLevel: null, _lastParamEvent: null,
      _co2High: false, _lastCo2: null,
      _fluxLung: 0, _fluxTissue: 0,
    };
    /* 初始實體：沿循環均勻撒佈（模型 RNG 僅用於初始抖動） */
    const rng = new Rng(seed);
    const N = CSL.ENTITY_COUNT;
    const totalTicks = CSL.totalCycleTicks();
    for (let i = 0; i < N; i++) {
      const pos = (i / N) * totalTicks + rng.next() * 2;
      const e = CSL.edgeAtPos(pos);
      const id = world.idSeq++;
      world.entities[id] = {
        id, kind: 'rbc', edge: e.index, s: e.frac,
        load: 0.12 + rng.next() * 0.06, cap: 1.0, loops: 0,
      };
    }
    CSL.ledgerReset(world);
    CSL.digestStep(world);
    return world;
  };

  /* ---------- 資訊匯總 ---------- */
  CSL.totalOxygen = function (w) {
    let t = w.compartments.alveolar.stock + w.compartments.tissue.stock;
    for (const k in w.entities) t += w.entities[k].load;
    return t;
  };
  CSL.ledgerReset = function (w) {
    w.ledger.initialTotal = CSL.totalOxygen(w);
    w.ledger.input = 0; w.ledger.usage = 0; w.ledger.expelled = 0;
    w.ledger.lastCheckTick = w.tick; w.ledger.lastResidual = 0;
  };
  CSL.ledgerResidual = function (w) {
    const current = CSL.totalOxygen(w);
    const L = w.ledger;
    return (L.initialTotal + L.input - L.usage - L.expelled) - current;
  };

  /* ---------- 事件 ---------- */
  CSL.emitEvent = function (w, ev) {
    const e = {
      eventId: w.eventSeq++,
      tick: w.tick,
      parentEventIds: ev.parentEventIds || [],
      kind: ev.kind,                       // handoff | command | threshold | tour | system
      source: ev.source || 'rule',         // rule | user | tour | demo
      regionId: ev.regionId || null,
      actorId: ev.actorId || null,
      targetId: ev.targetId || null,
      ruleId: ev.ruleId || null,
      before: ev.before, after: ev.after,
      note: ev.note || null,
    };
    w.events.push(e);
    if (w.events.length > 1000) w.events.splice(0, w.events.length - 1000); // 溯源環：保留最近 1000 筆
    return e;
  };

  /* ---------- command 入口（所有正式動作唯一入口；來源標記 user/tour/demo） ---------- */
  CSL.queueCommand = function (w, cmd) {
    w.pendingCommands.push({
      tick: w.tick + (cmd.delayTicks || 0),
      cmd: { kind: cmd.kind, key: cmd.key, value: cmd.value, source: cmd.source || 'user' },
    });
  };
  function applyCommand(w, entry) {
    const cmd = entry.cmd;
    if (cmd.kind === 'setParam') {
      const key = cmd.key;
      const limits = { lungSupply: [0, 1], tissueDemand: [0, 1], flowSpeed: [0.2, 3], anemia: [0, 0.9], temperature: [36, 41], perfusion: [0.2, 1.8], altitudeM: [0, 6000] };
      if (!(key in limits)) return;
      const v = Math.min(limits[key][1], Math.max(limits[key][0], Number(cmd.value)));
      const before = w.params[key];
      if (before === v) return;
      w.params[key] = v;
      const ev = CSL.emitEvent(w, {
        kind: 'command', source: cmd.source, ruleId: 'setParam',
        before: { key, value: before }, after: { key, value: v },
        note: 'param',
      });
      w.actions.push({ tick: w.tick, kind: 'setParam', key, value: v, source: cmd.source, eventId: ev.eventId });
      // 記錄此 command 的 eventId，供下游 threshold 事件引用父鏈
      w._lastParamEvent = { key, eventId: ev.eventId };
    }
  }

  /* ---------- digest ---------- */
  CSL.digest = function (w) {
    /* 檢查點身分涵蓋影響未來演化的全部狀態：閾值旗標與其水位
       （DIGEST_EVENT_STATE_COVERAGE 契約）、以及事件序列配號 eventSeq——
       事件流分歧（多發一筆事件）即改變未來配號 ⇒ 摘要必須分歧
       （DIGEST_SCOPE 修復：摘要相等須保證後續配號一致）。 */
    let s = w.tick + '|' + JSON.stringify(w.params) + '|' +
      f6(w.compartments.alveolar.stock) + '|' + f6(w.compartments.alveolar.capacity) + '|' +
      f6(w.compartments.tissue.stock) + '|' + f6(w.compartments.tissue.capacity) + '|' +
      (w._tissueLow ? 1 : 0) + '|' + f6(w._lastTissueLevel == null ? -1 : w._lastTissueLevel) + '|' +
      (w._co2High ? 1 : 0) + '|' + f6(w._lastCo2 == null ? -1 : w._lastCo2) + '|' +
      f6(w.co2.blood) + '|' + f6(w.co2.produced) + '|' + f6(w.co2.expelled) + '|' + f6(w.co2.retained) + '|' +
      (w._lastParamEvent ? w._lastParamEvent.eventId : 0) + '|' +
      w.eventSeq + '|' +
      JSON.stringify(w.pendingCommands) + '|';
    const ids = Object.keys(w.entities).map(Number).sort((a, b) => a - b);
    for (const id of ids) {
      const e = w.entities[id];
      /* e.loops 必須入摘要（0.9.0）：影響退役時機 ⇒ 影響未來演化 */
      s += id + ':' + e.edge + ':' + f6(e.s) + ':' + f6(e.load) + ':' + f6(e.cap) + ':' + e.loops + ';' ;
    }
    return fnv1a(s);
  };
  CSL.digestStep = function (w) { w.digestChain.push(CSL.digest(w)); };

  /* ---------- 單一模型 tick（唯一更新入口；固定時間步） ---------- */
  CSL.step = function (w) {
    w.tick++;
    /* 1) 到期的 command */
    if (w.pendingCommands.length) {
      const due = w.pendingCommands.filter((p) => p.tick <= w.tick);
      if (due.length) {
        w.pendingCommands = w.pendingCommands.filter((p) => p.tick > w.tick);
        for (const d of due) applyCommand(w, d);
      }
    }
    /* 2) 外部輸入（肺端供氧條件 → 肺泡庫存；超出容量 = 外部輸出/呼出）
       海拔（0.10.0）：氣壓比值 o2Press 乘輸入驅動——吸入氧隨氣壓下降（模型近似）。 */
    const o2Press = Math.pow(1 - 2.25577e-5 * w.params.altitudeM, 5.25588);
    const alv = w.compartments.alveolar;
    const input = w.params.lungSupply * 0.08 * o2Press;
    alv.stock += input;
    w.ledger.input += input;
    if (alv.stock > alv.capacity) {
      const expelled = alv.stock - alv.capacity;
      alv.stock = alv.capacity;
      w.ledger.expelled += expelled;
    }
    /* 3) 實體推進 + 跨界交換
       離散時間邊界契約：移交發生在 tick 內；移交後「同一 tick」的交換
       以**抵達後的邊**為準（稽核契約 HANDOFF_EXCHANGE_BOUNDARY）。 */
    const flow = w.params.flowSpeed;
    w._fluxLung = 0; w._fluxTissue = 0;
    for (const k in w.entities) {
      const e = w.entities[k];
      const startEdge = CSL.EDGES[e.edge];
      e.s += (1 / startEdge.baseTicks) * flow;   // 每 tick 進度 = 1/基準跨越時距 × 流速參數
      if (e.s >= 1) {
        const fromEdge = e.edge;
        e.edge = (e.edge + 1) % CSL.EDGES.length;
        e.s -= 1;
        if (e.edge === 0) e.loops++;
        CSL.emitEvent(w, {
          kind: 'handoff', actorId: e.id,
          regionId: CSL.EDGES[e.edge].id,        // 抵達邊（事件的地區欄位）
          before: { edge: fromEdge, s: e.s + 1 }, after: { edge: e.edge, s: e.s },
        });
      }
      /* 4) 交換——以「當前（移交後）邊」為準；係數為零 ⇒ 通量為零 */
      const curEdge = CSL.EDGES[e.edge];
      if (curEdge.exchange === 'lung') {
        const level = alv.stock / alv.capacity;
        /* 貧血（T-303）：可用 Hb 上限 = 1 − anemia，只閘肺端裝載；
           不回溯調整既有負載（已攜帶者照常在組織卸載），守恆帳結構不變。 */
        const eCap = (1 - w.params.anemia) * e.cap;
        const avail = eCap - e.load;
        let flux = Math.min(
          CSL.K_LUNG * Math.max(0, level - e.load) * w.params.lungSupply * o2Press,
          alv.stock, Math.max(0, avail)
        );
        alv.stock -= flux; e.load += flux;
        w._fluxLung += flux;
      } else if (curEdge.exchange === 'tissue') {
        const tis = w.compartments.tissue;
        const level = tis.stock / tis.capacity;
        const demand = 0.5 + w.params.tissueDemand;
        /* Bohr 效應近似（0.4.0）：血中 CO₂ 高 ⇒ 卸載更容易（曲線右移）；
           倍率鉗位 [0.75, 1.35]，0.30 穩態時＝1（與 0.3.0 行為一致）。 */
        const bohr = Math.min(1.35, Math.max(0.75, 1 + 0.8 * (w.co2.blood - 0.30)));
        /* 血流再分配（0.6.0 單床；0.7.0 拓樸雙床）：
           perfusion≤1：主床×perfusion、次床×max(0,1−perfusion)，名目合計≈1；
           perfusion>1：全給主床。不是 mmHg、不是心輸出量。 */
        const site = (CSL.EDGES[e.edge] && CSL.EDGES[e.edge].perfusionSite) || 'primary';
        const pMul = site === 'secondary'
          ? Math.max(0, 1 - w.params.perfusion)
          : w.params.perfusion;
        let flux = Math.min(
          CSL.K_TISSUE * Math.max(0, e.load - level) * demand * bohr * pMul,
          e.load, Math.max(0, tis.capacity - tis.stock)
        );
        e.load -= flux; tis.stock += flux;
        w._fluxTissue += flux;
      }
      /* 3.5) RBC 世代輪替（0.8.0／T-329 F3）：滿圈數退役，同槽在肺端替換。
         殘餘 load 記 ledger.expelled（離開抽樣體）——不憑空消失、不偽造使用。 */
      if (e.loops >= CSL.RBC_MAX_LOOPS) {
        const residual = e.load;
        const lungIdx = CSL.EDGES.findIndex((ed) => ed.id === 'LUNG_CAP');
        CSL.emitEvent(w, {
          kind: 'rbc_retire', actorId: e.id,
          regionId: CSL.EDGES[e.edge].id,
          before: { load: e.load, loops: e.loops, edge: e.edge },
          after: { load: 0.12, loops: 0, edge: lungIdx < 0 ? 0 : lungIdx },
          note: 'retire-replace',
        });
        w.ledger.expelled += residual;
        e.edge = lungIdx < 0 ? 0 : lungIdx;
        e.s = 0;
        e.load = 0.12;
        e.loops = 0;
      }
    }
    /* 5) 組織使用（由庫存水位與需求參數決定；無庫存即無使用——不得偽造消耗） */
    const tis = w.compartments.tissue;
    const tLevel = tis.stock / tis.capacity;
    /* 體溫（0.5.0）：O₂ 使用量乘 Q10 因子（2^((T−37)/10)）；37°C＝1（與 0.4.0 行為一致）。
       CO₂ 生產隨使用量自動連動（Bohr 同向反應）。 */
    const q10 = Math.pow(2, (w.params.temperature - 37) / 10);
    const usage = Math.min(tis.stock, CSL.K_USE * (0.5 + w.params.tissueDemand) * tLevel * q10);
    tis.stock -= usage;
    w.ledger.usage += usage;

    /* 5.5) CO₂ 指數（0.4.0）：組織隨 O₂ 使用量生產（呼吸商 0.8、尺度 4），
       肺端隨通氣排出；0.30 為預設參數穩態。數值只影響 Bohr 卸載倍率與閾值
       事件——不進入 O₂ 守恆帳。上限鉗位時差額記入 retained（保留於組織端，
       未建模其返回）。 */
    {
      const inUnits = usage * 0.8 * 4;
      /* 高地過度換氣（0.10.0）：通氣隨海拔上升 ⇒ CO₂ 排出加速（模型指數；鉗位 ≤1.6 倍）。 */
      const vent = 1 + 0.6 * (1 - o2Press);
      const outUnits = w.co2.blood * 0.34 * w.params.lungSupply * vent;
      w.co2.blood += inUnits - outUnits;
      w.co2.produced += inUnits;
      w.co2.expelled += outUnits;
      if (w.co2.blood > 1) { w.co2.retained += w.co2.blood - 1; w.co2.blood = 1; }
      if (w.co2.blood < 0) w.co2.blood = 0;
    }

    /* 6) 閾值事件（下游差異可追溯至引起參數變更的 command） */
    const low = tLevel < 0.25;
    if (low && !w._tissueLow) {
      CSL.emitEvent(w, {
        kind: 'threshold', regionId: 'TISSUE_CAP', ruleId: 'tissueStockLow',
        before: { level: w._lastTissueLevel == null ? null : f6(w._lastTissueLevel) },
        after: { level: f6(tLevel) },
        parentEventIds: w._lastParamEvent && w._lastParamEvent.key === 'lungSupply' ? [w._lastParamEvent.eventId] : [],
        note: 'tissue-low',
      });
    }
    w._tissueLow = low;
    w._lastTissueLevel = tLevel;

    /* CO₂ 閾值（遲滯：≥0.70 觸發、<0.60 解除）——模型指數警示，非臨床判讀 */
    const co2High = w._co2High ? w.co2.blood >= 0.60 : w.co2.blood >= 0.70;
    if (co2High && !w._co2High) {
      CSL.emitEvent(w, {
        kind: 'threshold', regionId: 'TISSUE_CAP', ruleId: 'co2BloodHigh',
        before: { level: w._lastCo2 == null ? null : f6(w._lastCo2) },
        after: { level: f6(w.co2.blood) },
        note: 'co2-high',
      });
    }
    w._co2High = co2High;
    w._lastCo2 = w.co2.blood;

    /* CO₂ 帳檢查（每 30 tick）：生產 − 排出 − 保留 ＝ 血中指數變化量 */
    if (w.tick - w.co2.lastCheckTick >= 30) {
      const cres = w.co2.produced - w.co2.expelled - w.co2.retained - (w.co2.blood - 0.30);
      w.co2.lastResidual = cres;
      w.co2.lastCheckTick = w.tick;
    }

    /* 7) 守恆檢查（每 30 tick；殘差超出容差即為失敗，不得以截斷掩蓋） */
    if (w.tick - w.ledger.lastCheckTick >= 30) {
      const res = CSL.ledgerResidual(w);
      w.ledger.lastResidual = res;
      w.ledger.lastCheckTick = w.tick;
      if (Math.abs(res) > 1e-6 * Math.max(1, CSL.totalOxygen(w))) {
        CSL.emitEvent(w, { kind: 'system', ruleId: 'ledgerViolation', note: f6(res) });
      }
    }
    /* 8) 摘要 */
    CSL.digestStep(w);
    return w;
  };

  /* ---------- 快照（完整：含事件尾與閾值旗標——續行不得重複或遺漏事件） ---------- */
  CSL.snapshot = function (w) {
    return JSON.parse(JSON.stringify({
      modelVersion: w.modelVersion, schemaVersion: w.schemaVersion, dt: w.dt,
      seed: w.seed, runId: w.runId, branchOf: w.branchOf,
      tick: w.tick, rng: w.rng, params: w.params,
      entities: w.entities, compartments: w.compartments,
      ledger: w.ledger, actions: w.actions,
      co2: w.co2,
      events: w.events, eventSeq: w.eventSeq,
      pendingCommands: w.pendingCommands, idSeq: w.idSeq,
      tissueLow: !!w._tissueLow, lastTissueLevel: w._lastTissueLevel == null ? null : w._lastTissueLevel,
      co2High: !!w._co2High, lastCo2: w._lastCo2 == null ? null : w._lastCo2,
      lastParamEvent: w._lastParamEvent || null,
      digestChainTail: w.digestChain.slice(-64),
    }));
  };
  const PARAM_LIMITS = { lungSupply: [0, 1], tissueDemand: [0, 1], flowSpeed: [0.2, 3], anemia: [0, 0.9], temperature: [36, 41], perfusion: [0.2, 1.8], altitudeM: [0, 6000] };
  CSL.PARAM_LIMITS = PARAM_LIMITS;
  const isFinNum = (v) => typeof v === 'number' && isFinite(v);

  CSL.validateSnapshot = function (snap) {
    if (!snap || typeof snap !== 'object') return 'not-an-object';
    if (snap.modelVersion !== CSL.MODEL_VERSION) return 'model-version-mismatch: ' + snap.modelVersion;
    if (snap.schemaVersion !== CSL.SCHEMA_VERSION) return 'schema-version-mismatch: ' + snap.schemaVersion;
    if (snap.dt !== CSL.DT) return 'dt-mismatch: ' + snap.dt;
    if (typeof snap.tick !== 'number' || snap.tick < 0 || !Number.isInteger(snap.tick)) return 'bad-tick';
    if (!isFinNum(snap.rng)) return 'bad-rng-state';
    if (!snap.co2 || !isFinNum(snap.co2.blood) || snap.co2.blood < 0 || snap.co2.blood > 1) return 'bad-co2';
    for (const k of ['produced', 'expelled', 'retained']) if (!isFinNum(snap.co2[k])) return 'bad-co2: ' + k;
    /* 參數：存在、有限、於宣告界限內 */
    if (!snap.params || typeof snap.params !== 'object') return 'bad-params';
    for (const key in PARAM_LIMITS) {
      const v = snap.params[key];
      if (!isFinNum(v) || v < PARAM_LIMITS[key][0] || v > PARAM_LIMITS[key][1]) return 'bad-param: ' + key;
    }
    /* 庫存：有限、非負、容量為正、存量不超過容量 */
    for (const key of ['alveolar', 'tissue']) {
      const c = snap.compartments && snap.compartments[key];
      if (!c || !isFinNum(c.stock) || !isFinNum(c.capacity)) return 'bad-compartment: ' + key;
      if (c.stock < 0 || c.capacity <= 0) return 'bad-compartment-range: ' + key;
      if (c.stock > c.capacity + 1e-9) return 'stock-exceeds-capacity: ' + key;
    }
    /* 實體：數量固定、欄位有限且於界內、ID 唯一 */
    if (!snap.entities || typeof snap.entities !== 'object') return 'bad-entities';
    const ids = Object.keys(snap.entities);
    if (ids.length !== CSL.ENTITY_COUNT) return 'entity-count-mismatch: ' + ids.length;
    const nEdges = CSL.EDGES.length;
    const seenIds = new Set();
    for (const k of ids) {
      const e = snap.entities[k];
      if (!e || e.kind !== 'rbc') return 'bad-entity-kind: ' + k;
      if (!Number.isInteger(e.id) || e.id <= 0) return 'bad-entity-id: ' + k;
      if (seenIds.has(e.id)) return 'duplicate-entity-id: ' + e.id;   // 身分唯一契約
      seenIds.add(e.id);
      if (!Number.isInteger(e.edge) || e.edge < 0 || e.edge >= nEdges) return 'bad-edge: ' + k;
      if (!isFinNum(e.s) || e.s < 0 || e.s >= 1) return 'bad-s: ' + k;
      if (!isFinNum(e.cap) || e.cap <= 0) return 'bad-cap: ' + k;
      if (!isFinNum(e.load) || e.load < 0 || e.load > e.cap + 1e-9) return 'bad-load: ' + k;
      if (!Number.isInteger(e.loops) || e.loops < 0) return 'bad-loops: ' + k;
    }
    /* 帳本：欄位齊、有限、非負 */
    const L = snap.ledger;
    if (!L) return 'missing-ledger';
    for (const key of ['initialTotal', 'input', 'usage', 'expelled', 'lastCheckTick', 'lastResidual']) {
      if (!isFinNum(L[key]) || (key !== 'lastResidual' && key !== 'lastCheckTick' && L[key] < 0)) return 'bad-ledger: ' + key;
    }
    /* 動作與待處理 command */
    if (!Array.isArray(snap.actions)) return 'bad-actions';
    if (!Array.isArray(snap.pendingCommands)) return 'bad-pending';
    for (const p of snap.pendingCommands) {
      if (!p || !Number.isInteger(p.tick) || p.tick < 0) return 'bad-pending-tick';
      if (!p.cmd || p.cmd.kind !== 'setParam' || !(p.cmd.key in PARAM_LIMITS)) return 'bad-pending-cmd';
      if (!isFinNum(p.cmd.value)) return 'bad-pending-value';
    }
    if (!Number.isInteger(snap.idSeq) || !Number.isInteger(snap.eventSeq)) return 'bad-seq';
    if (snap.events !== undefined) {
      if (!Array.isArray(snap.events)) return 'bad-events';
      if (snap.events.length > 1000) return 'events-exceed-cap';
      const nEdges = CSL.EDGES.length;
      const seenEv = new Set();
      let maxEventId = 0;
      /* kind 相依 payload 檢查（欄位形狀與產生端 emitEvent 一致）：
         command → before/after {key∈PARAM_LIMITS, value 有限數}；
         handoff → actorId 正整數、regionId 字串、before/after {edge 界內整數, s 有限}；
         threshold → ruleId 固定、before.level null|數值字串、after.level 數值字串。
         缺口實例（稽核 IMPORTED_COMMAND_NULL_AFTER）：command 事件 after:null
         曾被接受，UI 渲染即拋 TypeError——現為顯式拒絕。 */
      const cmdPayload = (o) => o && typeof o === 'object' &&
        typeof o.key === 'string' && o.key in PARAM_LIMITS && isFinNum(o.value);
      const handPayload = (o) => o && typeof o === 'object' &&
        Number.isInteger(o.edge) && o.edge >= 0 && o.edge < nEdges && isFinNum(o.s);
      const lvlStr = (v) => typeof v === 'string' && isFinite(parseFloat(v));
      const thrPayload = (o, strictStr) => o && typeof o === 'object' &&
        (o.level === null || lvlStr(o.level)) && (!strictStr || lvlStr(o.level));
      for (const ev of snap.events) {
        if (!ev || typeof ev !== 'object') return 'bad-event-entry';
        if (!Number.isInteger(ev.eventId) || ev.eventId <= 0) return 'bad-event-id';
        if (seenEv.has(ev.eventId)) return 'duplicate-event-id: ' + ev.eventId;
        seenEv.add(ev.eventId);
        if (ev.eventId > maxEventId) maxEventId = ev.eventId;
        if (!Number.isInteger(ev.tick) || ev.tick < 0 || ev.tick > snap.tick) return 'bad-event-tick';
        if (typeof ev.kind !== 'string') return 'bad-event-kind';
        if (ev.parentEventIds !== undefined) {
          if (!Array.isArray(ev.parentEventIds)) return 'bad-event-parents';
          for (const p of ev.parentEventIds)
            if (!Number.isInteger(p) || p <= 0) return 'bad-event-parent';
        }
        if (ev.regionId !== undefined && ev.regionId !== null && typeof ev.regionId !== 'string') return 'bad-event-region';
        if (ev.ruleId !== undefined && ev.ruleId !== null && typeof ev.ruleId !== 'string') return 'bad-event-rule';
        if (ev.note !== undefined && ev.note !== null && typeof ev.note !== 'string') return 'bad-event-note';
        if (ev.kind === 'command') {
          if (ev.ruleId !== 'setParam') return 'bad-event-rule';
          if (!cmdPayload(ev.before) || !cmdPayload(ev.after)) return 'bad-event-payload';
        } else if (ev.kind === 'handoff') {
          if (!Number.isInteger(ev.actorId) || ev.actorId <= 0) return 'bad-event-actor';
          if (typeof ev.regionId !== 'string') return 'bad-event-region';
          if (!handPayload(ev.before) || !handPayload(ev.after)) return 'bad-event-payload';
        } else if (ev.kind === 'threshold') {
          if (ev.ruleId !== 'tissueStockLow' && ev.ruleId !== 'co2BloodHigh') return 'bad-event-rule';
          if (!thrPayload(ev.before, false) || !thrPayload(ev.after, true)) return 'bad-event-payload';
        } else if (ev.kind !== 'system' && ev.kind !== 'tour') {
          return 'bad-event-kind';
        }
      }
      /* 配號一致性：環內最大 eventId 必須落後 eventSeq（產生端 eventSeq 單調遞增） */
      if (maxEventId >= snap.eventSeq) return 'event-seq-behind';
    }
    return null;
  };
  CSL.restore = function (w, snap) {
    const v = CSL.validateSnapshot(snap);
    if (v !== null) throw new Error('SNAPSHOT_REJECTED: ' + v);
    w.modelVersion = snap.modelVersion; w.schemaVersion = snap.schemaVersion;
    w.dt = snap.dt; w.seed = snap.seed; w.tick = snap.tick;
    w.rng = snap.rng; w.params = snap.params;
    w.entities = snap.entities; w.compartments = snap.compartments;
    w.ledger = snap.ledger; w.actions = snap.actions;
    w.co2 = snap.co2 || { blood: 0.30, produced: 0, expelled: 0, retained: 0, lastCheckTick: -30, lastResidual: 0 };
    w._co2High = !!snap.co2High;
    w._lastCo2 = snap.lastCo2 === undefined ? null : snap.lastCo2;
    w.pendingCommands = snap.pendingCommands || [];
    w.idSeq = snap.idSeq; w.eventSeq = snap.eventSeq;
    if (snap.events) w.events = snap.events;
    w._tissueLow = !!snap.tissueLow;
    w._lastTissueLevel = snap.lastTissueLevel === undefined ? null : snap.lastTissueLevel;
    w._lastParamEvent = snap.lastParamEvent || null;
    w.digestChain = (snap.digestChainTail || []).slice();
    return w;
  };

  /* ---------- run 匯出 / 匯入（JSON；schema + rules 深驗證，無 eval） ---------- */
  CSL.exportRun = function (w) {
    return JSON.stringify({
      kind: 'cellscape-living-loop-run',
      modelVersion: w.modelVersion,
      schemaVersion: CSL.SCHEMA_VERSION,
      runId: w.runId, branchOf: w.branchOf,
      seed: w.seed, dt: CSL.DT,
      tick: w.tick, rng: w.rng, params: w.params,
      rulesSummary: {
        edges: CSL.EDGES.map((e) => ({ id: e.id, baseTicks: e.baseTicks, exchange: e.exchange || null })),
        constants: { K_LUNG: CSL.K_LUNG, K_TISSUE: CSL.K_TISSUE, K_USE: CSL.K_USE, ENTITY_COUNT: CSL.ENTITY_COUNT },
      },
      entities: w.entities,
      compartments: w.compartments,
      co2: w.co2,
      ledger: w.ledger,
      actions: w.actions,
      events: w.events,
      pendingCommands: w.pendingCommands,
      idSeq: w.idSeq, eventSeq: w.eventSeq,
      tissueLow: !!w._tissueLow,
      lastTissueLevel: w._lastTissueLevel == null ? null : w._lastTissueLevel,
      co2High: !!w._co2High,
      lastCo2: w._lastCo2 == null ? null : w._lastCo2,
      lastParamEvent: w._lastParamEvent || null,
      digestChainTail: w.digestChain.slice(-256),
    });
  };
  CSL.importRun = function (jsonText) {
    let obj;
    try { obj = JSON.parse(jsonText); } catch (e) { throw new Error('IMPORT_REJECTED: invalid-json'); }
    if (!obj || obj.kind !== 'cellscape-living-loop-run') throw new Error('IMPORT_REJECTED: wrong-kind');
    if (obj.modelVersion !== CSL.MODEL_VERSION) throw new Error('IMPORT_REJECTED: model-version-mismatch (' + obj.modelVersion + ')');
    if (obj.schemaVersion !== CSL.SCHEMA_VERSION) throw new Error('IMPORT_REJECTED: schema-version-mismatch (' + obj.schemaVersion + ')');
    /* rules 契約比對：edges 與常數必須與當前實作一致，否則數值語義不同 */
    const rs = obj.rulesSummary;
    if (!rs || !Array.isArray(rs.edges) || rs.edges.length !== CSL.EDGES.length) throw new Error('IMPORT_REJECTED: rules-mismatch');
    for (let i = 0; i < rs.edges.length; i++) {
      const a = rs.edges[i], b = CSL.EDGES[i];
      if (a.id !== b.id || a.baseTicks !== b.baseTicks || (a.exchange || null) !== (b.exchange || null))
        throw new Error('IMPORT_REJECTED: rules-mismatch (edge ' + i + ')');
    }
    if (!rs.constants || rs.constants.K_LUNG !== CSL.K_LUNG || rs.constants.K_TISSUE !== CSL.K_TISSUE ||
        rs.constants.K_USE !== CSL.K_USE || rs.constants.ENTITY_COUNT !== CSL.ENTITY_COUNT)
      throw new Error('IMPORT_REJECTED: rules-mismatch (constants)');
    const w = CSL.createWorld({ seed: obj.seed, runId: obj.runId, branchOf: obj.branchOf || null });
    CSL.restore(w, obj);
    return w;
  };
})(typeof window !== 'undefined' ? window : globalThis);
