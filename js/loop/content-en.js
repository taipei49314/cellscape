/* ============================================================
   CELLSCAPE Living Atlas — content-en.js（T-299 刀 C3）
   content.js（v0.3.0-content.5）的英文覆蓋層：純資料、無可執行邏輯。
   邊界：
   - 本檔是「平行翻譯層」，不改寫 content.js 的正本與證據分級；
     層級與聲明沿用各角色卡／主張登錄（reviewStatus 不因翻譯改變）。
   - 缺鍵時由 i18n.js 退回繁中原文並保持顯示一致；tour.js 導覽字幕
     屬凍結檔，本輪仍為繁中（切換 EN 時不隱藏、不假裝已翻譯）。
   - 修改 content.js 的 zh 內容時，必須同步核對本檔對應鍵。
   ============================================================ */
(function (global) {
  'use strict';
  const CSL = global.CSL || (global.CSL = {});

  CSL.ContentEN = {
    enVersion: 'content-en.1',
    mirrors: 'v0.3.0-content.5',

    /* 殼層字串（loop.html data-i18n 與 atlas 標題） */
    shell: {
      'hud.alv': 'Alveolar level',
      'hud.tis': 'Tissue level',
      'hud.mean': 'Mean load',
      'hud.warm': 'Warming up · readings not yet stable',
      'hud.stable': 'Readings stable',
      'hud.adjusting': 'Adjusting · readings shifting',
      'hud.delta': 'vs pre-intervention reference',
      'hud.imm': 'Infection {sev} · WBC {wbc}/8 (model units)',
      'hud.branchA': 'A baseline (live): alv {a}% / tis {s}% / load {m}   now−A: {d}',
      'tab.know': 'Know it', 'tab.now': 'Right now', 'tab.mech': 'How it works', 'tab.src': 'Sources',
      'nav.follow': '◎ Follow a red blood cell',
      'tour.prev': '◀ Previous step',
      'tour.replay': '↻ Replay this step',
      'tour.next': 'Next step ▶',
      'learn.entry': '📘 Learning chapters',
      'hemo.entry': '🔎 Hemoglobin zoom (model field)',
      'params.perfusion': 'Tissue perfusion',
      'view.explore': 'Free exploration', 'view.overview': 'Circulation overview',
      'view.lung': 'Lung micro-view', 'view.tissue': 'Tissue exchange',
      'panel.events': 'Event log', 'panel.inspector': 'Inspector',
      'export': 'Export JSON', 'import': 'Import JSON',
      'landing.desc1': 'A continuously running circulatory world: follow the same red blood cell',
      'landing.desc2': 'from the lung capillaries, through the heart and systemic loop, into the tissues — and back to the lungs.',
      'landing.note1': 'Simplified oxygen model · internal values are model units, not SpO₂ or clinical values',
      'landing.note2': 'The tour advances by model conditions · you can interrupt anytime, explore freely, and compare branches',
      'params.title': 'Model parameters (adjustable in Explore)',
      'params.lung': 'Lung oxygen supply', 'params.flow': 'Circulation flow speed', 'params.demand': 'Tissue demand', 'params.anemia': 'Anaemia severity', 'params.temperature': 'Body temperature (°C, model)', 'params.altitude': 'Altitude (m)', 'params.fluidRate': 'Fluid intake (model units/tick)', 'params.infection': 'Infection severity (tissue, model index)', 'params.glucoseIntake': 'Carbohydrate intake (model units/tick)',
      'params.note': 'Tissue colour scale = tissue oxygen stock level (a model field), not a diagnostic image.',
      'drug.label': 'Drug interventions (model presets, not medical advice)',
      'drug.bronchodilator': 'Bronchodilator', 'drug.betaBlocker': 'Beta-blocker',
      'drug.fever': 'Sepsis (fever)', 'drug.baseline': 'Reset to baseline', 'drug.transfusion': 'Transfusion (improves anaemia)', 'drug.antipyretic': 'Antipyretic (reduces fever)', 'drug.altitude': 'Ascend to altitude (4,000 m)', 'drug.heatstroke': 'Heat stroke (hot & dehydrated)', 'drug.infusion': 'IV fluids (rehydrate)', 'drug.infection': 'Tissue infection', 'drug.meal': 'Meal (continuous intake)', 'drug.fasting': 'Fasting (stop intake)',
      'drug.note.bronchodilator': 'Drug intervention (model): bronchodilator — lung oxygen supply raised to 1.00. Model units, not medical advice.',
      'drug.note.betaBlocker': 'Drug intervention (model): beta-blocker — circulation flow speed lowered to 0.60. Model units, not medical advice.',
      'drug.note.fever': 'Drug intervention (model): fever / sepsis — tissue demand raised to 0.85. Model units, not medical advice.',
      'drug.note.baseline': 'Drug intervention (model): parameters reset to baseline values.',
      'drug.note.transfusion': 'Drug intervention (model): transfusion — anaemia severity reset to zero. Model units, not medical advice.',
      'drug.note.altitude': 'Drug intervention (model): ascend to altitude — altitude set to 4,000 m (inspired oxygen falls, hyperventilation rises). Model units, not travel or health advice.',
      'drug.note.heatstroke': 'Drug intervention (model): heat stroke — body temperature set to 40 °C with no fluid intake (sweating drains plasma volume; volFrac scales flow and unloading). Model units, not medical advice.',
      'drug.note.infusion': 'Drug intervention (model): IV fluids — fluid intake set to 0.004/tick (replenishes plasma volume). Model units, not medical advice.',
      'drug.note.infection': 'Drug intervention (model): tissue infection — neutrophils recruited from the marrow pool, extravasating at the tissue capillary (0.125 severity cleared each). Model units, not medical advice.',
      'drug.note.meal': 'Drug intervention (model): meal — continuous carbohydrate intake at 0.02/tick (glucose index rises, insulin secreted, tissue uptake accelerates). Model units, not medical advice.',
      'drug.note.fasting': 'Drug intervention (model): fasting — carbohydrate intake stopped (glucose index falls back as tissue uptake continues). Model units, not medical advice.',
      'drug.note.antipyretic': 'Drug intervention (model): antipyretic — body temperature back to 37.0 °C. Model units, not medical advice.',
      'inside.entry': '🔬 Cell interior (schematic)',
      'mech.knowledgeNote': 'This card is knowledge / structural background; exchanges in this linked world are approximated by aggregate rules (see the rules block on the red blood cell card).',
      'src.usage': 'Scope of use', 'src.assetNote': 'Asset notice', 'src.checked': 'Checked on',
      'meta.impl': 'Implementation reference', 'meta.limit': 'Applicability limit', 'meta.basis': 'Basis',
      'hud.inspector': 'Atlas inspector', 'hud.pathProgress': 'Path progress', 'hud.loops': 'Loops completed',
      'hud.o2load': 'Oxygen load (load)', 'hud.loadNote': 'load is a model field (0–1 model units), not SpO₂.',
      'hud.eventsHint': 'Click an event to expand its parent chain',
      'search.placeholder': 'Search roles / questions (zh · EN · RBC…)',
      'src.warn': '“A source exists” does not mean “the claim is supported by that source” — biology_reference entries were ruled verified as a batch by the owner, not reviewed claim by claim; model_assumption entries only state that the code matches the wording. Some entries are still pending; the reviewStatus of each claim is authoritative.'
    },

    /* 「看此刻」觀察散文：{var} 佔位模板；語義契約逐句保留
       （缺資料不冒充零、零通量不宣稱交換、未取得窗口不推測）。 */
    now: {
      noEntity: 'No red blood cell selected — click a cell in the scene, or use “Follow a red blood cell”.',
      lungLoading: 'Measured lung loading flux over the last 3 model-seconds: ≈ {rate} model units / model-second.',
      lungZero: 'In the lung exchange region; measured flux over the recent window was zero — no “loading” is claimed.',
      lungWindow: 'In the lung exchange region; observation window not yet filled ({have}/{need} ticks) — exchange state is not guessed.',
      tissueUnloading: 'Measured tissue unloading flux over the last 3 model-seconds: ≈ {rate} model units / model-second.',
      tissueZero: 'In the tissue exchange region; measured flux over the recent window was zero — no “unloading” is claimed.',
      tissueWindow: 'In the tissue exchange region; observation window not yet filled ({have}/{need} ticks) — exchange state is not guessed.',
      nonExchange: 'On {label} (not an exchange segment) — no exchange is provable on this segment.',
      changeMissing: 'Recent load change: insufficient data (few samples for this entity so far).',
      changeMeasured: 'Recent load change (observed {sec} model-seconds): {text}{delta}.',
      covMissing: 'Observation coverage: selection just changed or world just imported — no history samples for this entity yet (missing data is stated, not fabricated).',
      covMeasured: 'Observation coverage: about {sec} model-seconds observed within the window (gaps excluded).',
      cardNoteKnowledge: 'The current card “{name}” is a knowledge card (not individually simulated in this linked mode); the values below come from your selected red blood cell.',
      cardNoteAggregate: 'The current card “{name}” is an aggregate approximation (not individually simulated in this linked mode); the values below come from your selected red blood cell.',
      roMissingWindow: 'missing data (window {have}/{need} ticks)',
      roNoEntity: 'no entity selected',
      roMissing: 'missing data',
      vcLine: 'session #{session} · branch {branch} · run {run} · tick {tick} · entity {entity}',
      vcLine2: 'content pack {content} · observation rules {obs}',
      defaultsNote: 'The first three rows are default readouts; the other four expand.',
      rateLung: 'Lung loading',
      rateTissue: 'Tissue unloading',
      rateUsage: 'Tissue usage',
      modelSecUnit: 'model seconds',
      nowLabel: 'now',
      chartIntervention: 'intervention',
      rateDisabled: 'Observation module disabled (stated, not hidden)',
      rateMissing: 'Missing data: the rate window has not filled yet',
      rateNoteMissing: 'No rate curve yet - an unfilled window is missing data, not zero, and is never drawn as a flat or dashed line.',
      rateNoteOk: 'Rates use a {win} model-second rolling window (model units per model second); y-axis max {max}. {obs}/{total} points observed; the rest are missing data and are left blank (never interpolated).',
      expandLedger: 'Expand conservation ledger and rule details',
      ledgerLine: 'Conservation ledger (checked every 30 ticks, residual ≤1e-6): initial {initial}, cumulative input {input}, usage {usage}, exhaled {expelled}, latest residual {residual}.',
      spo2Note: 'Percentages here are relative to model capacity, not SpO₂; rates are converted in model time (dt = 1/30 model-seconds).',
      co2Line: 'Blood CO₂ index {co2} — model index (C-model-co2), not a clinical value.'
    },

    capabilityLegend: {
      dynamic:           { label: 'Dynamic model entity', note: 'Has an ID and live model fields; behaviour is a simplified model' },
      aggregate:         { label: 'Aggregate approximation', note: 'Handled by aggregate interface / stock rules, not individual cells' },
      knowledge_only:    { label: 'Knowledge / schematic', note: 'Readable and viewable, no live model values' },
      legacy_independent:{ label: 'Legacy standalone', note: 'Exists only in the old index.html scenes; shares no state with this linked world' },
      not_supported:     { label: 'Not supported', note: 'No corresponding capability yet' }
    },

    readouts: {
      sel_load:         { name: 'Selected RBC oxygen load', note: 'Relative to model capacity — not SpO₂.' },
      tissue_level:     { name: 'Tissue stock level', note: 'Aggregate stock level, not a diagnostic image.' },
      flux_tissue_rate: { name: 'Delivery rate (RBC → tissue)', note: 'Window N=90 ticks (3 model-seconds); shown only with a full window.' },
      alveolar_level:   { name: 'Alveolar stock level', note: '' },
      flux_lung_rate:   { name: 'Lung loading rate (alveolus → RBC)', note: 'Window N=90 ticks; shown only with a full window.' },
      usage_rate:       { name: 'Tissue usage rate', note: 'Differenced from the cumulative usage ledger; requires a full window.' },
      co2_blood:        { name: 'Blood CO₂ index', note: 'Aggregate model index — not blood acidity or a clinical measurement.' }
    },

    /* 主張登錄的英文對照（鍵與 content.js claims 一一對應） */
    claims: {
      'C-rbc-morph':      'Human mature red blood cells are biconcave discs about 7–8 µm across.',
      'C-rbc-nucleus':    'Mature mammalian red blood cells have no nucleus.',
      'C-rbc-lifespan':   'Human red blood cells live about 120 days and are produced in the bone marrow.',
      'C-rbc-hemo':       'Red blood cells carry oxygen via hemoglobin — loaded in the lungs, released in the tissues.',
      'C-hemo-iron':      'Hemoglobin is an iron-containing protein; oxygen binds reversibly at its iron sites.',
      'C-at1-thin':       'AT1 cells are extremely thin, large-area squamous epithelial cells covering most of the alveolar wall.',
      'C-at1-gas':        'The thin wall of AT1 cells is the structural condition for short-distance gas diffusion.',
      'C-at2-shape':      'AT2 cells are cuboidal epithelial cells scattered along the alveolar wall.',
      'C-at2-surf':       'AT2 cells synthesize and secrete surfactant, lowering the alveolar surface tension.',
      'C-at2-progenitor': 'AT2 cells are considered a cellular source for repairing damaged AT1 cells.',
      'C-ac-barrier':     'The alveolar air–blood barrier is formed by AT1 epithelium, basement membrane and capillary endothelium pressed together, so gases diffuse over a very short distance.',
      'C-endo-interface': 'Capillary endothelium is a single layer of flat cells forming a selective interface between blood and tissue.',
      'C-alvmac-loc':     'Alveolar macrophages reside in the alveolar spaces and small airways.',
      'C-alvmac-role':    'Alveolar macrophages engulf and clear particles, debris and pathogens — a first-line defence of the alveoli.',
      'C-neut-share':     'Neutrophils are the most abundant type of white blood cell.',
      'C-neut-role':      'Neutrophils are recruited along chemotactic signals to infection sites and engulf pathogens.',
      'C-tcell-family':   'T cells are a family: CD8 killer, CD4 helper and regulatory T cells each have distinct roles.',
      'C-tcell-mhc':      'T cells act only after their receptors recognize antigen fragments presented by MHC.',
      'C-plt-fragment':   'Platelets are cell fragments shed by bone-marrow megakaryocytes and have no nucleus.',
      'C-plt-hemostasis': 'Platelets adhere and aggregate at vessel injuries to form a plug, supporting clotting.',
      'C-model-load':     'This model approximates carrying state with a 0–1 load field — no per-molecule binding/unbinding.',
      'C-model-48':       'The 48 RBCs are a fixed representative sample; their number does not represent the whole-body total.',
      'C-model-aggregate':'Lung-side and tissue-side exchanges are handled by aggregate interface rules, with no individual epithelial/endothelial entities.',
      'C-model-lungsupply':'The lungSupply parameter acts on both the external input term and the lung exchange term — it is not inhaled oxygen concentration.',
      'C-model-flowspeed':'flowSpeed uniformly scales crossing times on every edge — it is not heart rate or blood pressure.',
      'C-model-tissuedemand':'tissueDemand acts on both tissue exchange and usage — it is not a single real physiological quantity.',
      'C-legacy-indep':   'The eight legacy scenes (index.html) share no model state with this linked world.',
      'C-model-co2':      'CO₂ is approximated as a 0–1 index: produced in the tissues in step with usage, expelled at the lung in step with ventilation; the Bohr effect is approximated as an unloading multiplier (0.75–1.35).',
      'C-model-temp':     'Body temperature multiplies the O₂ usage rate by a Q10 factor (2^((T−37)/10)); CO₂ production follows usage.',
      'C-model-perfusion':'Perfusion redistributes unloading across two topology beds (0.7.0): when ≤1 the primary bed gets ×p and the secondary ×max(0,1−p); >1 all to primary. 1.0 matches 0.6.0 single-bed behaviour.',
      'C-model-rbc-turnover':'After RBC_MAX_LOOPS full cycles an RBC is retired and replaced in the same slot at the lung; residual load is counted as expelled; count stays 48.',
      'C-model-altitude':'Altitude scales the lung input and loading drive by the barometric ratio (1 − 2.25577e-5·h)^5.25588, and CO₂ expulsion by a hyperventilation factor (1 + 0.6·(1−ratio)); an aggregate model-index approximation, not individual physiology.',
      'C-model-volume':'Plasma volume is a separate carrier ledger (0–5.0): inflow is set by fluidRate and outflow is temperature-derived sweating 0.0002×max(0, temperature−37) per tick; volFrac scales movement speed and tissue unloading flux; volumeLow triggers below 0.70 (releases at 0.80). An aggregate model-index approximation, not individual physiology.',
      'C-model-infection':'Infection severity (0–1) is pinned to the tissue capillary: neutrophils enter the circulation from the marrow pool and extravasate on arrival, each clearing 0.125 of severity; a cleared event fires at zero. The 90-tick recruitment cadence is an engineering approximation.',
      'C-model-wbc-8':'Neutrophils in circulation are capped at 8 sampled representatives; WBCs carry no oxygen (load is always 0) and do not use RBC turnover.',
      'C-model-glucose':'Blood glucose is approximated as an excursion index above the fasting baseline (starts at 0, range 0–4.0): the continuous glucoseIntake parameter flows in, and tissue uptake (a baseline term plus an insulin-amplified term) flows out; glucoseHigh fires at ≥0.55 and releases below 0.45 (hysteresis). A model index, not a clinical glucose value.',
      'C-model-insulin':'The insulin level (0.30 fasting baseline to 1.0) rises per tick while the glucose index is high and decays back toward the baseline afterwards; tissue uptake = an insulin-independent baseline term (covering baseline glucose use by RBCs and other tissue) plus an insulin-amplified term (a transporter-translocation approximation). An engineering approximation, not an insulin-therapy model.',
      'C-model-anemia':   'The anemia parameter only gates the lung-side loading ceiling ((1 − anemia) × capacity); it does not retroactively change oxygen already carried, and the conservation ledger is unchanged.'
    },

    /* 章節 B/C 學習控制器（chapters.js；缺鍵退回繁中） */
    chapters: {
      title: 'Learning chapters (gated)',
      close: 'Close',
      doneMark: '✓ ',
      openMark: '○ ',
      aProgress: 'Chapter A (guided follow): step ',
      aOf: ' of ',
      aStep: '',
      aNotStarted: 'Chapter A (guided follow): not started - press "Follow a red blood cell" to walk it once.',
      'chapter.B': 'Chapter B: change one condition yourself',
      'chapter.C': 'Chapter C: replay, compare, and state the cause yourself',
      'goal.B': 'You make the intervention and watch how the model responds. The controller only reads model facts; it never moves a slider for you.',
      'goal.C': 'Use the A/B sides and the event log to say which thing caused which. The controller does not judge whether you are right.',
      'gate.B1': 'Move any model parameter away from its baseline value (slider or drug preset).',
      'gate.B2': 'Make the tissue store level differ from where it was when you entered this chapter by more than one percentage point.',
      'gate.B3': 'Put that parameter back to its baseline value and see whether the model returns on its own.',
      'gate.C1': 'Create the A/B baseline branch (move the lung supply or anemia slider, or press any drug preset).',
      'gate.C2': 'Switch to the A baseline side and look at it once.',
      'gate.C3': 'Expand a causal chain once in the event log.',
      'gate.C4': 'Write one sentence with the cause as you see it (collected, never graded; not written into the model, not in the export pack, not uploaded).',
      selfReportLabel: 'Your causal account (collected, never graded; it disappears on reload, is not written into the model, is not in the export pack, and is not uploaded)',
      noJudgement: 'This chapter does not judge whether your account is right - learning outcomes have not been evaluated with human participants and no efficacy is claimed. The controller also never moves a slider for you.',
    },

    /* 血紅素放大視角（hemo.js；缺鍵退回繁中） */
    hemo: {
      title: 'Hemoglobin zoom (model field)',
      frameNote: 'What is magnified here is the model field, not a micrograph; the fill is continuous and its scale does not correspond to a number of molecules.',
      illustrativeTag: 'Illustrative - educational simplification, not a molecular simulation',
      missingEntity: 'Missing data: no red blood cell is selected - press "Follow a red blood cell" or click one first.',
      missingWorld: 'Missing data: no readable world state right now.',
      rowLoad: 'Load ratio (load / cap)',
      rowCeiling: 'Lung-side loading ceiling (1 - anemia)',
      rowWhere: 'Currently in',
      exchangeHere: 'exchange interface segment',
      rowLoops: 'Loops completed',
      rowCo2: 'Blood CO₂ index (shared by the whole world)',
      rowPerfusion: 'Tissue perfusion (shared by the whole world)',
      trendOk: 'The thin bars below are this cell’s load samples (recent observation)',
      trendMissing: 'Missing data: this cell has no observation samples yet (never padded with zeros or a flat line)',
      stamp: 'Timestamp',
      'layer.frame': 'Below is this red blood cell’s state in the model, magnified; the drawing is illustrative, not a micrograph and not a molecular simulation.',
      'layer.carrier': 'Oxygen is carried by hemoglobin: loaded in the lung, released in the tissues.',
      'layer.shape': 'A mature red blood cell is a biconcave disc with no nucleus.',
      'layer.field': 'The model approximates the carrying state with a single 0-1 load field - the fill bar below is that field, and its scale does not represent a count of molecules.',
      'layer.sample': 'This cell is one of the fixed representative sample, not a whole-body total.',
      'layer.interface': 'Loading and unloading are handled by aggregate interface rules; there are no individual epithelial or endothelial cell entities.',
      'layer.ceiling': 'The anemia parameter only lowers the lung-side loading ceiling; it does not retroactively change oxygen already carried.',
      'layer.unload': 'Unloading speed depends on both the blood CO₂ index and tissue perfusion; both are world-wide quantities, not private fields of this one cell.',
    },

    /* 導覽字幕的英文對照（tour.js；缺鍵時退回繁中原句） */
    tour: {
      's0.say': 'Following red blood cell #{id}. The camera is in the lung microenvironment — waiting for it to enter a lung capillary.',
      's0.meet': 'Red blood cell #{id} enters the lung capillary — oxygen loads from the alveolar side (flux = coefficient × driving gap × available capacity).',
      's1.meet': 'Oxygen load is rising (model field: load) — the colour shift is a visual mapping of that field, nothing more.',
      's2.meet': 'Leaving the lung — through the pulmonary vein and left heart into the systemic loop. World time continues; nothing is reset.',
      's3.meet': 'Arriving at a tissue capillary — oxygen unloads into the tissue store; tissue cells draw on it per the demand parameter (colour = tissue oxygen level, a model field).',
      's4.enter': 'Tour intervention: lowering lung-side supply (this action is written into the model record, tagged as source tour, and can be replayed and compared).',
      's5.say': 'Intervention in effect: lung-side loading is reduced — waiting for the tissue store to respond (the event record keeps the trail).',
      's6.enter': 'Restoring lung-side supply — the model returns to baseline conditions (the full parameter history stays inside the same run).',
      's7.say': 'Recovering… the tissue store is climbing back.',
      's7.meet': 'Journey complete. You can now: press A/B to compare baseline vs intervention, open the event log to trace causes, or switch to free exploration and change parameters.',
      'timeout': '(Wait timed out, skipping to the next step — the model has not produced that event.)'
    },

    /* 八卡的英文對照（結構與 content.js cards 對應） */
    cards: {
      rbc: {
        capabilityNote: 'This linked mode has 48 ID-bearing representative RBCs (a sample, not a whole-body total); behaviour is a simplified model.',
        headline: 'The most numerous blood cell: carries oxygen on hemoglobin, shuttling between lungs and tissues.',
        keyPoints: [
          'Biconcave disc — no nucleus after maturation',
          'Hemoglobin contains iron: the key to oxygen carrying',
          'In this model: the load field approximates carrying state, with no per-molecule binding'
        ],
        qa: [
          { q: 'What am I, and where am I usually found?',
            a: 'A human mature red blood cell is a biconcave disc about 7–8 µm across; after maturation it has no nucleus and most organelles. Produced in the bone marrow, it enters the bloodstream and circulates for roughly 120 days.' },
          { q: 'What do I mainly do?',
            a: 'Carries oxygen on hemoglobin: loaded at the lung gas-exchange surface, released to tissues around the systemic loop. Hemoglobin is an iron-containing protein; reversible binding at its iron sites is the basis of oxygen carrying.' },
          { q: 'Which structures and roles do I work with?',
            a: 'In the lungs it works with the alveolar–capillary exchange surface (AT1 epithelium, endothelium and basement membrane forming the air–blood barrier); in tissues it exchanges oxygen across capillaries; plasma is its transport medium. This model approximates those surfaces with aggregate exchange rules.' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: 48 representative RBCs travel the circulation while the load field responds to lung/tissue exchange rules — you can intervene, compare and replay. Does not: no per-molecule binding/dissociation curves, no individual RBC metabolism or ageing, and the count is not a whole-body total.' }
        ]
      },
      at1: {
        capabilityNote: 'Knowledge / structural schematic; not an independent dynamic entity in this linked mode. Exchange is handled by aggregate interface rules.',
        headline: 'An extremely thin epithelial cell forming most of the alveolar air–blood barrier surface.',
        keyPoints: [
          'Ultra-thin, large-area squamous epithelium',
          'Covers most of the alveolar wall surface',
          'Pressed against endothelium to form the air–blood barrier'
        ],
        qa: [
          { q: 'What am I, and where am I usually found?',
            a: 'The alveolar type 1 epithelial cell (AT1) is an extremely thin, large-area squamous cell covering most of the alveolar wall surface, pressed against capillary endothelium to form the air–blood barrier.' },
          { q: 'What do I mainly do?',
            a: 'Its thin wall lets oxygen and carbon dioxide diffuse over a very short distance — it is the structural condition of exchange, not a pump.' },
          { q: 'Which structures and roles do I work with?',
            a: 'It shares a basement membrane with capillary endothelium to form the barrier, and with AT2 it makes up the alveolar epithelium (AT2 handles surface-tension regulation and serves as a repair source).' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: the “alveolar exchange section (schematic)” shows its position and thin-wall role. Does not: this linked world has no individual AT1 entities — exchange rates come from aggregate rules, without cell-level behaviour.' }
        ]
      },
      at2: {
        capabilityNote: 'Knowledge / structural schematic; adds no dynamic parameters such as secretion rates.',
        headline: 'The cuboidal epithelium that makes surfactant — and repairs the alveolar lining.',
        keyPoints: [
          'Cuboidal, tucked into alveolar wall corners',
          'Secretes surfactant, lowering alveolar surface tension',
          'Considered a repair source for damaged AT1 cells'
        ],
        qa: [
          { q: 'What am I, and where am I usually found?',
            a: 'The alveolar type 2 epithelial cell (AT2) is cuboidal and scattered along the alveolar wall, often at corners where neighbouring cells meet.' },
          { q: 'What do I mainly do?',
            a: 'It synthesizes and secretes surfactant, lowering surface tension at the alveolar air–liquid interface so alveoli do not collapse at the end of expiration; it is also considered a cellular source for repairing damaged AT1 cells.' },
          { q: 'Which structures and roles do I work with?',
            a: 'Together with AT1 it forms the alveolar epithelium; its surfactant spreads over the air–liquid interface, shaping the mechanics of the whole alveolus.' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: the knowledge card and its position in the exchange-section schematic. Does not: the model has no surfactant variable and no secretion rate — the alveolus is a single aggregate stock, without individual AT2 behaviour.' }
        ]
      },
      endothelium: {
        capabilityNote: 'Structural background; exchange is currently handled by an aggregate interface, with no individual endothelial entities.',
        headline: 'The thin cell layer forming the capillary wall — the interface between blood and tissue.',
        keyPoints: [
          'A single flat cell layer lines the vessel interior',
          'The structural basis of material exchange and the blood–tissue interface',
          'Approximated by an aggregate interface in this model — no individual entities'
        ],
        qa: [
          { q: 'What am I, and where am I usually found?',
            a: 'Endothelial cells are a single layer of flat cells lining the inner surface of every vessel; in alveolar capillaries they press against AT1 epithelium to form the air–blood barrier.' },
          { q: 'What do I mainly do?',
            a: 'They form a selective interface between blood and surrounding tissue: maintaining vessel integrity while letting gases and other materials exchange at appropriate segments.' },
          { q: 'Which structures and roles do I work with?',
            a: 'They share the basement membrane with AT1; on the luminal side they contact red blood cells and plasma — in this model exchange happens at the aggregate interfaces of LUNG_CAP and TISSUE_CAP.' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: an “aggregate interface” represents the vessel wall and exchange sites in the model rules; the section schematic marks where. Does not: no individual endothelial entities and no active endothelial behaviour (such as inflammatory leakage control).' }
        ]
      },
      'alv-mac': {
        capabilityNote: 'Knowledge. The generic macrophage from the legacy standalone scenes must not masquerade as an alveolar-specific model.',
        headline: 'The scavenger stationed in the alveolar space, engulfing inhaled particles and pathogens.',
        keyPoints: [
          'Resides in alveolar spaces and airways',
          'Engulfs particles, debris and pathogens (the “dust cell”)',
          'The legacy-scene macrophage is generic, not alveolar-specific'
        ],
        qa: [
          { q: 'What am I, and where am I usually found?',
            a: 'Alveolar macrophages are immune cells stationed in the alveolar spaces and small airways; they are nicknamed “dust cells” because they so often engulf inhaled dust.' },
          { q: 'What do I mainly do?',
            a: 'They engulf and clear particles, debris and pathogens that reach the deep alveoli — one of the alveoli’s first lines of defence against the outside world.' },
          { q: 'Which structures and roles do I work with?',
            a: 'In airway defence they cooperate with mucociliary clearance and the epithelial barrier; on infection they can call in neutrophils and further immune responses — neutrophil recruitment and clearance are observable in this linked world (see the neutrophil card).' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: knowledge explanation. The legacy index.html scene has a generic macrophage engulfing display (legacy_independent — no shared state with this linked world). Does not: this linked world has no macrophage entity and no alveolar-specific immune model.' }
        ]
      },
      neutrophil: {
        capabilityNote: 'Dynamic model entity: when infection > 0 the circulation holds wbc entities (at most 8 at once); recruitment, extravasation and clearance are simplified model behaviour in model units, not clinical white-cell counts.',
        headline: 'The most abundant white blood cell — the fast-response force of innate immunity.',
        keyPoints: [
          'The largest share of white blood cells',
          'First to arrive at infections, engulfing pathogens',
          'This linked world has wbc entities: recruitment, extravasation and infection clearance (model units)'
        ],
        qa: [
          { q: 'What am I, and where am I usually found?',
            a: 'Neutrophils are the most abundant type of white blood cell, patrolling the bloodstream until an infection recruits them to the tissue scene fastest. This linked world presents that recruitment with wbc entities: once infection is set, they are recruited from the venous blood.' },
          { q: 'What do I mainly do?',
            a: 'They move along chemotactic signals to infection sites and engulf and destroy bacteria and other pathogens; pus is largely neutrophils and debris. In the model each wbc extravasates on reaching the tissue capillary, clearing 0.125 infection severity each time; a cleared event fires at zero.' },
          { q: 'Which structures and roles do I work with?',
            a: 'They cooperate with macrophages and other innate defences (macrophages sentinel, neutrophils reinforcing) and cross the vessel wall through endothelial interactions — the model presents this step as extravasation.' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: this linked world has neutrophil entities (kind wbc, at most 8 at once, carrying no oxygen) — when infection > 0 one is recruited from the venous side every 90 ticks, travels along edges, extravasates at the tissue capillary and clears 0.125 infection severity, with an infection-cleared event at zero; the recruitment cadence is an engineering approximation and the numbers are model units. The legacy standalone scene (index.html) additionally shows a “chemotactic signal → chase → engulf” display (legacy_independent, no shared state). Does not: individual chemokine receptors or histology-level migration detail, clinical white-cell counts, or total body white-cell counts.' }
        ]
      },
      tcell: {
        capabilityNote: 'Knowledge; the legacy model is highly simplified (a single tcell type with an antigen gate).',
        headline: 'Not one cell but a family: killer, helper and regulatory branches with distinct jobs.',
        keyPoints: [
          'CD8 kills, CD4 helps, Treg regulates',
          'Recognize specific antigens via receptors (MHC presentation)',
          'The legacy scene reduces the family to one type plus an antigen gate'
        ],
        qa: [
          { q: 'What am I, and where am I usually found?',
            a: 'T cells are a family of lymphocytes that mature in the thymus (hence “T”), found in blood, lymph nodes and tissues. They are not a single cell: CD8 killer, CD4 helper and regulatory T cells each have distinct roles.' },
          { q: 'What do I mainly do?',
            a: 'Their T-cell receptors recognize specific antigen fragments presented by MHC: after recognition, CD8 cells attack infected or abnormal cells; CD4 cells coordinate other immune responses.' },
          { q: 'Which structures and roles do I work with?',
            a: 'They receive presented information from antigen-presenting cells (such as macrophages and dendritic cells) and coordinate humoral immunity with B cells. The legacy scene depicts this chain as “macrophage engulfs → antigen presentation → T cell activated → killing”.' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: knowledge explanation. The legacy standalone scene shows “T cells activated after antigen presentation, then precise killing”, but it reduces the whole family to a single type and shares no state with this linked world. Does not: this linked world has no T-cell entities and no immune model.' }
        ]
      },
      platelet: {
        capabilityNote: 'A “cell fragment” label — shed by megakaryocytes, not a nucleated cell; adds no full nucleated-cell model.',
        headline: 'Not a complete cell but a fragment shed by megakaryocytes — haemostasis’s patch worker.',
        keyPoints: [
          'Shed as fragments by bone-marrow megakaryocytes',
          'No nucleus, but stocked with granules and a cytoskeleton',
          'The legacy scene shows simplified wound-edge clotting'
        ],
        qa: [
          { q: 'What am I, and where am I usually found?',
            a: 'Platelets are shed by megakaryocytes in the bone marrow — cell fragments, not nucleated cells — patrolling inside vessels with the flow.' },
          { q: 'What do I mainly do?',
            a: 'When a vessel is injured they quickly adhere and aggregate into a plug, working with the clotting cascade to stop bleeding; afterwards they disperse or are cleared.' },
          { q: 'Which structures and roles do I work with?',
            a: 'They work with vessel-wall endothelium, plasma clotting factors and fibrin to form a clot; they also interact with immunity (not modelled here).' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: knowledge explanation and the “cell fragment” labelling. The legacy standalone scene (index.html) shows platelets clotting at a wound edge (legacy_independent). Does not: this linked world has no platelet entities and no wound or clotting model.' }
        ]
      }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
