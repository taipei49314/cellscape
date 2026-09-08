/* ============================================================
   CELLSCAPE · data.js
   資料層：器官 / 細胞類型 / 情境腳本 + 對外擴充 API
   本檔即「可程式化」核心——所有內容皆為宣告式資料，
   可透過 window.CELLSCAPE.register* 動態擴充。
   ============================================================ */
(function () {
  const CS = (window.CS = window.CS || {});
  const DATA = (CS.DATA = { organs: {}, cellTypes: {}, scenarios: {} });

  /* ---------------- 細胞類型知識庫 ---------------- */
  const CT = (DATA.cellTypes = {
    rbc: {
      name: '紅血球', en: 'Erythrocyte', color: '#ff5d73', r: 7, shape: 'disc',
      role: '氧氣運輸', speed: 0,
      desc: '雙凹圓盤狀、不含細胞核，以血紅素結合氧氣與二氧化碳。一生約遊歷 120 天、繞行身體數萬圈。',
    },
    neutrophil: {
      name: '嗜中性球', en: 'Neutrophil', color: '#ffd166', r: 10, shape: 'blob',
      role: '免疫先鋒', speed: 42, receptors: ['danger', 'chemokine'],
      emits: ['ROS 活性氧', '彈性蛋白酶', 'IL-1'],
      desc: '感染後最先抵達戰場的白血球，以變形蟲運動追擊病原體，吞噬後往往自我犧牲形成膿的成分。',
    },
    macrophage: {
      name: '巨噬細胞', en: 'Macrophage', color: '#4dd6c1', r: 16, shape: 'blob',
      role: '巡邏·吞噬·抗原呈現', speed: 16, receptors: ['danger', 'chemokine', 'growth'],
      emits: ['IL-6', 'IL-8 趨化因子', 'TNF-α', '抗原呈現'],
      desc: '組織中的常駐清道夫。吞噬病原體與凋亡殘骸，消化後將抗原呈現給 T 細胞——是先天與適應免疫的橋樑。',
    },
    tcell: {
      name: 'CD8 殺手 T 細胞', en: 'Cytotoxic T Cell', color: '#7aa2ff', r: 11, shape: 'blob',
      role: '精準毒殺病變細胞', speed: 34, receptors: ['antigen', 'chemokine'],
      emits: ['穿孔素', '顆粒酶', 'IFN-γ'],
      desc: '需要抗原呈現才會啟動的精準武器。辨認 MHC-I 上的異常片段後，以穿孔素在目標細胞膜打孔誘導凋亡。',
    },
    platelet: {
      name: '血小板', en: 'Platelet', color: '#ffcf6e', r: 6, shape: 'star',
      role: '凝血·傷口封堵', speed: 0, emits: ['PDGF', '凝血因子', '血清素'],
      desc: '骨髓巨核細胞掉落的碎片。碰到傷口即活化、變形並互相交聯，與纖維蛋白織成止血栓，同時釋放生長因子招募修復細胞。',
    },
    bacterium: {
      name: '病原菌', en: 'Pathogenic Bacterium', color: '#b7ff4a', r: 8, shape: 'rod',
      role: '病原體', speed: 26, emits: ['PAMP', '內毒素'],
      desc: '具鞭毛的入侵者，藉 PAMP 分子暴露自己，也在宿主細胞間穿行、繁殖並釋放毒素破壞組織。',
    },
    epithelial: {
      name: '上皮細胞', en: 'Epithelial Cell', color: '#86e3ff', r: 12, shape: 'hex',
      role: '屏障與交換介面', speed: 0, infectable: true, emits: ['防菌肽'],
      desc: '鋪排在體表與腔面的緻密屏障，同時負責物質交換；受損時由基底層快速分裂補齊。',
    },
    enterocyte: {
      name: '腸上皮細胞', en: 'Enterocyte', color: '#ffd98a', r: 12, shape: 'columnar',
      role: '吸收營養·屏障', speed: 0, infectable: true, emits: ['黏液', '防御素'],
      desc: '小腸絨毛上的吸收細胞，每 3～5 天整層更新一次，是身體換新最快的細胞族群之一。',
    },
    microbiome: {
      name: '共生菌', en: 'Commensal Microbiota', color: '#6ee7a8', r: 5, shape: 'rod',
      role: '共生夥伴', speed: 20, emits: ['短鏈脂肪酸'],
      desc: '常駐腸道的益菌：協助消化、合成維生素 K，並佔據生態位阻擋病原菌——發炎時會主動避開戰區。',
    },
    hepatocyte: {
      name: '肝細胞', en: 'Hepatocyte', color: '#ffb46b', r: 14, shape: 'hex',
      role: '代謝·解毒·合成', speed: 0, infectable: true, emits: ['白蛋白', 'IGF-1'],
      desc: '人體的生化工廠：解毒、代謝醣脂蛋白、製造膽汁。即使切除 2/3 也能再生回復原量。',
    },
    alveolar: {
      name: '肺泡上皮細胞', en: 'Alveolar Cell', color: '#a5f0e8', r: 13, shape: 'ring',
      role: '氣體交換', speed: 0, infectable: true, emits: ['介面活性劑'],
      desc: '構成肺泡壁的極薄上皮（I 型）與分泌介面活性劑的 II 型細胞，讓氧氣只需擴散 0.5 μm 便能入血。',
    },
    neuron: {
      name: '神經元', en: 'Neuron', color: '#c9b3ff', r: 10, shape: 'neuron',
      role: '電位訊號傳導', speed: 0, emits: ['動作電位', '麩胺酸', '多巴胺'],
      desc: '以 120 m/s 的動作電位傳遞訊息，經突觸釋放神經傳遞物；人腦約有 860 億顆互相連結。',
    },
    glia: {
      name: '星狀膠細胞', en: 'Astrocyte', color: '#8fb3d9', r: 9, shape: 'blob',
      role: '支持·營養·恆定', speed: 0, emits: ['GDNF', '鉀離子緩衝'],
      desc: '神經系統的照護者：供能、回收神經傳遞物、維持離子平衡，並構成血腦屏障的一部份。',
    },
    microglia: {
      name: '微膠細胞', en: 'Microglia', color: '#4dd6c1', r: 13, shape: 'blob',
      role: '腦內免疫巡邏', speed: 14, receptors: ['danger', 'chemokine'],
      emits: ['IL-6', 'TNF-α', '抗原呈現'],
      desc: '中樞神經的常駐免疫細胞，不斷以突起觸探突觸、清除碎片與病原，過度活化則與神經退化相關。',
    },
    cardiomyocyte: {
      name: '心肌細胞', en: 'Cardiomyocyte', color: '#ff8fa3', r: 13, shape: 'oval',
      role: '節律收縮', speed: 0, infectable: true, emits: ['鈣離子耦合', 'BNP'],
      desc: '以閏盤相連、電訊號同步，讓心房心室依竇房結節律整體收縮——一生跳動約 25 億次。',
    },
    hsc: {
      name: '造血幹細胞', en: 'Hematopoietic Stem Cell', color: '#b8fff4', r: 11, shape: 'blob',
      role: '分化製造血球', speed: 4, emits: ['幹擾 niche 訊號'],
      desc: '駐守骨髓 niche 的萬能種子，每天分化出約 2000 億顆血球：紅血球、白血球與血小板皆源於它。',
    },
    keratinocyte: {
      name: '角質細胞', en: 'Keratinocyte', color: '#f2c9a0', r: 11, shape: 'poly',
      role: '皮膚屏障更新', speed: 0, infectable: true, emits: ['介白素-1', '防菌肽'],
      desc: '表皮的主力細胞，自基層緩慢向上遷移、逐漸角化，最後脫落——整層表皮約 28 天完全換新。',
    },
    langerhans: {
      name: '蘭格漢氏細胞', en: 'Langerhans Cell', color: '#d7b34d', r: 12, shape: 'dendritic',
      role: '皮膚免疫哨兵', speed: 18, receptors: ['danger', 'chemokine'],
      emits: ['抗原呈現', 'IL-12'],
      desc: '表皮中的樹突狀哨兵，伸出長突起攔截穿透屏障的病原，捕獲後遷徙至淋巴結教導 T 細胞辨敵。',
    },
    fibroblast: {
      name: '纖維母細胞', en: 'Fibroblast', color: '#9fe8c2', r: 12, shape: 'spindle',
      role: '膠原蛋白·修復', speed: 15, receptors: ['growth', 'chemokine'],
      emits: ['膠原蛋白', 'TGF-β'],
      desc: '結締組織的工程師，沿纖維爬行至傷口分泌膠原蛋白與細胞外基質，是癒合與疤痕的幕後推手。',
    },
    cancer: {
      name: '癌細胞', en: 'Cancer Cell', color: '#ff5ce1', r: 13, shape: 'irregular',
      role: '異常增殖', speed: 6, emits: ['免疫抑制訊號', 'VEGF', '腫瘤抗原'],
      desc: '基因突變累積後逃脫細胞週期管制：無限分裂、拒絕凋亡，並可能下调 MHC-I 逃過免疫監視。',
    },
  });

  /* ---------------- 器官定義（含微觀世界佈局） ---------------- */
  const ORG = (DATA.organs = {
    blood: {
      id: 'blood', name: '血液', en: 'Bloodstream', color: '#ff5d73',
      glyph: '血', bodyPos: [62, 54],
      brief: '氧氣、養分與免疫細胞的高速運輸網',
      ambient: [
        '紅血球列隊穿越微血管，把氧氣交給等待中的細胞。',
        '血流剪力平穩——內皮細胞釋放一氧化氮維持血管舒張。',
        '血漿中養分充足，血糖恆定於 90 mg/dL。',
      ],
      micro: { bg: 'vessel', flow: { ax: 1, ay: 0, strength: 58 }, zoom: 0.9 },
    },
    heart: {
      id: 'heart', name: '心臟', en: 'Heart', color: '#ff8fa3',
      glyph: '心', bodyPos: [40, 64],
      brief: '每分鐘 70 次的節律幫浦',
      ambient: [
        '竇房結放電——收縮波自心房掃向心室。',
        '閏盤電耦合良好，心肌同步收縮無一事故。',
        '冠狀循環灌注充足，心肌耗氧與供氧平衡。',
      ],
      micro: { bg: 'fiber', flow: { strength: 22 }, zoom: 0.85, pulse: true },
    },
    lungs: {
      id: 'lungs', name: '肺臟', en: 'Lungs', color: '#7fd8e8',
      glyph: '肺', bodyPos: [46, 44],
      brief: '三億個肺泡組成的氣體交換面',
      ambient: [
        '肺泡張縮之間，氧氣擴散入血、二氧化碳離開。',
        'II 型細胞補充介面活性劑，肺泡保持擴張。',
        '肺泡巨噬細胞緩步巡視，吞除吸入的塵埃。',
      ],
      micro: { bg: 'alveoli', flow: { strength: 10 }, zoom: 0.85 },
    },
    brain: {
      id: 'brain', name: '腦', en: 'Brain', color: '#b78bff',
      glyph: '腦', bodyPos: [50, 14],
      brief: '860 億神經元的電化學宇宙',
      ambient: [
        '神經網路泛起漣漪——動作電位沿軸突傳導。',
        '微膠細胞以突起輕觸突觸，執行例行巡查。',
        '膠細胞穩定離子梯度，神經元待發。',
      ],
      micro: { bg: 'neural', flow: { strength: 2 }, zoom: 0.95 },
    },
    liver: {
      id: 'liver', name: '肝臟', en: 'Liver', color: '#ffb46b',
      glyph: '肝', bodyPos: [60, 80],
      brief: '人體最大的生化工廠',
      ambient: [
        '肝竇血流緩慢——肝細胞從容地過濾與代謝。',
        '解毒酶系統全速運轉，代謝產物經膽汁排出。',
        '肝細胞保持接觸抑制，靜謐而有序。',
      ],
      micro: { bg: 'hex', flow: { strength: 30 }, zoom: 0.9 },
    },
    gut: {
      id: 'gut', name: '腸道', en: 'Intestine', color: '#ffd98a',
      glyph: '腸', bodyPos: [52, 98],
      brief: '絨毛、菌相與 70% 的免疫前線',
      ambient: [
        '絨毛擺動，營養份經上皮入血。',
        '共生菌安分守己，生態位穩固。',
        '杯狀細胞分泌黏液——屏障厚度恆定。',
      ],
      micro: { bg: 'villi', flow: { strength: 8 }, zoom: 0.9 },
    },
    marrow: {
      id: 'marrow', name: '骨髓', en: 'Bone Marrow', color: '#e8d9b0',
      glyph: '髓', bodyPos: [40, 140],
      brief: '每天產出 2000 億顆血球的造血工坊',
      ambient: [
        '造血幹細胞分化中——紅血球系正滿載生產。',
        '竇狀微血管放行新生的血球入血流。',
        'niche 訊號平穩，幹細胞池保持靜止與更新平衡。',
      ],
      micro: { bg: 'trabecula', flow: { strength: 10 }, zoom: 1.0 },
    },
    skin: {
      id: 'skin', name: '皮膚', en: 'Skin', color: '#f2b98a',
      glyph: '膚', bodyPos: [29, 50],
      brief: '最大的器官：免疫與屏障的最前線',
      ambient: [
        '角質細胞緩慢向上遷移，表皮如期更新。',
        '蘭格漢氏細胞的突起在表皮間穿梭巡查。',
        '皮脂膜 pH 5.5——屏障完好。',
      ],
      micro: { bg: 'layers', flow: { strength: 4 }, zoom: 1.0 },
    },
  });

  /* 身體輪廓（100 × 200 座標空間，x 對稱；左半由上至下，尾端接近中線） */
  DATA.bodyPath = [
    [46, 26], [22, 34],
    [20, 56], [23, 78], [27, 92], [26, 110],
    [28, 128], [29, 152], [31, 174], [34, 187], [42, 194], [44, 185],
    [40, 160], [42, 138], [47, 114], [50, 113],
  ];
  DATA.bodyVessels = [
    [[40, 64], [46, 54], [46, 45]],
    [[40, 64], [48, 50], [50, 32], [50, 22]],
    [[40, 64], [52, 70], [58, 78], [60, 82]],
    [[40, 64], [46, 80], [52, 92], [52, 97]],
    [[40, 64], [38, 90], [40, 118], [40, 139]],
    [[40, 64], [35, 55], [30, 49]],
  ];

  /* ---------------- 情境腳本 ---------------- */
  const SCN = (DATA.scenarios = {
    normal: {
      id: 'normal', name: '正常恆定', en: 'Homeostasis', color: '#4de3ff',
      intro: '恆定模擬中——細胞依生理節律靜謐運作。',
      script: [],
      loop: { every: 8, act: 'ambient' },
    },
    infection: {
      id: 'infection', name: '細菌感染', en: 'Bacterial Infection', color: '#ff5470',
      intro: '情境載入：屏障破損，病原體入侵微環境。',
      script: [
        { t: 0.6, phase: '入侵期', msg: '病原體自破口湧入——PAMP 分子暴露在胞外環境。', act: 'spawnPathogens', n: 14 },
        { t: 3.2, phase: '偵測期', msg: '組織哨兵偵測到病原體，釋放危險訊號（DAMP / IL-1）。', act: 'dangerBurst' },
        { t: 5.4, phase: '動員期', msg: '巨噬細胞釋放 IL-8 趨化因子，向全系統求援。', act: 'chemoBurst' },
        { t: 7.2, msg: '嗜中性球自微血管湧入戰場，變形蟲運動全速展開。', act: 'recruitNeutrophils', n: 8 },
        { t: 10, msg: '發炎反應展開：血管擴張、血漿滲出、局部溫度上升。', act: 'inflammation', v: 0.65 },
        { t: 13, msg: 'T 細胞進入待命——抗原呈現確認後將啟動精準毒殺。', act: 'alertT' },
      ],
      loop: { every: 7, act: 'topUpPathogens', maxBact: 26 },
      resolve: { msg: '病原體全數清除——發炎回落，組織逐步恢復恆定。', phase: '痊癒', act: 'settle' },
    },
    repair: {
      id: 'repair', name: '組織修復', en: 'Tissue Repair', color: '#7dffa8',
      intro: '情境載入：機械性損傷——微血管破裂，組織缺損。',
      script: [
        { t: 0.5, phase: '損傷期', act: 'makeWound' },
        { t: 0.9, phase: '止血期', msg: '血小板附著傷緣，纖維蛋白網開始交聯成栓。', act: 'growthBurst' },
        { t: 4, phase: '增生期', msg: '血小板釋放 PDGF——招募纖維母細胞與巨噬細胞。', act: 'recruitRepair' },
        { t: 7, msg: '纖維母細胞沉積膠原蛋白，肉芽組織填補缺損。' },
        { t: 15, phase: '重塑期', msg: '膠原重塑與血管再生進行中……' },
      ],
      resolve: { msg: '傷口閉合——膠原持續重塑，留下淡色疤痕。', phase: '完成', act: 'woundDone' },
    },
    cancer: {
      id: 'cancer', name: '癌化病變', en: 'Tumorigenesis', color: '#ff5ce1',
      intro: '情境載入：DNA 受損逃過修復——細胞週期即將失控。',
      script: [
        { t: 1, phase: '突變期', act: 'mutateOne' },
        { t: 1.3, msg: '關鍵基因突變：p53 失去監控，細胞拒絕凋亡。' },
        { t: 5.5, phase: '增生期', msg: '異常細胞開始無限增殖，堆積成微小腫瘤。' },
        { t: 9.5, msg: '腫瘤微環境釋放異常訊號，免疫哨兵趨近巡查。', act: 'alertMacs' },
        { t: 12.5, phase: '辨認期', msg: '巨噬細胞呈現腫瘤抗原——CD8 T 細胞獲得敵情辨認。', act: 'presentAntigen' },
        { t: 14.5, phase: '攻擊期', msg: '殺手 T 細胞展開毒殺：穿孔素／顆粒酶攻擊！', act: 'activateT' },
      ],
      loop: { every: 9, act: 'cancerTwist' },
      resolve: { msg: '免疫監視成功——病變細胞全數清除。', phase: '清除', act: 'settle' },
      fail: { msg: '免疫逃逸成功——腫瘤持續增生，模擬轉為紅色警示。', phase: '失控', alert: true },
    },
  });

  /* ---------------- 對外擴充 API（可程式化核心） ---------------- */
  CS.API = {
    registerCellType(id, def) {
      DATA.cellTypes[id] = normalize(id, def);
      if (CS.UI && CS.UI.buildRail) CS.UI.buildRail();
    },
    registerOrgan(id, def) {
      DATA.organs[id] = normalize(id, def);
      if (CS.UI && CS.UI.buildRail) CS.UI.buildRail();
    },
    registerScenario(id, def) {
      DATA.scenarios[id] = normalize(id, def);
      if (CS.UI && CS.UI.buildChips) CS.UI.buildChips();
    },
    /** 進入器官並套用情境：CELLSCAPE.run('lungs','infection') */
    run(organId, scenarioId) { if (CS.Main) CS.Main.run(organId, scenarioId); },
    get state() { return CS.Engine ? CS.Engine.snapshot() : null; },
  };
  window.CELLSCAPE = CS.API;

  /* 全欄位透傳：行為宣告（speed/receptors/emits/infectable）與情境生命週期
     （loop/resolve/fail）皆為契約的一部分，不得丟棄。 */
  function normalize(id, def) {
    const o = Object.assign({ id }, def);
    if (!o.color) o.color = '#4de3ff';
    return o;
  }
})();
