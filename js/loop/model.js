/* ============================================================
   CELLSCAPE v0.2 · Living Loop — model.js
   區域 / 循環邊 registry、供氧交換規則常數、幾何投影輔助。
   邊界：不讀 DOM、鏡頭或渲染狀態。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});

  /* ---------- 循環邊（拓樸：肺 → 左心 → 體循環 → 組織 → 右心 → 肺） ----------
     baseTicks：基準跨越時距（tick，模型時間步）；flowSpeed 參數等比縮放。
     exchange：該邊上發生的跨界交換（lung = 裝載；tissue = 卸載）。 */
  CSL.EDGES = [
    { id: 'PULM_ARTERY',   label: '肺動脈',     en: 'Pulmonary Artery',   baseTicks: 45, exchange: null },
    { id: 'LUNG_CAP',      label: '肺微血管',   en: 'Lung Capillary',     baseTicks: 75, exchange: 'lung' },
    { id: 'PULM_VEIN',     label: '肺靜脈',     en: 'Pulmonary Vein',     baseTicks: 45, exchange: null },
    { id: 'HEART_L',       label: '左心',       en: 'Left Heart',         baseTicks: 36, exchange: null },
    { id: 'ARTERY_SYS',    label: '體循環動脈', en: 'Systemic Artery',    baseTicks: 120, exchange: null },
    { id: 'TISSUE_CAP',    label: '組織微血管', en: 'Tissue Capillary',   baseTicks: 90, exchange: 'tissue', perfusionSite: 'primary' },
    { id: 'TISSUE_CAP_2',  label: '組織微血管（次要床）', en: 'Tissue Capillary (secondary)', baseTicks: 45, exchange: 'tissue', perfusionSite: 'secondary' },
    { id: 'VEIN_SYS',      label: '體循環靜脈', en: 'Systemic Vein',      baseTicks: 120, exchange: null },
    { id: 'HEART_R',       label: '右心',       en: 'Right Heart',        baseTicks: 36, exchange: null },
  ];
  /* 一圈總 tick（flowSpeed=1）：約 567 tick ≈ 18.9 模型秒 */

  /* ---------- 交換係數（明確模型單位；未經生理校準） ---------- */
  CSL.K_LUNG = 0.05;    // 肺端裝載係數：flux = K × max(0, 肺泡水位 − 負載) × 可用容量 × lungSupply
  CSL.K_TISSUE = 0.045; // 組織卸載係數：flux = K × max(0, 負載 − 組織水位) × demand
  CSL.K_USE = 0.09;     // 組織消耗係數：usage = K × (0.5 + tissueDemand) × 組織水位

  /* RBC 世代輪替（0.8.0／T-329 F3）：滿圈數退役並在肺端替換同槽新球。
     總量固定 48（C-model-48）；不是全身紅血球生命週期校準。 */
  CSL.RBC_MAX_LOOPS = 8;

  /* ---------- 位置輔助（初始撒佈用） ---------- */
  CSL.totalCycleTicks = function () {
    return CSL.EDGES.reduce((s, e) => s + e.baseTicks, 0);
  };
  CSL.edgeAtPos = function (pos) {
    let t = pos % CSL.totalCycleTicks();
    for (let i = 0; i < CSL.EDGES.length; i++) {
      if (t < CSL.EDGES[i].baseTicks) return { index: i, frac: t / CSL.EDGES[i].baseTicks };
      t -= CSL.EDGES[i].baseTicks;
    }
    return { index: 0, frac: 0 };
  };

  /* ---------- 追蹤輔助：實體的循環進度（0..1，全域） ---------- */
  CSL.entityGlobalProgress = function (w, e) {
    let before = 0;
    for (let i = 0; i < e.edge; i++) before += CSL.EDGES[i].baseTicks;
    const g = (before + e.s * CSL.EDGES[e.edge].baseTicks) / CSL.totalCycleTicks();
    return Math.min(1, Math.max(0, g));
  };

  /* ---------- 供氧現況快照（供渲染 / 檢閱讀取；唯讀投影） ---------- */
  CSL.readout = function (w) {
    const alv = w.compartments.alveolar, tis = w.compartments.tissue;
    let loadSum = 0;
    for (const k in w.entities) loadSum += w.entities[k].load;
    return {
      tick: w.tick,
      modelSeconds: +(w.tick * w.dt).toFixed(3),
      alveolarLevel: alv.stock / alv.capacity,
      tissueLevel: tis.stock / tis.capacity,
      meanLoad: loadSum / CSL.ENTITY_COUNT,
      params: { ...w.params },
      tissueLow: !!w._tissueLow,
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
