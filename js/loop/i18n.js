/* ============================================================
   CELLSCAPE Living Atlas — i18n.js（T-299 刀 C3）
   語言切換的狀態與存取器：locale 存 localStorage（'csl-locale'），
   預設 'zh'。EN 來源為 CSL.ContentEN（平行翻譯層）。
   鐵則：缺鍵一律退回 content.js 繁中原值——不猜譯、不空白、
   不把「未翻譯」冒充「已翻譯」；tour.js 字幕屬凍結檔，維持繁中。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});
  const KEY = 'csl-locale';
  const LOCALES = ['zh', 'en'];

  function get() {
    let v = null;
    try { v = global.localStorage && global.localStorage.getItem(KEY); } catch (e) { /* 隱私模式等：退回預設 */ }
    return LOCALES.indexOf(v) >= 0 ? v : 'zh';
  }

  function set(loc) {
    if (LOCALES.indexOf(loc) < 0) return get();
    try { global.localStorage.setItem(KEY, loc); } catch (e) { /* 同上 */ }
    return loc;
  }

  function toggle() { return set(get() === 'zh' ? 'en' : 'zh'); }

  const en = () => (global.CSL.ContentEN || null);

  /* 角色卡在地化視圖：EN 缺鍵時逐欄退回 zh 原值 */
  function card(cardId) {
    const card = CSL.Content.cards.find((c) => c.id === cardId) || {};
    const E = en() && en().cards && en().cards[cardId];
    const isEn = get() === 'en' && E;
    return {
      id: cardId,
      name: isEn ? (card.en || card.name) : card.name,
      headline: (isEn && E.headline) || card.headline,
      keyPoints: (isEn && E.keyPoints) || card.keyPoints || [],
      capabilityNote: (isEn && E.capabilityNote) || card.capabilityNote,
      qa: (isEn && E.qa)
        ? card.qa.map((qa, i) => (E.qa[i] ? { q: E.qa[i].q || qa.q, a: E.qa[i].a || qa.a, claimIds: qa.claimIds } : qa))
        : card.qa
    };
  }

  function claimText(cid) {
    const c = CSL.Content.claims[cid];
    if (!c) return null;
    const E = en() && en().claims;
    return (get() === 'en' && E && E[cid]) ? E[cid] : c.text;
  }

  function readout(id) {
    const r = CSL.Content.readouts.find((x) => x.id === id) || {};
    const E = en() && en().readouts && en().readouts[id];
    const isEn = get() === 'en' && E;
    return { name: (isEn && E.name) || r.name, note: (isEn && E.note) || r.note };
  }

  function cap(capId) {
    const legend = CSL.Content.capabilityLegend.find((l) => l.id === capId);
    const E = en() && en().capabilityLegend && en().capabilityLegend[capId];
    const isEn = get() === 'en' && E;
    return {
      label: (isEn && E.label) || (legend ? legend.label : capId),
      note: (isEn && E.note) || (legend ? legend.note : '')
    };
  }

  function shell(key) {
    const E = en() && en().shell;
    return (get() === 'en' && E && E[key]) || null; /* EN only；殼層 zh 即 HTML 原文 */
  }

  const isEn = () => get() === 'en';

  /* 「看此刻」散文模板：EN 缺鍵回 null（呼叫端退回繁中原句） */
  function now(key, vars) {
    const E = en() && en().now;
    if (!(get() === 'en' && E && E[key])) return null;
    let s = E[key];
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }

  /* 導覽字幕（T-316 刀 D3）：EN 缺鍵回 null，tour.js 退回繁中原句——
     不猜譯、不空白；導覽流程與步驟順序不因語言改變。 */
  function tour(key, vars) {
    const E = en() && en().tour;
    if (!(get() === 'en' && E && E[key])) return null;
    let s = E[key];
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }

  /* 把 data-i18n 元素換成 EN；切回 zh 時以 data-i18n-zh 還原。
     data-i18n-placeholder 元素改 placeholder 屬性（同樣記 zh 原值）。 */
  function applyShell(root) {
    if (!global.document) return;
    (root || global.document).querySelectorAll('[data-i18n]').forEach((el) => {
      const k = el.getAttribute('data-i18n');
      if (!el.getAttribute('data-i18n-zh')) el.setAttribute('data-i18n-zh', el.textContent);
      if (get() === 'en') {
        const E = en() && en().shell;
        if (E && E[k]) el.textContent = E[k];
      } else {
        el.textContent = el.getAttribute('data-i18n-zh');
      }
    });
    (root || global.document).querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const k = el.getAttribute('data-i18n-placeholder');
      if (!el.getAttribute('data-i18n-placeholder-zh')) el.setAttribute('data-i18n-placeholder-zh', el.getAttribute('placeholder') || '');
      if (get() === 'en') {
        const E = en() && en().shell;
        if (E && E[k]) el.setAttribute('placeholder', E[k]);
      } else {
        el.setAttribute('placeholder', el.getAttribute('data-i18n-placeholder-zh'));
      }
    });
  }

  /* 血紅素放大視角字串（T-321 刀 K1）：EN 缺鍵回 null，呼叫端退回繁中 */
  function hemo(key, vars) {
    const E = en() && en().hemo;
    if (!(get() === 'en' && E && E[key])) return null;
    let s = E[key];
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }

  /* 章節控制器字串（T-321 刀 K2）：EN 缺鍵回 null，呼叫端退回繁中 */
  function chapter(key, vars) {
    const E = en() && en().chapters;
    if (!(get() === 'en' && E && E[key])) return null;
    let s = E[key];
    if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
    return s;
  }

  CSL.I18n = { get, set, toggle, card, claimText, readout, cap, shell, now, tour, hemo, chapter, isEn, applyShell, LOCALES };
})(typeof window !== 'undefined' ? window : globalThis);
