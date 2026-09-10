/* ============================================================
   CELLSCAPE Living Atlas — content-en.js（T-299 刀 C3）
   content.js（v0.3.0-content.1）的英文覆蓋層：純資料、無可執行邏輯。
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
    mirrors: 'v0.3.0-content.1',

    /* 殼層字串（loop.html data-i18n 與 atlas 標題） */
    shell: {
      'tab.know': 'Know it', 'tab.now': 'Right now', 'tab.mech': 'How it works', 'tab.src': 'Sources',
      'nav.follow': '◎ Follow a red blood cell',
      'view.explore': 'Free exploration', 'view.overview': 'Circulation overview',
      'view.lung': 'Lung micro-view', 'view.tissue': 'Tissue exchange',
      'panel.events': 'Event log', 'panel.inspector': 'Inspector',
      'export': 'Export JSON', 'import': 'Import JSON',
      'landing.desc1': 'A continuously running circulatory world: follow the same red blood cell',
      'landing.desc2': 'from the lung capillaries, through the heart and systemic loop, into the tissues — and back to the lungs.',
      'landing.note1': 'Simplified oxygen model · internal values are model units, not SpO₂ or clinical values',
      'landing.note2': 'The tour advances by model conditions · you can interrupt anytime, explore freely, and compare branches',
      'params.title': 'Model parameters (adjustable in Explore)',
      'params.lung': 'Lung oxygen supply', 'params.flow': 'Circulation flow speed', 'params.demand': 'Tissue demand',
      'params.note': 'Tissue colour scale = tissue oxygen stock level (a model field), not a diagnostic image.',
      'drug.label': 'Drug interventions (model presets, not medical advice)',
      'drug.bronchodilator': 'Bronchodilator', 'drug.betaBlocker': 'Beta-blocker',
      'drug.fever': 'Sepsis (fever)', 'drug.baseline': 'Reset to baseline',
      'drug.note.bronchodilator': 'Drug intervention (model): bronchodilator — lung oxygen supply raised to 1.00. Model units, not medical advice.',
      'drug.note.betaBlocker': 'Drug intervention (model): beta-blocker — circulation flow speed lowered to 0.60. Model units, not medical advice.',
      'drug.note.fever': 'Drug intervention (model): fever / sepsis — tissue demand raised to 0.85. Model units, not medical advice.',
      'drug.note.baseline': 'Drug intervention (model): parameters reset to baseline values.',
      'inside.entry': '🔬 Cell interior (schematic)',
      'mech.knowledgeNote': 'This card is knowledge / structural background; exchanges in this linked world are approximated by aggregate rules (see the rules block on the red blood cell card).',
      'src.usage': 'Scope of use', 'src.assetNote': 'Asset notice', 'src.checked': 'Checked on',
      'meta.impl': 'Implementation reference', 'meta.limit': 'Applicability limit', 'meta.basis': 'Basis',
      'hud.inspector': 'Atlas inspector', 'hud.pathProgress': 'Path progress', 'hud.loops': 'Loops completed',
      'hud.o2load': 'Oxygen load (load)', 'hud.loadNote': 'load is a model field (0–1 model units), not SpO₂.',
      'hud.eventsHint': 'Click an event to expand its parent chain',
      'search.placeholder': 'Search roles / questions (zh · EN · RBC…)',
      'src.warn': '“A source exists” does not mean “the claim is supported by that source” — biology_reference entries are editorial drafts (pending review); model_assumption entries are verified against this implementation.'
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
      defaultsNote: 'The first three rows are default readouts; the other three expand.',
      expandLedger: 'Expand conservation ledger and rule details',
      ledgerLine: 'Conservation ledger (checked every 30 ticks, residual ≤1e-6): initial {initial}, cumulative input {input}, usage {usage}, exhaled {expelled}, latest residual {residual}.',
      spo2Note: 'Percentages here are relative to model capacity, not SpO₂; rates are converted in model time (dt = 1/30 model-seconds).'
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
      usage_rate:       { name: 'Tissue usage rate', note: 'Differenced from the cumulative usage ledger; requires a full window.' }
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
      'C-legacy-indep':   'The eight legacy scenes (index.html) share no model state with this linked world.'
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
            a: 'In airway defence they cooperate with mucociliary clearance and the epithelial barrier; on infection they can call in neutrophils and further immune responses.' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: knowledge explanation. The legacy index.html scene has a generic macrophage engulfing display (legacy_independent — no shared state with this linked world). Does not: this linked world has no macrophage entity and no alveolar-specific immune model.' }
        ]
      },
      neutrophil: {
        capabilityNote: 'Knowledge / links to the legacy standalone display (the engine.js chemotaxis chase is highly simplified).',
        headline: 'The most abundant white blood cell — the fast-response force of innate immunity.',
        keyPoints: [
          'The largest share of white blood cells',
          'First to arrive at infections, engulfing pathogens',
          'The legacy scene shows a simplified chemotaxis chase'
        ],
        qa: [
          { q: 'What am I, and where am I usually found?',
            a: 'Neutrophils are the most abundant type of white blood cell, patrolling the bloodstream until an infection recruits them to the tissue scene fastest.' },
          { q: 'What do I mainly do?',
            a: 'They move along chemotactic signals to infection sites and engulf and destroy bacteria and other pathogens; pus is largely neutrophils and debris.' },
          { q: 'Which structures and roles do I work with?',
            a: 'They cooperate with macrophages and other innate defences (macrophages sentinel, neutrophils reinforcing) and cross the vessel wall through endothelial interactions.' },
          { q: 'What does this demo do, and not do?',
            a: 'Does: knowledge explanation; the legacy standalone scene (index.html) shows a “chemotactic signal → chase → engulf” display, but that is a population-level simplification sharing no state with this linked world. Does not: this linked world has no neutrophil entities.' }
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
