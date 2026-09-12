/* CELLSCAPE · Living Atlas — 細胞內部示意（T-299 刀 C4；T-323 內容治理）
   ============================================================
   誠實規則（機械化在 docs/audit-probes/atlas-tests.cjs）：
   - 內容一律住在 CARDS[cardId].layers 結構表，每筆非 kind:'claim'
     （claimIds 必須能在 CSL.Content.claims 解析，並由 UI 就地印出依據與
     適用限制）即 kind:'illustrative'（明示示意，且不得夾帶數量或單位）。
   - 模組自撰字串不得出現未登錄的生理詞彙或定量事實；引用自 CSL.Content
     的文字不在此限（那是登錄過的正本）。
   - 圖為風格化示意，非分子模擬；不進入守恆帳與事件溯源。
   未動 unchanged-core 凍結七檔。
   ============================================================ */
(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* 每角色的內容層：非 claim 即 illustrative；數量與未登錄詞彙不得夾帶。 */
  const CARDS = {
    rbc: {
      title: '紅血球內部（成熟哺乳類）',
      layers: [
        { id: 'nucleus', kind: 'claim', claimIds: ['C-rbc-nucleus'],
          zh: '成熟哺乳類紅血球沒有細胞核——圖中刻意不畫核。' },
        { id: 'shape', kind: 'claim', claimIds: ['C-rbc-morph'],
          zh: '成熟紅血球呈雙凹圓盤形。' },
        { id: 'carrier', kind: 'claim', claimIds: ['C-rbc-hemo', 'C-hemo-iron'],
          zh: '以血紅素攜帶氧：在肺部裝載、到組織釋出；血紅素是含鐵蛋白。' },
        { id: 'energy', kind: 'illustrative',
          zh: '能量代謝與胞器缺失以教育示意呈現；本層不給出定量比例。' },
        { id: 'skeleton', kind: 'illustrative',
          zh: '細胞膜與骨架維持外形並可變形——結構示意，不是本模型的力學模擬。' }
      ],
      svg: `
        <ellipse cx="180" cy="110" rx="150" ry="86" fill="rgba(150,40,40,.35)" stroke="#c25656" stroke-width="3"/>
        <ellipse cx="180" cy="110" rx="96" ry="40" fill="rgba(60,10,10,.35)" stroke="#a24040" stroke-width="2"/>
        <text x="180" y="112" class="it" text-anchor="middle">中央凹陷（雙凹圓盤）</text>
        <circle cx="120" cy="70" r="7" fill="#e08a8a"/><circle cx="238" cy="78" r="7" fill="#e08a8a"/>
        <circle cx="146" cy="146" r="7" fill="#e08a8a"/><circle cx="252" cy="132" r="7" fill="#e08a8a"/>
        <text x="180" y="152" class="it" text-anchor="middle">● 血紅素（示意散布）</text>
        <text x="180" y="30" class="it" text-anchor="middle">細胞膜（示意）</text>
        <text x="180" y="196" class="it warn" text-anchor="middle">無核（見依據列）</text>`
    },
    at1: {
      title: '肺泡第一型細胞（AT1）內部',
      layers: [
        { id: 'thin', kind: 'claim', claimIds: ['C-at1-thin'],
          zh: 'AT1 是極薄的大面積鱗狀上皮，覆蓋肺泡壁大部分表面。' },
        { id: 'gas', kind: 'claim', claimIds: ['C-at1-gas'],
          zh: 'AT1 的薄壁是氣體擴散交換的結構條件。' },
        { id: 'barrier', kind: 'claim', claimIds: ['C-ac-barrier'],
          zh: '與基底膜、毛細血管內皮緊貼構成氣血屏障。' },
        { id: 'organelles', kind: 'illustrative',
          zh: '核、小泡與胞器位置為教育示意；本層不對胞器數目或厚度作定量宣稱。' }
      ],
      svg: `
        <path d="M14,110 C70,86 290,86 346,110 C290,132 70,132 14,110 Z" fill="rgba(110,180,200,.25)" stroke="#6eb4c8" stroke-width="2.5"/>
        <ellipse cx="52" cy="104" rx="16" ry="11" fill="rgba(160,200,220,.5)" stroke="#8fc6da"/>
        <text x="52" y="86" class="it" text-anchor="middle">核</text>
        <circle cx="150" cy="96" r="3.5" fill="#9fd4e4"/><circle cx="210" cy="102" r="3.5" fill="#9fd4e4"/><circle cx="268" cy="94" r="3.5" fill="#9fd4e4"/>
        <text x="216" y="124" class="it" text-anchor="middle">小泡（示意）</text>
        <text x="180" y="34" class="it" text-anchor="middle">肺泡腔側</text>
        <text x="180" y="186" class="it" text-anchor="middle">基底膜側（氣血屏障，見依據列）</text>`
    },
    at2: {
      title: '肺泡第二型細胞（AT2）內部',
      layers: [
        { id: 'shape', kind: 'claim', claimIds: ['C-at2-shape'],
          zh: 'AT2 為立方形上皮，散布於肺泡壁。' },
        { id: 'surfactant', kind: 'claim', claimIds: ['C-at2-surf'],
          zh: 'AT2 合成分泌表面活性物質，降低肺泡表面張力。' },
        { id: 'progenitor', kind: 'claim', claimIds: ['C-at2-progenitor'],
          zh: 'AT2 被認為是 AT1 受損後修補的細胞來源。' },
        { id: 'storage', kind: 'illustrative',
          zh: '儲存與分泌胞器以教育示意呈現；本模型沒有表面活性物質變數。' }
      ],
      svg: `
        <rect x="90" y="56" width="180" height="120" rx="26" fill="rgba(150,190,120,.22)" stroke="#96be78" stroke-width="2.5"/>
        <path d="M150,56 l-6,-12 M170,56 l-2,-13 M190,56 l2,-12 M210,56 l6,-12" stroke="#96be78" stroke-width="2" fill="none"/>
        <text x="180" y="34" class="it" text-anchor="middle">微絨毛（游離面，示意）</text>
        <circle cx="140" cy="100" r="13" fill="none" stroke="#cfe6a8" stroke-width="2"/><circle cx="140" cy="100" r="7" fill="none" stroke="#cfe6a8" stroke-width="1.5"/>
        <circle cx="228" cy="94" r="13" fill="none" stroke="#cfe6a8" stroke-width="2"/><circle cx="228" cy="94" r="7" fill="none" stroke="#cfe6a8" stroke-width="1.5"/>
        <text x="184" y="146" class="it" text-anchor="middle">● 儲存顆粒（示意）</text>
        <ellipse cx="120" cy="150" rx="9" ry="5" fill="#7fbf9f"/><ellipse cx="244" cy="150" rx="9" ry="5" fill="#7fbf9f"/>
        <text x="180" y="196" class="it" text-anchor="middle">合成與分泌路徑（示意，未細繪）</text>`
    },
    endothelium: {
      title: '毛細血管內皮細胞內部',
      layers: [
        { id: 'interface', kind: 'claim', claimIds: ['C-endo-interface'],
          zh: '毛細血管內皮為單層扁平細胞，構成血液與組織間的選擇性界面。' },
        { id: 'barrier', kind: 'claim', claimIds: ['C-ac-barrier'],
          zh: '與 AT1、基底膜緊貼構成肺泡氣血屏障。' },
        { id: 'junctions', kind: 'illustrative',
          zh: '連接、小泡與跨細胞運送以教育示意呈現；本模型沒有個別內皮實體。' }
      ],
      svg: `
        <path d="M14,88 C90,74 270,74 346,88 L346,132 C270,118 90,118 14,132 Z" fill="rgba(110,150,210,.25)" stroke="#7a96d2" stroke-width="2.5"/>
        <line x1="34" y1="80" x2="34" y2="140" stroke="#aebfe8" stroke-width="2" stroke-dasharray="3 3"/>
        <line x1="326" y1="80" x2="326" y2="140" stroke="#aebfe8" stroke-width="2" stroke-dasharray="3 3"/>
        <text x="60" y="66" class="it">細胞連接（端點示意）</text>
        <ellipse cx="70" cy="106" rx="13" ry="9" fill="rgba(190,210,240,.6)" stroke="#aebfe8"/>
        <text x="70" y="150" class="it" text-anchor="middle">核</text>
        <circle cx="150" cy="98" r="3.5" fill="#c3d2f0"/><circle cx="205" cy="108" r="3.5" fill="#c3d2f0"/><circle cx="258" cy="96" r="3.5" fill="#c3d2f0"/>
        <text x="205" y="150" class="it" text-anchor="middle">小泡（示意）</text>
        <text x="180" y="34" class="it" text-anchor="middle">管腔面（血流側）</text>
        <text x="180" y="196" class="it" text-anchor="middle">外側：基底膜（與 AT1 相接）</text>`
    },
    'alv-mac': {
      title: '肺泡巨噬細胞內部',
      layers: [
        { id: 'loc', kind: 'claim', claimIds: ['C-alvmac-loc'],
          zh: '肺泡巨噬細胞駐留在肺泡腔與小氣道。' },
        { id: 'role', kind: 'claim', claimIds: ['C-alvmac-role'],
          zh: '吞噬清除微粒、碎片與病原，是肺泡第一線防禦之一。' },
        { id: 'motility', kind: 'illustrative',
          zh: '變形、包圍與消化胞器以教育示意呈現；本模組不描述吞噬動力學。' }
      ],
      svg: `
        <path d="M60,110 C56,70 110,44 160,52 C200,30 268,44 292,76 C322,96 312,140 276,152 C240,176 170,170 140,158 C96,168 64,146 60,110 Z"
              fill="rgba(120,200,160,.22)" stroke="#78c8a0" stroke-width="2.5"/>
        <circle cx="120" cy="92" r="14" fill="rgba(190,230,205,.55)" stroke="#9ad4b6"/>
        <circle cx="228" cy="86" r="10" fill="rgba(190,230,205,.55)" stroke="#9ad4b6"/><circle cx="228" cy="86" r="4" fill="#5a8a6e"/>
        <circle cx="252" cy="126" r="12" fill="rgba(190,230,205,.55)" stroke="#9ad4b6"/><circle cx="252" cy="126" r="5" fill="#5a8a6e"/>
        <text x="120" y="122" class="it" text-anchor="middle">吞噬體（示意）</text>
        <text x="228" y="66" class="it" text-anchor="middle">溶小體（示意）</text>
        <text x="252" y="150" class="it" text-anchor="middle">消化中（示意）</text>
        <text x="180" y="30" class="it" text-anchor="middle">偽足：變形移動（示意）</text>
        <text x="180" y="196" class="it" text-anchor="middle">能量胞器散布（示意，未細繪）</text>`
    },
    neutrophil: {
      title: '嗜中性球內部',
      layers: [
        { id: 'share', kind: 'claim', claimIds: ['C-neut-share'],
          zh: '嗜中性球是白血球中占比最高的類型。' },
        { id: 'role', kind: 'claim', claimIds: ['C-neut-role'],
          zh: '沿趨化訊號招募到感染處，吞噬病原。' },
        { id: 'lobes', kind: 'illustrative',
          zh: '分葉核與顆粒為形狀示意；本層不對葉數或顆粒分類作定量宣稱。' }
      ],
      svg: `
        <circle cx="180" cy="108" r="78" fill="rgba(190,170,220,.20)" stroke="#a68ac8" stroke-width="2.5"/>
        <path d="M150,86 q-22,-14 -8,-30 q16,-12 26,4 q18,-18 30,-2 q12,14 -6,26 q10,16 -8,24 q-18,6 -24,-8 q-16,4 -10,-14 Z"
              fill="rgba(120,80,160,.55)" stroke="#8a64b0" stroke-width="2"/>
        <text x="150" y="44" class="it" text-anchor="middle">分葉核（形狀示意）</text>
        <circle cx="236" cy="92" r="6" fill="#d8b0d8"/><circle cx="250" cy="118" r="6" fill="#d8b0d8"/><circle cx="226" cy="138" r="6" fill="#d8b0d8"/>
        <circle cx="132" cy="140" r="6" fill="#b090d0"/><circle cx="156" cy="152" r="6" fill="#b090d0"/>
        <text x="196" y="172" class="it" text-anchor="middle">● 顆粒（示意）</text>
        <text x="180" y="26" class="it" text-anchor="middle">表面：趨化受體（示意，沿訊號招募）</text>`
    },
    tcell: {
      title: 'T 細胞內部（家族概覽）',
      layers: [
        { id: 'family', kind: 'claim', claimIds: ['C-tcell-family'],
          zh: 'T 細胞為一族：CD8 毒殺、CD4 輔助、調節性 T 細胞各有分工。' },
        { id: 'mhc', kind: 'claim', claimIds: ['C-tcell-mhc'],
          zh: 'T 細胞以受器辨識 MHC 呈現的抗原片段後才作用。' },
        { id: 'organelles', kind: 'illustrative',
          zh: '核、受器與顆粒位置為家族概覽示意；本模型沒有個別 T 細胞實體。' }
      ],
      svg: `
        <circle cx="180" cy="108" r="76" fill="rgba(120,150,220,.20)" stroke="#7a96d8" stroke-width="2.5"/>
        <circle cx="172" cy="102" r="30" fill="rgba(160,180,235,.55)" stroke="#9ab0e4" stroke-width="2"/>
        <text x="172" y="106" class="it" text-anchor="middle">核</text>
        <circle cx="248" cy="80" r="7" fill="#b8c8f0"/><circle cx="256" cy="106" r="7" fill="#b8c8f0"/><circle cx="244" cy="132" r="7" fill="#b8c8f0"/>
        <text x="252" y="158" class="it" text-anchor="middle">顆粒（示意）</text>
        <path d="M104,96 q-18,10 0,22 M104,96 q-18,10 0,22" stroke="#7a96d8" stroke-width="2" fill="none"/>
        <text x="86" y="86" class="it" text-anchor="middle">TCR（示意）</text>
        <text x="180" y="196" class="it" text-anchor="middle">合成與分泌支援（示意）</text>`
    },
    platelet: {
      title: '血小板內部',
      layers: [
        { id: 'fragment', kind: 'claim', claimIds: ['C-plt-fragment'],
          zh: '血小板是骨髓巨核細胞脫落的細胞碎片，沒有細胞核。' },
        { id: 'hemostasis', kind: 'claim', claimIds: ['C-plt-hemostasis'],
          zh: '在血管破損處黏附聚集形成栓子，配合凝血級聯止血。' },
        { id: 'granules', kind: 'illustrative',
          zh: '顆粒、小管與微管環以教育示意呈現；本模型沒有血小板實體。' }
      ],
      svg: `
        <ellipse cx="180" cy="108" rx="84" ry="56" fill="rgba(200,150,110,.22)" stroke="#c8966e" stroke-width="2.5"/>
        <ellipse cx="180" cy="108" rx="66" ry="42" fill="none" stroke="#e0b088" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="180" y="36" class="it" text-anchor="middle">邊緣環（示意）</text>
        <circle cx="140" cy="96" r="6" fill="#e8c0a0"/><circle cx="210" cy="90" r="6" fill="#e8c0a0"/>
        <circle cx="228" cy="122" r="6" fill="#b07050"/><circle cx="150" cy="128" r="6" fill="#b07050"/>
        <text x="184" y="152" class="it" text-anchor="middle">● 顆粒（示意）</text>
        <text x="180" y="188" class="it" text-anchor="middle">表面內凹（示意）・無核</text>`
    }
  };

  function build(cardId) {
    const d = CARDS[cardId];
    if (!d) return null;
    const card = (global.CSL && global.CSL.Content && global.CSL.Content.cards || []).find((c) => c.id === cardId);
    const claimRows = (ids) => (global.CSL && global.CSL.Atlas && global.CSL.Atlas._claimRow)
      ? ids.map((cid) => global.CSL.Atlas._claimRow(cid)).join('') : '';
    const rows = d.layers.map((ly) => {
      if (ly.kind === 'illustrative') {
        return `<div class="insidePart dim"><div class="small">${esc(ly.zh)}</div>
          <div class="dim tiny">示意・教育簡化，非分子模擬</div></div>`;
      }
      return `<div class="insidePart"><div class="small">${esc(ly.zh)}</div>${claimRows(ly.claimIds)}</div>`;
    }).join('');
    return `
      <div class="ph">細胞內部（示意）—— ${esc(d.title)}<button id="insideClose" class="x">×</button></div>
      <div class="insideBody">
        <svg viewBox="0 0 360 220" role="img" aria-label="${esc(d.title)}示意圖">${d.svg}</svg>
        ${rows}
        <div class="note">結構示意・教育簡化・非分子模擬；與「${esc(card ? card.name : cardId)}」知識卡同層級。圖不進入守恆帳與事件溯源。</div>
      </div>`;
  }

  function open(cardId) {
    const html = build(cardId);
    if (!html) return;
    let box = global.document.getElementById('insideModal');
    if (!box) {
      box = global.document.createElement('div');
      box.id = 'insideModal';
      box.className = 'modal hidden';
      box.innerHTML = '<div class="mbox" id="insideMbox"></div>';
      global.document.body.appendChild(box);
      box.addEventListener('click', (e) => {
        if (e.target === box || e.target.id === 'insideClose') close();
      });
    }
    box.firstElementChild.innerHTML = html;
    box.classList.remove('hidden');
  }

  function close() {
    const box = global.document.getElementById('insideModal');
    if (box) box.classList.add('hidden');
  }

  const CSL = global.CSL = global.CSL || {};
  /* cards 匯出供探針機械化檢查；不碰 DOM、不寫模型。 */
  CSL.Inside = { open, close, has: (id) => !!CARDS[id], cards: CARDS };
})(typeof window !== 'undefined' ? window : globalThis);
