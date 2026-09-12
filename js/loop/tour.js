/* ============================================================
   CELLSCAPE v0.2 · Living Loop — tour.js
   導覽（director）：字幕由「已發生的模型事件」觸發；正式干預
   走 command 入口並標記來源 tour。可被使用者中斷。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});

  /* 導覽字幕 i18n（T-316 刀 D3）：EN 缺鍵一律退回繁中原句；不改步驟順序與指令。 */
  const T = (key, vars) => (CSL.I18n && CSL.I18n.tour ? CSL.I18n.tour(key, vars) : null);

  const EDGE = {};
  CSL.EDGES.forEach((e, i) => { EDGE[e.id] = i; });

  CSL.Tour = {
    active: false,
    steps: [],
    idx: 0,
    waited: 0,

    start(world, api, followedId) {
      this.world = world; this.api = api; this.followedId = followedId;
      this.active = true; this.idx = 0; this.waited = 0;
      this.steps = this._buildSteps(followedId);
      const st = this.steps[0];
      if (st) {
        if (st.cam) api.setCamera(st.cam);
        if (st.onEnter) st.onEnter(world, api);
        if (st.say) api.subtitle(st.say(), 4.5);   /* 第 0 步帶空 onEnter，原本的 else 讓字幕永不顯示 */
      }
    },
    stop() {
      this.active = false;
      if (this.api) this.api.subtitle(null);
    },

    /* ---------- 章節 A 導覽控制（T-329 刀 F1；解凍 tour.js） ----------
       跳步／回上一步／單步重播只改導覽指標與字幕／鏡頭；
       不虛構模型事件、不重放已完成的 onEnter 副作用（_tourLowed／
       _tourRestored）、不呼叫 queueCommand。單步重播＝重播本步說明。 */

    /* 進入第 n 步（0-based）。forward 且該步 onEnter 尚未跑過才觸發副作用。 */
    goto(n, api) {
      if (!this.active || !this.steps.length) return false;
      const a = api || this.api;
      const target = Math.max(0, Math.min(n | 0, this.steps.length - 1));
      const prev = this.idx;
      const st = this.steps[target];
      this.idx = target;
      this.waited = 0;
      if (st.cam && a) a.setCamera(st.cam);
      const side = st.onEnter;
      const already =
        (target === 4 && this.world && this.world._tourLowed === true) ||
        (target === 6 && this.world && this.world._tourRestored === true);
      if (side && target >= prev && !already && this.world && a) {
        side(this.world, a);
      } else if (st.say && a) {
        a.subtitle(st.say(), 4.5);
      } else if (st.sayOnMeet && a) {
        a.subtitle(st.sayOnMeet(), 4.5);
      }
      return true;
    },

    /* 跳到下一步：只前進指標，不宣稱 until 已成立（誠實：不發 sayOnMeet）。 */
    next(api) {
      if (!this.active) return false;
      if (this.idx >= this.steps.length - 1) return false;
      return this.goto(this.idx + 1, api);
    },

    prev(api) {
      if (!this.active || this.idx <= 0) return false;
      return this.goto(this.idx - 1, api);
    },

    /* 單步重播：重設等待計數並重播本步說明；不重跑 onEnter 副作用。 */
    replayStep(api) {
      if (!this.active) return false;
      const a = api || this.api;
      const st = this.steps[this.idx];
      if (!st || !a) return false;
      this.waited = 0;
      if (st.cam) a.setCamera(st.cam);
      if (st.say) a.subtitle(st.say(), 4.5);
      else if (st.sayOnMeet) a.subtitle(st.sayOnMeet(), 4.5);
      else a.subtitle((T('s' + this.idx + '.say') || ('重播第 ' + (this.idx + 1) + ' 步說明。')), 4);
      return true;
    },

    _buildSteps(followedId) {
      const id = followedId;
      const has = (w) => w.entities[id];
      return [
        { // 0 — 肺微血管進入
          cam: 'LUNG',
          until: (w) => has(w) && w.entities[id].edge === EDGE.LUNG_CAP,
          maxTicks: 5400,
          say: () => T('s0.say', { id }) || `跟隨開始：紅血球 #${id}。鏡頭來到肺微環境——等待它進入肺微血管。`,
          onEnter: (w) => {},
          sayOnMeet: () => T('s0.meet', { id }) || `紅血球 #${id} 進入肺微血管——氧從肺泡側裝載（通量 = 係數 × 驅動量 × 可用容量）。`,
        },
        { // 1 — 負載上升
          cam: null,
          until: (w) => has(w) && w.entities[id].load > 0.7,
          maxTicks: 2700,
          sayOnMeet: () => T('s1.meet') || `氧負載上升（模型欄位 load）——外觀色調隨負載變化，這是模型欄位的視覺映射。`,
        },
        { // 2 — 離開肺
          cam: 'OVERVIEW',
          until: (w) => has(w) && w.entities[id].edge !== EDGE.LUNG_CAP,
          maxTicks: 3600,
          sayOnMeet: () => T('s2.meet') || `離開肺部——經肺靜脈、左心進入體循環。世界時間延續，沒有重置。`,
        },
        { // 3 — 抵達組織
          cam: 'TISSUE',
          until: (w) => has(w) && w.entities[id].edge === EDGE.TISSUE_CAP,
          maxTicks: 7200,
          sayOnMeet: () => T('s3.meet') || `抵達組織微血管——氧卸載到組織庫存；組織細胞依需求參數取用（色階 = 組織氧庫存水位，模型欄位）。`,
        },
        { // 4 — 導覽介入：降低肺端供氧
          cam: null,
          until: (w) => w._tourLowed === true,
          maxTicks: 30,
          onEnter: (w, api) => {
            CSL.queueCommand(w, { kind: 'setParam', key: 'lungSupply', value: 0.12, source: 'tour' });
            w._tourLowed = true;
            api.enableBranch();
            api.subtitle(T('s4.enter') || '導覽介入：降低肺端供氧（此動作已寫入模型記錄，來源標記為 tour，可回放比較）。', 5);
          },
          say: () => null,
        },
        { // 5 — 等待下游差異（until 為 OR 條件：組織低水位「或」跟隨 RBC 低負載入肺；
          // 兩種觸發路徑各有對應事實，故結論字幕放到下一步，不在此預設成因）
          cam: 'OVERVIEW',
          until: (w) => w._tissueLow === true ||
            (has(w) && w.entities[id].edge === EDGE.LUNG_CAP && w.entities[id].load < 0.45),
          maxTicks: 3600,
          say: () => T('s5.say') || '介入生效中：肺端裝載減少——等待組織庫存反應（事件記錄可追溯）。',
        },
        { // 6 — 恢復
          cam: null,
          until: (w) => w._tourRestored === true,
          maxTicks: 30,
          onEnter: (w, api) => {
            CSL.queueCommand(w, { kind: 'setParam', key: 'lungSupply', value: 0.85, source: 'tour' });
            w._tourRestored = true;
            api.subtitle(T('s6.enter') || '恢復肺端供氧——模型回到基線條件（同一 run 內的參數歷史完整保留）。', 5);
          },
          say: () => null,
        },
        { // 7 — 完成
          cam: 'OVERVIEW',
          until: (w) => w.compartments.tissue.stock / w.compartments.tissue.capacity > 0.45,
          maxTicks: 5400,
          say: () => T('s7.say') || '恢復中……組織庫存回升。',
          sayOnMeet: () => T('s7.meet') || '旅程完成。你可以：按 A/B 比較「基線 vs 介入」、打開事件記錄追因果、或切到自由探索改參數。',
          ends: true,
        },
      ];
    },

    update(world, api) {
      if (!this.active) return;
      const st = this.steps[this.idx];
      if (!st) { this.active = false; return; }
      this.waited++;
      if (st.until(world)) {
        if (st.sayOnMeet) api.subtitle(st.sayOnMeet(this.world), 4.5);
        if (st.ends) { this.active = false; api.tourDone(); return; }
        this.idx++; this.waited = 0;
        const nxt = this.steps[this.idx];
        if (nxt) {
          if (nxt.cam) api.setCamera(nxt.cam);
          if (nxt.onEnter) nxt.onEnter(world, api);
          else if (nxt.say) api.subtitle(nxt.say(), 4.5);
          this.waited = 0;
        }
      } else if (this.waited > st.maxTicks) {
        // 逾時保底：跳過（導覽敘事不得虛構未發生的事件）
        this.idx++; this.waited = 0;
        if (st.ends) { this.active = false; api.tourDone(); return; }  // 結尾步逾時也要正常收幕
        if (st.sayOnMeet) api.subtitle(T('timeout') || '（等待逾時，跳到下一步——模型尚未出現該事件。）', 4);
        const nxt = this.steps[this.idx];
        if (nxt) {
          if (nxt.cam) api.setCamera(nxt.cam);
          if (nxt.onEnter) nxt.onEnter(world, api);
          else if (nxt.say) api.subtitle(nxt.say(), 4.5);
        }
      }
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
