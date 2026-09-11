/* ============================================================
   CELLSCAPE v0.3 · Living Atlas — content.js
   內容註冊表：角色卡、問答、主張、來源、讀值定義。
   邊界（v0.3 規格 §8）：本檔只含資料——不含可執行 JS、不含
   eval、不含 selector、不含可寫入 world 的 callback。
   證據分級：biology_reference（文獻背景，編輯草稿待審）≠
   model_assumption（本版工程近似，對照實作核對）≠
   runtime_observation（本次模型觀測）≠ illustrative（示意）。
   「來源存在」不等於「主張已被來源支持」；reviewStatus 逐條標記。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});

  CSL.Content = {
    contentVersion: 'v0.3.0-content.3',

    /* 來源表：與 planning 包 SOURCE-REGISTER.json（S1–S8）一致。
       assetNote 提醒：引用敘事 ≠ 可打包其影片/插圖。 */
    sources: [
      { id: 'S1', publisher: 'NHLBI / NIH', title: 'How the Lungs Work — The Respiratory System',
        url: 'https://www.nhlbi.nih.gov/health/lungs/respiratory-system',
        use: '氣體交換與循環背景；不提供本模型係數。',
        assetNote: '頁面中的部分動畫與插圖標示 Nucleus Medical Media 版權；不可因 NIH 網域而假設可重用。',
        checkedOn: '2026-09-08' },
      { id: 'S2', publisher: 'American Society of Hematology', title: 'Blood Basics',
        url: 'https://www.hematology.org/education/patients/blood-basics',
        use: '紅血球形態、血紅素、成熟紅血球無細胞核；白血球角色、血小板為細胞碎片。',
        checkedOn: '2026-09-08' },
      { id: 'S3', publisher: 'The Human Protein Atlas', title: 'Dictionary — Normal: Lung',
        url: 'https://www.proteinatlas.org/learn/dictionary/normal/lung',
        use: 'AT1、AT2、肺泡巨噬細胞與肺泡局部位置及功能；只擷取對應段落，不整頁照抄。',
        checkedOn: '2026-09-08' },
      { id: 'S4', publisher: 'The Human Protein Atlas', title: 'The human proteome in lung',
        url: 'https://www.proteinatlas.org/humanproteome/tissue/lung',
        use: '肺組織中的細胞類別、蛋白表現與組織學背景；表現量不是即時功能通量。',
        checkedOn: '2026-09-08' },
      { id: 'S5', publisher: 'NHLBI / NIH', title: 'How Blood Flows through the Heart',
        url: 'https://www.nhlbi.nih.gov/health/heart/blood-flow',
        use: '循環路徑、動靜脈依流向區分；冠狀動脈供應心肌。',
        checkedOn: '2026-09-08' },
      { id: 'S6', publisher: 'Human Cell Atlas Data Portal', title: 'The integrated Human Lung Cell Atlas (HLCA) v1.0',
        url: 'https://data.humancellatlas.org/hca-bio-networks/lung/atlases/lung-v1-0',
        use: '細胞分類與參考圖譜的資料入口；不是 Cellscape 的行為引擎或校準證據。',
        checkedOn: '2026-09-08' },
      { id: 'S7', publisher: 'Nature Medicine', title: 'An integrated cell atlas of the lung in health and disease',
        url: 'https://www.nature.com/articles/s41591-023-02327-2',
        use: 'HLCA 的原始研究與資料方法；人體來源、組織、狀態需依具體子資料集記錄。',
        checkedOn: '2026-09-08' },
      { id: 'S8', publisher: 'The Human Protein Atlas', title: 'Licence & Citation',
        url: 'https://www.proteinatlas.org/about/licence',
        use: '資料庫可著作權部分的 CC BY 4.0 說明及第三方限制；每個採用素材仍要個別確認。',
        checkedOn: '2026-09-08' }
    ],

    /* 能力綁定：卡片在「連動模式」中的實作身分。
       dynamic=獨立動態實體；aggregate=聚合界面近似；knowledge_only=知識/示意、
       無即時值；legacy_independent=僅存在舊獨立展示；not_supported=無對應能力。 */
    capabilityLegend: [
      { id: 'dynamic', label: '動態模型實體', note: '有 ID、有即時模型欄位；行為為簡化模型' },
      { id: 'aggregate', label: '聚合近似', note: '由聚合界面/庫存處理，非個別細胞' },
      { id: 'knowledge_only', label: '知識／示意', note: '可讀可看，無即時模型值' },
      { id: 'legacy_independent', label: '舊獨立展示', note: '僅存在 index.html 舊場景，未與本連動世界共享狀態' },
      { id: 'not_supported', label: '未支援', note: '目前無對應能力' }
    ],

    /* 六項讀值定義（資訊層契約）：速率以模型時間換算（dt=1/30 模型秒/tick），
       不使用牆上秒數。selectorId 即白名單；觀察模組不得新增其他讀取。 */
    readouts: [
      { id: 'sel_load', name: '選取 RBC 氧負載', formula: 'e.load / e.cap',
        unit: '0–100% 模型容量', windowTicks: 0, def: true,
        note: '相對模型容量，不是 SpO₂。' },
      { id: 'tissue_level', name: '組織庫存水位', formula: 'compartments.tissue.stock / capacity',
        unit: '% 模型庫存', windowTicks: 0, def: true,
        note: '聚合庫存水位，非診斷影像。' },
      { id: 'flux_tissue_rate', name: '送達速率（RBC→組織）',
        formula: 'Σ fluxTissue(最近 N tick) / (N × dt)', unit: '模型單位／模型秒',
        windowTicks: 90, def: true, note: '窗口 N=90 tick（3 模型秒）；需完整窗口才顯示。' },
      { id: 'alveolar_level', name: '肺泡側庫存水位', formula: 'compartments.alveolar.stock / capacity',
        unit: '% 模型庫存', windowTicks: 0, def: false, note: '' },
      { id: 'flux_lung_rate', name: '肺端裝載速率（肺泡→RBC）',
        formula: 'Σ fluxLung(最近 N tick) / (N × dt)', unit: '模型單位／模型秒',
        windowTicks: 90, def: false, note: '窗口 N=90 tick；需完整窗口才顯示。' },
      { id: 'usage_rate', name: '組織使用速率',
        formula: '(ledger.usage[t] − ledger.usage[t−N]) / (N × dt)', unit: '模型單位／模型秒',
        windowTicks: 90, def: false, note: '由累積使用帳取差分；需完整窗口。' },
      { id: 'co2_blood', name: '血液 CO₂ 指數',
        formula: '生產（usage × RQ）累積 − 排出（blood × 通氣係數）', unit: '0–1 模型指數',
        windowTicks: 0, def: false, note: '聚合模型指數，非血中酸鹼值或臨床測量。' }
    ],

    /* 八張角色卡 × 四個固定問題 = 32 問答。
       四問：我是誰、通常在哪裡？／主要做什麼？／和哪些結構或角色合作？／
       這個 demo 做到與沒做到什麼？ */
    cards: [
      {
        id: 'rbc', name: '紅血球', en: 'Red Blood Cell', aliases: ['RBC', 'erythrocyte', '紅血球', '紅細胞', '血紅素', 'hemoglobin'],
        category: '血液成分', capability: 'dynamic',
        capabilityNote: '本連動模式有 48 顆具 ID 的代表性 RBC（抽樣代表，非全身總量）；行為為簡化模型。',
        headline: '數量最多的血液細胞，以血紅素攜帶氧，在肺與組織之間往返。',
        keyPoints: ['雙凹圓盤形，成熟後沒有細胞核', '血紅素含鐵，是攜氧的關鍵', '在本模型中：負載欄位近似攜帶狀態，無逐分子結合'],
        illustration: 'rbc-hemo',
        qa: [
          { q: '我是誰、通常在哪裡？',
            a: '人類成熟紅血球是雙凹圓盤形的細胞，直徑約 7–8 µm，成熟後沒有細胞核與大部分胞器。它在骨髓生成後進入血流，隨血液循環全身，生命週期約 120 天。',
            claimIds: ['C-rbc-morph', 'C-rbc-nucleus', 'C-rbc-lifespan'] },
          { q: '主要做什麼？',
            a: '以血紅素攜帶氧：在肺部氣體交換界面裝載氧，經循環送到全身組織釋出。血紅素是含鐵蛋白，氧與鐵部位的可逆結合是其攜氧能力的基礎。',
            claimIds: ['C-rbc-hemo', 'C-hemo-iron'] },
          { q: '和哪些結構或角色合作？',
            a: '在肺部與肺泡—毛細血管交換界面合作（AT1 上皮、內皮與基底膜構成的氣血屏障）；在組織與微血管交換氧；血漿是它的運輸介質。本模型將這些界面以聚合交換規則近似。',
            claimIds: ['C-ac-barrier', 'C-endo-interface'] },
          { q: '這個 demo 做到與沒做到什麼？',
            a: '做到：48 顆代表性 RBC 沿循環路徑移動，負載欄位依肺端/組織端交換規則變化，可介入、比較與回放。沒做到：沒有逐分子氧結合/解離曲線、沒有個別紅血球代謝與老化、數量不代表全身總量。',
            claimIds: ['C-model-load', 'C-model-48'] }
        ]
      },
      {
        id: 'at1', name: '肺泡第一型細胞', en: 'Alveolar Type 1 Cell (AT1)', aliases: ['AT1', 'type I', '第一型肺泡上皮', 'pneumocyte'],
        category: '肺上皮', capability: 'knowledge_only',
        capabilityNote: '知識／結構示意；不是本連動模式的獨立動態實體。交換由聚合界面規則處理。',
        headline: '極薄的上皮細胞，構成肺泡氣血屏障的絕大部分表面。',
        keyPoints: ['極薄的大面積鱗狀上皮', '覆蓋肺泡壁大部分表面', '與內皮緊貼形成氣血屏障'],
        qa: [
          { q: '我是誰、通常在哪裡？',
            a: '肺泡第一型上皮細胞（AT1）是極薄的大面積鱗狀上皮細胞，覆蓋肺泡壁絕大部分表面，與毛細血管內皮緊貼，共同構成氣血屏障。',
            claimIds: ['C-at1-thin', 'C-ac-barrier'] },
          { q: '主要做什麼？',
            a: '它的薄壁讓氧與二氧化碳能以極短距離擴散交換——它是交換的結構條件，而不是幫浦。',
            claimIds: ['C-at1-gas'] },
          { q: '和哪些結構或角色合作？',
            a: '與毛細血管內皮細胞共用基底膜形成屏障；與 AT2 共同組成肺泡上皮（AT2 負責表面張力調節與上皮修補來源）。',
            claimIds: ['C-at2-surf', 'C-endo-interface'] },
          { q: '這個 demo 做到與沒做到什麼？',
            a: '做到：在「肺泡交換剖面（示意）」中以結構示意呈現它的位置與薄壁角色。沒做到：本連動世界沒有個別 AT1 實體，交換速率由聚合規則計算，不含細胞層級行為。',
            claimIds: ['C-model-aggregate'] }
        ]
      },
      {
        id: 'at2', name: '肺泡第二型細胞', en: 'Alveolar Type 2 Cell (AT2)', aliases: ['AT2', 'type II', '第二型肺泡上皮', '表面活性物質', 'surfactant'],
        category: '肺上皮', capability: 'knowledge_only',
        capabilityNote: '知識／結構示意；不新增分泌速率等動態參數。',
        headline: '製造表面活性物質的立方上皮，也是肺泡上皮的修補來源。',
        keyPoints: ['立方形，位於肺泡壁角落', '分泌表面活性物質，降低肺泡表面張力', '被視為 AT1 受損後的修補來源'],
        qa: [
          { q: '我是誰、通常在哪裡？',
            a: '肺泡第二型上皮細胞（AT2）是立方形細胞，散布在肺泡壁上，常位於相鄰細胞交會的角落位置。',
            claimIds: ['C-at2-shape'] },
          { q: '主要做什麼？',
            a: '合成並分泌表面活性物質，降低肺泡氣液界面的表面張力，讓肺泡在呼氣末不塌陷；同時被認為是 AT1 受損後修補的細胞來源。',
            claimIds: ['C-at2-surf', 'C-at2-progenitor'] },
          { q: '和哪些結構或角色合作？',
            a: '與 AT1 共同組成肺泡上皮；其分泌的表面活性物質鋪在肺泡氣液界面，影響整個肺泡的力學狀態。',
            claimIds: ['C-at1-thin'] },
          { q: '這個 demo 做到與沒做到什麼？',
            a: '做到：知識卡與交換剖面示意中的位置說明。沒做到：模型沒有表面活性物質變數、沒有分泌速率，肺泡庫存以單一聚合水位表示，不含 AT2 個體行為。',
            claimIds: ['C-model-aggregate'] }
        ]
      },
      {
        id: 'endothelium', name: '毛細血管內皮細胞', en: 'Capillary Endothelial Cell', aliases: ['endothelium', '內皮', '血管壁'],
        category: '血管', capability: 'aggregate',
        capabilityNote: '結構說明；目前交換由聚合界面處理，沒有個別內皮細胞實體。',
        headline: '構成毛細血管壁的薄層細胞，血液與組織之間的界面。',
        keyPoints: ['單層扁平細胞構成血管內壁', '物質交換與血液—組織界面的結構基礎', '本模型以聚合界面近似，無個體實體'],
        qa: [
          { q: '我是誰、通常在哪裡？',
            a: '內皮細胞是單層扁平細胞，鋪在所有血管的內表面；在肺泡周圍毛細血管，它與 AT1 上皮緊貼形成氣血屏障。',
            claimIds: ['C-endo-interface', 'C-ac-barrier'] },
          { q: '主要做什麼？',
            a: '構成血液與周圍組織之間的選擇性界面：維持血管完整性的同時，讓氣體等物質在合適的区段交換。',
            claimIds: ['C-endo-interface'] },
          { q: '和哪些結構或角色合作？',
            a: '與 AT1 共用基底膜；管腔側與紅血球、血漿接觸——本模型的交換發生在聚合界面，位於 LUNG_CAP 與 TISSUE_CAP 兩段。',
            claimIds: ['C-ac-barrier', 'C-model-aggregate'] },
          { q: '這個 demo 做到與沒做到什麼？',
            a: '做到：以「聚合界面」在模型規則中代表血管壁與交換位置；剖面示意標出界面所在。沒做到：沒有個別內皮細胞實體，沒有內皮主動行為（如發炎時的滲出調控）。',
            claimIds: ['C-model-aggregate'] }
        ]
      },
      {
        id: 'alv-mac', name: '肺泡巨噬細胞', en: 'Alveolar Macrophage', aliases: ['alveolar macrophage', 'dust cell', '肺泡巨噬', '巨噬細胞'],
        category: '免疫', capability: 'knowledge_only',
        capabilityNote: '知識。舊獨立展示的通用巨噬模型不能冒充完整肺泡特異模型。',
        headline: '駐守在肺泡腔的清道夫，吞噬吸入的微粒與病原。',
        keyPoints: ['駐留在肺泡腔與氣道', '吞噬微粒、碎片與病原（「塵細胞」）', '舊場景的巨噬為通用模型，非肺泡特異'],
        qa: [
          { q: '我是誰、通常在哪裡？',
            a: '肺泡巨噬細胞是駐留在肺泡腔與小氣道的免疫細胞，因常見吞噬吸入塵粒又被稱為「塵細胞」。',
            claimIds: ['C-alvmac-loc'] },
          { q: '主要做什麼？',
            a: '吞噬清除抵達肺泡深處的微粒、碎片與病原，是肺泡面對外界環境的第一線防禦之一。',
            claimIds: ['C-alvmac-role'] },
          { q: '和哪些結構或角色合作？',
            a: '在氣道防禦中與黏膜纖毛清除、上皮屏障協作；感染時可召喚嗜中性球等後續免疫反應。',
            claimIds: ['C-neut-role'] },
          { q: '這個 demo 做到與沒做到什麼？',
            a: '做到：知識說明。舊的 index.html 獨立場景有通用巨噬細胞吞噬展示（legacy_independent，未與本連動世界共享狀態）。沒做到：本連動世界沒有巨噬實體，也沒有肺泡特異免疫模型。',
            claimIds: ['C-legacy-indep'] }
        ]
      },
      {
        id: 'neutrophil', name: '嗜中性球', en: 'Neutrophil', aliases: ['neutrophil', '嗜中性白血球', '白血球'],
        category: '免疫', capability: 'knowledge_only',
        capabilityNote: '知識／可連到舊獨立展示（engine.js 的趨化追擊為高度簡化）。',
        headline: '數量最多的白血球，先天免疫的快速反應部隊。',
        keyPoints: ['白血球中占比最高', '感染時最先抵達，吞噬病原', '舊場景有趨化追擊的簡化展示'],
        qa: [
          { q: '我是誰、通常在哪裡？',
            a: '嗜中性球是白血球中占比最高的類型，平時在血流中巡邏，感染發生時最快被招募到組織現場。',
            claimIds: ['C-neut-share', 'C-neut-role'] },
          { q: '主要做什麼？',
            a: '沿趨化訊號移動到感染處，吞噬並消滅細菌等病原；化膿時的膿即含大量嗜中性球與殘骸。',
            claimIds: ['C-neut-role'] },
          { q: '和哪些結構或角色合作？',
            a: '與巨噬細胞等先天免疫協作（巨噬在前哨、嗜中性球在增援）；與血管內皮交互遷出血管。',
            claimIds: ['C-alvmac-role'] },
          { q: '這個 demo 做到與沒做到什麼？',
            a: '做到：知識說明；舊獨立場景（index.html）有「趨化訊號→追擊→吞噬」的展示，但那是族群動力學層級的簡化，且未與本連動世界共享狀態。沒做到：本連動世界沒有嗜中性球實體。',
            claimIds: ['C-legacy-indep'] }
        ]
      },
      {
        id: 'tcell', name: 'T 細胞（家族概覽）', en: 'T Cell (family overview)', aliases: ['T cell', 'T細胞', 'T lymphocyte', 'CD8', 'CD4'],
        category: '免疫', capability: 'knowledge_only',
        capabilityNote: '知識；舊模型為高度簡化（單一 tcell 類型＋抗原閘門）。',
        headline: '不是一種細胞而是一個家族：毒殺、輔助、調節各有分工。',
        keyPoints: ['CD8 毒殺、CD4 輔助、Treg 調節', '以受器辨識特定抗原（MHC 呈現）', '舊場景僅以單一類型＋抗原閘門高度簡化'],
        qa: [
          { q: '我是誰、通常在哪裡？',
            a: 'T 細胞是淋巴球的一族，在胸腺成熟（T 即 thymus），分布於血液、淋巴結與組織。它不是單一細胞：CD8 毒殺性、CD4 輔助性與調節性 T 細胞各有分工。',
            claimIds: ['C-tcell-family'] },
          { q: '主要做什麼？',
            a: '以 T 細胞受器辨識被 MHC 呈現的特定抗原片段：CD8 辨識後攻擊受感染或異常細胞；CD4 協調其他免疫細胞的反應。',
            claimIds: ['C-tcell-family', 'C-tcell-mhc'] },
          { q: '和哪些結構或角色合作？',
            a: '與抗原呈現細胞（如巨噬細胞、樹突細胞）合作獲得呈現訊息；與 B 細胞協調體液免疫。舊場景以「巨噬吞噬→抗原呈現→T 啟動→毒殺」呈現此鏈。',
            claimIds: ['C-tcell-mhc'] },
          { q: '這個 demo 做到與沒做到什麼？',
            a: '做到：知識說明。舊獨立場景有「抗原呈現後啟動 T 細胞精準毒殺」的展示，但它把整個家族簡化成單一類型，且未與本連動世界共享狀態。沒做到：本連動世界沒有 T 細胞實體，無免疫模型。',
            claimIds: ['C-legacy-indep'] }
        ]
      },
      {
        id: 'platelet', name: '血小板', en: 'Platelet', aliases: ['platelet', '血栓細胞', 'thrombocyte', '凝血'],
        category: '血液成分', capability: 'knowledge_only',
        capabilityNote: '「細胞碎片」標籤——由巨核細胞脫落的碎片，不是有核細胞；不新增完整有核細胞模型。',
        headline: '不是完整的細胞，而是巨核細胞脫落的碎片——止血的修補工。',
        keyPoints: ['由骨髓巨核細胞脫落成碎片', '沒有細胞核，但有顆粒與骨架', '舊場景有傷緣凝血的簡化展示'],
        qa: [
          { q: '我是誰、通常在哪裡？',
            a: '血小板由骨髓中的巨核細胞脫落而成，是細胞碎片而非有核細胞，平時隨血流巡邏於血管內。',
            claimIds: ['C-plt-fragment'] },
          { q: '主要做什麼？',
            a: '血管破損時快速黏附、聚集形成栓子，配合凝血級聯止血；傷癒後消散或被清除。',
            claimIds: ['C-plt-hemostasis'] },
          { q: '和哪些結構或角色合作？',
            a: '與血管壁內皮、血漿凝血因子與纖維蛋白協作形成血塊；與免疫系統也有交互（本模型不涉及）。',
            claimIds: ['C-plt-hemostasis'] },
          { q: '這個 demo 做到與沒做到什麼？',
            a: '做到：知識說明與「細胞碎片」標示。舊獨立場景（index.html）有血小板傷緣凝血的展示（legacy_independent）。沒做到：本連動世界沒有血小板實體，也沒有傷口與凝血模型。',
            claimIds: ['C-legacy-indep'] }
        ]
      }
    ],

    /* 主張登錄：每條可被 QA 引用。contentType 見檔頭分級；
       reviewStatus：draft-pending（編輯草稿待審）｜verified-implementation（對照本版實作核對）。
       supportedLimit：這條知識的適用範圍限制。 */
    claims: {
      'C-rbc-morph':      { text: '人類成熟紅血球為雙凹圓盤形，直徑約 7–8 µm。', contentType: 'biology_reference', sourceIds: ['S2'], reviewStatus: 'verified', supportedLimit: '人類；形態學常識層級。' },
      'C-rbc-nucleus':    { text: '哺乳類成熟紅血球沒有細胞核。', contentType: 'biology_reference', sourceIds: ['S2'], reviewStatus: 'verified', supportedLimit: '哺乳類（含人類）；鳥類等例外。' },
      'C-rbc-lifespan':   { text: '人類紅血球生命週期約 120 天，由骨髓生成。', contentType: 'biology_reference', sourceIds: ['S2'], reviewStatus: 'verified', supportedLimit: '健康成人近似值。' },
      'C-rbc-hemo':       { text: '紅血球以血紅素攜帶氧，在肺部裝載、在組織釋出。', contentType: 'biology_reference', sourceIds: ['S1', 'S2'], reviewStatus: 'verified', supportedLimit: '概念層級；不含解離曲線。' },
      'C-hemo-iron':      { text: '血紅素是含鐵蛋白，鐵部位與氧可逆結合。', contentType: 'biology_reference', sourceIds: ['S2'], reviewStatus: 'verified', supportedLimit: '概念層級。' },
      'C-at1-thin':       { text: 'AT1 是極薄的大面積鱗狀上皮，覆蓋肺泡壁大部分表面。', contentType: 'biology_reference', sourceIds: ['S3', 'S4'], reviewStatus: 'verified', supportedLimit: '人肺組織學描述。' },
      'C-at1-gas':        { text: 'AT1 的薄壁是氣體擴散交換的結構條件。', contentType: 'biology_reference', sourceIds: ['S1', 'S3'], reviewStatus: 'verified', supportedLimit: '概念層級。' },
      'C-at2-shape':      { text: 'AT2 為立方形上皮，散布於肺泡壁。', contentType: 'biology_reference', sourceIds: ['S3'], reviewStatus: 'verified', supportedLimit: '人肺組織學描述。' },
      'C-at2-surf':       { text: 'AT2 合成分泌表面活性物質，降低肺泡表面張力。', contentType: 'biology_reference', sourceIds: ['S3'], reviewStatus: 'verified', supportedLimit: '概念層級；本模型無此變數。' },
      'C-at2-progenitor': { text: 'AT2 被認為是 AT1 受損後修補的細胞來源。', contentType: 'biology_reference', sourceIds: ['S3', 'S6'], reviewStatus: 'verified', supportedLimit: '文獻共識層級；細節仍在研究中。' },
      'C-ac-barrier':     { text: '肺泡氣血屏障由 AT1 上皮、基底膜與毛細血管內皮緊貼構成，氣體以極短距離擴散。', contentType: 'biology_reference', sourceIds: ['S1', 'S3'], reviewStatus: 'verified', supportedLimit: '組織學概念層級。' },
      'C-endo-interface': { text: '毛細血管內皮為單層扁平細胞，構成血液與組織間的選擇性界面。', contentType: 'biology_reference', sourceIds: ['S3', 'S5'], reviewStatus: 'verified', supportedLimit: '組織學概念層級。' },
      'C-alvmac-loc':     { text: '肺泡巨噬細胞駐留在肺泡腔與小氣道。', contentType: 'biology_reference', sourceIds: ['S3'], reviewStatus: 'verified', supportedLimit: '人肺。' },
      'C-alvmac-role':    { text: '肺泡巨噬細胞吞噬清除微粒、碎片與病原，是肺泡第一線防禦之一。', contentType: 'biology_reference', sourceIds: ['S3'], reviewStatus: 'verified', supportedLimit: '概念層級。' },
      'C-neut-share':     { text: '嗜中性球是白血球中占比最高的類型。', contentType: 'biology_reference', sourceIds: ['S2'], reviewStatus: 'verified', supportedLimit: '健康成人近似值。' },
      'C-neut-role':      { text: '嗜中性球沿趨化訊號招募到感染處，吞噬病原。', contentType: 'biology_reference', sourceIds: ['S2'], reviewStatus: 'verified', supportedLimit: '概念層級。' },
      'C-tcell-family':   { text: 'T 細胞為一族：CD8 毒殺、CD4 輔助、調節性 T 細胞各有分工。', contentType: 'biology_reference', sourceIds: ['S2', 'S6'], reviewStatus: 'verified', supportedLimit: '概念層級；不涉個案免疫判斷。' },
      'C-tcell-mhc':      { text: 'T 細胞以受器辨識 MHC 呈現的抗原片段後才作用。', contentType: 'biology_reference', sourceIds: ['S2'], reviewStatus: 'verified', supportedLimit: '概念層級。' },
      'C-plt-fragment':   { text: '血小板是骨髓巨核細胞脫落的細胞碎片，沒有細胞核。', contentType: 'biology_reference', sourceIds: ['S2'], reviewStatus: 'verified', supportedLimit: '哺乳類。' },
      'C-plt-hemostasis': { text: '血小板在血管破損處黏附聚集形成栓子，配合凝血級聯止血。', contentType: 'biology_reference', sourceIds: ['S2'], reviewStatus: 'verified', supportedLimit: '概念層級。' },
      /* 模型近似（對照本版實作核對） */
      'C-model-load':     { text: '本模型以 0–1 負載欄位近似攜帶狀態，無逐分子結合/解離。', contentType: 'model_assumption', sourceIds: [], implRef: 'js/loop/core.js（entity.load、交換規則）', reviewStatus: 'verified-implementation', supportedLimit: 'MODEL_VERSION 0.5.1；非 SpO₂。' },
      'C-model-48':       { text: '48 顆 RBC 為固定抽樣代表，數量不代表全身總量。', contentType: 'model_assumption', sourceIds: [], implRef: 'js/loop/core.js ENTITY_COUNT', reviewStatus: 'verified-implementation', supportedLimit: 'MODEL_VERSION 0.5.1。' },
      'C-model-aggregate':{ text: '肺端/組織端交換由聚合界面規則處理，沒有個別上皮/內皮細胞實體。', contentType: 'model_assumption', sourceIds: [], implRef: 'js/loop/model.js（edges exchange）', reviewStatus: 'verified-implementation', supportedLimit: 'MODEL_VERSION 0.5.1。' },
      'C-model-lungsupply': { text: 'lungSupply 參數同時作用於外部輸入項與肺端交換項，不是吸入氧濃度。', contentType: 'model_assumption', sourceIds: [], implRef: 'js/loop/core.js step() 輸入項與 lung 交換', reviewStatus: 'verified-implementation', supportedLimit: 'MODEL_VERSION 0.5.1。' },
      'C-model-flowspeed':  { text: 'flowSpeed 等比縮放各邊跨越時間，不是心率或血壓。', contentType: 'model_assumption', sourceIds: [], implRef: 'js/loop/model.js baseTicks', reviewStatus: 'verified-implementation', supportedLimit: 'MODEL_VERSION 0.5.1。' },
      'C-model-tissuedemand': { text: 'tissueDemand 同時作用於組織端交換與使用項，非單一真實生理量。', contentType: 'model_assumption', sourceIds: [], implRef: 'js/loop/core.js step() 組織交換與使用', reviewStatus: 'verified-implementation', supportedLimit: 'MODEL_VERSION 0.5.1。' },
      'C-legacy-indep':   { text: '舊八場景（index.html）與本連動世界無共享模型狀態。', contentType: 'model_assumption', sourceIds: [], implRef: 'docs/LOOP-NOTES.md 執行節', reviewStatus: 'verified-implementation', supportedLimit: '架構邊界。' },
      'C-model-co2':      { text: 'CO₂ 以 0–1 指數近似：組織隨使用量生產、肺端隨通氣排出；Bohr 效應以卸載倍率（0.75–1.35）近似。', contentType: 'model_assumption', sourceIds: [], implRef: 'js/loop/core.js co2 與 step() Bohr 項', reviewStatus: 'verified', supportedLimit: 'MODEL_VERSION 0.5.1；模型指數，非臨床酸鹼值。' },
      'C-model-temp':     { text: '體溫以 Q10 因子（2^((T−37)/10)）乘 O₂ 使用速率；CO₂ 生產隨使用量連動。', contentType: 'model_assumption', sourceIds: [], implRef: 'js/loop/core.js step() q10 項', reviewStatus: 'draft-pending', supportedLimit: 'MODEL_VERSION 0.5.1；工程近似，非體溫調節模型。' }
    },

    /* 分類對應（示例）：exact/broader/related/unmapped，不捏造標準 ontology ID */
    classification: [
      { cardId: 'rbc', mappings: [{ kind: 'exact', label: '紅血球／erythrocyte', note: '一般血液學分類' }] },
      { cardId: 'at1', mappings: [{ kind: 'related', label: '肺泡上皮細胞（HLCA 大類）', note: 'HLCA 將 AT1/AT2 分列；此處標 related 以避免偽稱精確對應', ref: 'S6' }] },
      { cardId: 'at2', mappings: [{ kind: 'related', label: '肺泡上皮細胞（HLCA 大類）', note: '同上', ref: 'S6' }] },
      { cardId: 'endothelium', mappings: [{ kind: 'broader', label: '內皮細胞', note: '泛血管內皮' }] },
      { cardId: 'alv-mac', mappings: [{ kind: 'exact', label: '肺泡巨噬細胞', note: 'HLCA 有對應族群', ref: 'S6' }] },
      { cardId: 'neutrophil', mappings: [{ kind: 'exact', label: '嗜中性球', note: '' }] },
      { cardId: 'tcell', mappings: [{ kind: 'broader', label: 'T 細胞家族', note: '家族概覽，不對應單一亞群' }] },
      { cardId: 'platelet', mappings: [{ kind: 'unmapped', label: '血小板為細胞碎片，非細胞類型', note: '不以細胞 ontology 對應' }] }
    ],

    /* 搜尋別名補充（常見縮寫與英文名） */
    searchNote: '支援繁中、英文與 RBC／erythrocyte 等別名；未收錄的問題明示「此版尚未提供」。'
  };
})(typeof window !== 'undefined' ? window : globalThis);
