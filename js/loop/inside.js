/* CELLSCAPE · Living Atlas — 細胞內部示意（T-299 刀 C4）
   依角色卡提供教育級「細胞內部」示意：圖為風格化示意，非分子模擬；
   事實層級與知識卡一致（教科書概念層級），不新增臨床宣稱、不進入守恆帳。
   僅讀 CSL.Content 的角色 id；未動 unchanged-core 凍結七檔。 */
(function (global) {
  'use strict';

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

  /* 每角色內部組成（教育簡化；與該角色卡 keyPoints／qa 同層級） */
  const DATA = {
    rbc: {
      title: '紅血球內部（成熟哺乳類）',
      note: '成熟紅血球沒有細胞核與粒線體——圖中刻意不畫核；能量靠糖酵解。',
      parts: [
        { n: '細胞膜＋血影蛋白骨架', en: 'membrane / spectrin', note: '維持雙凹圓盤形，可變形穿越微血管' },
        { n: '血紅素（Hb）', en: 'hemoglobin', note: '含鐵蛋白，約佔細胞質的三分之一，攜氧主角' },
        { n: '糖酵解酵素', en: 'glycolytic enzymes', note: '無粒線體，靠糖酵解供能' },
        { n: '（無細胞核）', en: 'no nucleus', note: '成熟後失去核與大部分胞器' }
      ],
      svg: `
        <ellipse cx="180" cy="110" rx="150" ry="86" fill="rgba(150,40,40,.35)" stroke="#c25656" stroke-width="3"/>
        <ellipse cx="180" cy="110" rx="96" ry="40" fill="rgba(60,10,10,.35)" stroke="#a24040" stroke-width="2"/>
        <text x="180" y="112" class="it" text-anchor="middle">中央凹陷（雙凹圓盤）</text>
        <circle cx="120" cy="70" r="7" fill="#e08a8a"/><circle cx="238" cy="78" r="7" fill="#e08a8a"/>
        <circle cx="146" cy="146" r="7" fill="#e08a8a"/><circle cx="252" cy="132" r="7" fill="#e08a8a"/>
        <text x="180" y="152" class="it" text-anchor="middle">● 血紅素分子（示意散布）</text>
        <text x="180" y="30" class="it" text-anchor="middle">細胞膜＋血影蛋白骨架</text>
        <text x="180" y="196" class="it warn" text-anchor="middle">無核・無粒線體——糖酵解供能</text>`
    },
    at1: {
      title: '肺泡第一型細胞（AT1）內部',
      note: '極薄的上皮：厚度約 0.1–0.2 µm，讓氣體快速擴散；胞器相對稀少。',
      parts: [
        { n: '極薄細胞質延伸', en: 'thin cytoplasm', note: '覆蓋大部分肺泡表面，氣體擴散的短路徑' },
        { n: '細胞核', en: 'nucleus', note: '常突向細胞質較厚處' },
        { n: '胞飲小泡', en: 'caveolae', note: '協助物質穿越薄細胞質' },
        { n: '少量粒線體', en: 'mitochondria', note: '維持細胞基本運作' }
      ],
      svg: `
        <path d="M14,110 C70,86 290,86 346,110 C290,132 70,132 14,110 Z" fill="rgba(110,180,200,.25)" stroke="#6eb4c8" stroke-width="2.5"/>
        <ellipse cx="52" cy="104" rx="16" ry="11" fill="rgba(160,200,220,.5)" stroke="#8fc6da"/>
        <text x="52" y="86" class="it" text-anchor="middle">核</text>
        <circle cx="150" cy="96" r="3.5" fill="#9fd4e4"/><circle cx="210" cy="102" r="3.5" fill="#9fd4e4"/><circle cx="268" cy="94" r="3.5" fill="#9fd4e4"/>
        <text x="216" y="124" class="it" text-anchor="middle">胞飲小泡（示意）</text>
        <text x="180" y="34" class="it" text-anchor="middle">肺泡腔側</text>
        <text x="180" y="186" class="it" text-anchor="middle">基底膜側（與內皮共構氣血屏障）</text>`
    },
    at2: {
      title: '肺泡第二型細胞（AT2）內部',
      note: '肺泡的「維修與保養」細胞：製造表面活性素，也是 AT1 的修補來源。',
      parts: [
        { n: '板層小體', en: 'lamellar bodies', note: '儲存並釋放表面活性素，降低肺泡表面張力' },
        { n: '微絨毛', en: 'microvilli', note: '游離面短突起' },
        { n: '粗內質網／高基氏體', en: 'rER / Golgi', note: '合成與加工表面活性素蛋白' },
        { n: '粒線體', en: 'mitochondria', note: '供應合成與分泌所需能量' }
      ],
      svg: `
        <rect x="90" y="56" width="180" height="120" rx="26" fill="rgba(150,190,120,.22)" stroke="#96be78" stroke-width="2.5"/>
        <path d="M150,56 l-6,-12 M170,56 l-2,-13 M190,56 l2,-12 M210,56 l6,-12" stroke="#96be78" stroke-width="2" fill="none"/>
        <text x="180" y="34" class="it" text-anchor="middle">微絨毛（游離面）</text>
        <circle cx="140" cy="100" r="13" fill="none" stroke="#cfe6a8" stroke-width="2"/><circle cx="140" cy="100" r="7" fill="none" stroke="#cfe6a8" stroke-width="1.5"/>
        <circle cx="228" cy="94" r="13" fill="none" stroke="#cfe6a8" stroke-width="2"/><circle cx="228" cy="94" r="7" fill="none" stroke="#cfe6a8" stroke-width="1.5"/>
        <text x="184" y="146" class="it" text-anchor="middle">● 板層小體（表面活性素來源）</text>
        <ellipse cx="120" cy="150" rx="9" ry="5" fill="#7fbf9f"/><ellipse cx="244" cy="150" rx="9" ry="5" fill="#7fbf9f"/>
        <text x="180" y="196" class="it" text-anchor="middle">粒線體（橢圓）・粗內質網／高基氏體（未細繪）</text>`
    },
    endothelium: {
      title: '毛細血管內皮細胞內部',
      note: '薄壁的「管路內襯」：與 AT1 共構氣血屏障，物質穿越以擴散與胞飲為主。',
      parts: [
        { n: '薄細胞質', en: 'thin cytoplasm', note: '減少擴散距離' },
        { n: '緊密連接', en: 'tight junctions', note: '細胞間封合，調節通透' },
        { n: '胞飲小泡', en: 'vesicles', note: '跨細胞運送（transcytosis）' },
        { n: '細胞核', en: 'nucleus', note: '位於較厚處' }
      ],
      svg: `
        <path d="M14,88 C90,74 270,74 346,88 L346,132 C270,118 90,118 14,132 Z" fill="rgba(110,150,210,.25)" stroke="#7a96d2" stroke-width="2.5"/>
        <line x1="34" y1="80" x2="34" y2="140" stroke="#aebfe8" stroke-width="2" stroke-dasharray="3 3"/>
        <line x1="326" y1="80" x2="326" y2="140" stroke="#aebfe8" stroke-width="2" stroke-dasharray="3 3"/>
        <text x="60" y="66" class="it">緊密連接（端點示意）</text>
        <ellipse cx="70" cy="106" rx="13" ry="9" fill="rgba(190,210,240,.6)" stroke="#aebfe8"/>
        <text x="70" y="150" class="it" text-anchor="middle">核</text>
        <circle cx="150" cy="98" r="3.5" fill="#c3d2f0"/><circle cx="205" cy="108" r="3.5" fill="#c3d2f0"/><circle cx="258" cy="96" r="3.5" fill="#c3d2f0"/>
        <text x="205" y="150" class="it" text-anchor="middle">胞飲小泡（跨細胞運送）</text>
        <text x="180" y="34" class="it" text-anchor="middle">管腔面（血流側）</text>
        <text x="180" y="196" class="it" text-anchor="middle">外側：基底膜（與 AT1 相接）</text>`
    },
    'alv-mac': {
      title: '肺泡巨噬細胞內部',
      note: '肺泡的第一線清潔隊：可變形、移動、吞噬並在溶小體內消化目標。',
      parts: [
        { n: '溶小體', en: 'lysosomes', note: '含消化酶，分解吞入物' },
        { n: '吞噬體', en: 'phagosomes', note: '包住被吞噬的微粒／病原' },
        { n: '偽足', en: 'pseudopods', note: '變形與包圍目標的突起' },
        { n: '粒線體', en: 'mitochondria', note: '游走與吞噬的高耗能需求' }
      ],
      svg: `
        <path d="M60,110 C56,70 110,44 160,52 C200,30 268,44 292,76 C322,96 312,140 276,152 C240,176 170,170 140,158 C96,168 64,146 60,110 Z"
              fill="rgba(120,200,160,.22)" stroke="#78c8a0" stroke-width="2.5"/>
        <circle cx="120" cy="92" r="14" fill="rgba(190,230,205,.55)" stroke="#9ad4b6"/>
        <circle cx="228" cy="86" r="10" fill="rgba(190,230,205,.55)" stroke="#9ad4b6"/><circle cx="228" cy="86" r="4" fill="#5a8a6e"/>
        <circle cx="252" cy="126" r="12" fill="rgba(190,230,205,.55)" stroke="#9ad4b6"/><circle cx="252" cy="126" r="5" fill="#5a8a6e"/>
        <text x="120" y="122" class="it" text-anchor="middle">吞噬體</text>
        <text x="228" y="66" class="it" text-anchor="middle">溶小體</text>
        <text x="252" y="150" class="it" text-anchor="middle">消化中</text>
        <text x="180" y="30" class="it" text-anchor="middle">偽足：變形移動與包圍目標</text>
        <text x="180" y="196" class="it" text-anchor="middle">粒線體散布（未細繪）</text>`
    },
    neutrophil: {
      title: '嗜中性球內部',
      note: '數量最多的白血球：特徵是分葉核，顆粒即武器庫。',
      parts: [
        { n: '分葉核（2–5 葉）', en: 'lobed nucleus', note: '嗜中性球的名字與辨識特徵' },
        { n: '嗜天青顆粒', en: 'azurophilic granules', note: '含髓過氧化酶等攻擊酵素' },
        { n: '特異顆粒', en: 'specific granules', note: '含多種抗菌因子' },
        { n: '趨化受體', en: 'chemokine receptors', note: '沿感染訊號移動（招募）' }
      ],
      svg: `
        <circle cx="180" cy="108" r="78" fill="rgba(190,170,220,.20)" stroke="#a68ac8" stroke-width="2.5"/>
        <path d="M150,86 q-22,-14 -8,-30 q16,-12 26,4 q18,-18 30,-2 q12,14 -6,26 q10,16 -8,24 q-18,6 -24,-8 q-16,4 -10,-14 Z"
              fill="rgba(120,80,160,.55)" stroke="#8a64b0" stroke-width="2"/>
        <text x="150" y="44" class="it" text-anchor="middle">分葉核（形狀示意）</text>
        <circle cx="236" cy="92" r="6" fill="#d8b0d8"/><circle cx="250" cy="118" r="6" fill="#d8b0d8"/><circle cx="226" cy="138" r="6" fill="#d8b0d8"/>
        <circle cx="132" cy="140" r="6" fill="#b090d0"/><circle cx="156" cy="152" r="6" fill="#b090d0"/>
        <text x="196" y="172" class="it" text-anchor="middle">● 顆粒（兩類，示意）</text>
        <text x="180" y="26" class="it" text-anchor="middle">表面：趨化受體（沿訊號招募）</text>`
    },
    tcell: {
      title: 'T 細胞內部（家族概覽）',
      note: '適應性免疫的辨識與調節核心；本卡為家族概覽，CD8／CD4 分工未在模型個別模擬。',
      parts: [
        { n: 'T 細胞受體（TCR）', en: 'TCR', note: '辨識呈現中的特定抗原片段（專一性來源）' },
        { n: '細胞核', en: 'nucleus', note: '單核（與嗜中性球的分葉核不同）' },
        { n: '毒殺顆粒', en: 'cytotoxic granules', note: 'CD8 效應細胞含穿孔素／顆粒酶（家族概覽）' },
        { n: '粒線體／內質網', en: 'mito / ER', note: '支援增殖與分泌' }
      ],
      svg: `
        <circle cx="180" cy="108" r="76" fill="rgba(120,150,220,.20)" stroke="#7a96d8" stroke-width="2.5"/>
        <circle cx="172" cy="102" r="30" fill="rgba(160,180,235,.55)" stroke="#9ab0e4" stroke-width="2"/>
        <text x="172" y="106" class="it" text-anchor="middle">核</text>
        <circle cx="248" cy="80" r="7" fill="#b8c8f0"/><circle cx="256" cy="106" r="7" fill="#b8c8f0"/><circle cx="244" cy="132" r="7" fill="#b8c8f0"/>
        <text x="252" y="158" class="it" text-anchor="middle">毒殺顆粒（CD8 效應）</text>
        <path d="M104,96 q-18,10 0,22 M104,96 q-18,10 0,22" stroke="#7a96d8" stroke-width="2" fill="none"/>
        <text x="86" y="86" class="it" text-anchor="middle">TCR</text>
        <text x="180" y="196" class="it" text-anchor="middle">增殖與分泌由粒線體／內質網支援</text>`
    },
    platelet: {
      title: '血小板內部',
      note: '不是完整細胞：由骨髓巨核細胞斷出的片段——沒有核，帶著預製的修補裝備。',
      parts: [
        { n: 'α 顆粒／緻密顆粒', en: 'alpha / dense granules', note: '預載凝血與招募因子，活化時釋放' },
        { n: '開放小管系統', en: 'open canalicular system', note: '表面內凹的管道，利於物質進出' },
        { n: '微管環', en: 'marginal band', note: '邊緣微管環撐起盤狀外形' },
        { n: '（無細胞核）', en: 'no nucleus', note: '片段身分：離開骨髓即不再分裂' }
      ],
      svg: `
        <ellipse cx="180" cy="108" rx="84" ry="56" fill="rgba(200,150,110,.22)" stroke="#c8966e" stroke-width="2.5"/>
        <ellipse cx="180" cy="108" rx="66" ry="42" fill="none" stroke="#e0b088" stroke-width="2" stroke-dasharray="6 4"/>
        <text x="180" y="36" class="it" text-anchor="middle">微管環（邊緣撐形）</text>
        <circle cx="140" cy="96" r="6" fill="#e8c0a0"/><circle cx="210" cy="90" r="6" fill="#e8c0a0"/>
        <circle cx="228" cy="122" r="6" fill="#b07050"/><circle cx="150" cy="128" r="6" fill="#b07050"/>
        <text x="184" y="152" class="it" text-anchor="middle">● α 顆粒（淺）／緻密顆粒（深）</text>
        <text x="180" y="188" class="it" text-anchor="middle">表面內凹＝開放小管系（示意）・無核</text>`
    }
  };

  function build(cardId) {
    const d = DATA[cardId];
    if (!d) return null;
    const card = (global.CSL && global.CSL.Content && global.CSL.Content.cards || []).find((c) => c.id === cardId);
    const rows = d.parts.map((p) => `
      <div class="insidePart"><b>${esc(p.n)}</b> <span class="dim small">${esc(p.en)}</span>
        <div class="small">${esc(p.note)}</div></div>`).join('');
    return `
      <div class="ph">細胞內部（示意）—— ${esc(d.title)}<button id="insideClose" class="x">×</button></div>
      <div class="insideBody">
        <svg viewBox="0 0 360 220" role="img" aria-label="${esc(d.title)}示意圖">${d.svg}</svg>
        ${rows}
        <div class="note">結構示意・教育簡化・非分子模擬；與「${esc(card ? card.name : cardId)}」知識卡同層級，來源見該卡「查來源」。圖不進入守恆帳與事件溯源。</div>
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
  CSL.Inside = { open, close, has: (id) => !!DATA[id] };
})(typeof window !== 'undefined' ? window : globalThis);
