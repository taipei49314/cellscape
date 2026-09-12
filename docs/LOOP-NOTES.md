# CELLSCAPE v0.2 · Living Loop — 技術說明與誠實邊界

## 執行

- 線上試用：<https://taipei49314.github.io/cellscape/>（GitHub Pages，根目錄進 Living Atlas）。
- 根目錄 `/` 與 `index.html` 進入 Living Atlas（轉到 `loop.html`）。Windows 可用 `start.bat`。
- 本地靜態開啟：`python -m http.server 8642 --bind 127.0.0.1`，然後開 `http://127.0.0.1:8642/loop.html`。
- `museum.html` 的八個場景為**既有獨立場景**（r4 基線，未與新世界連動；歷史文件曾稱 `index.html`）；
  `loop.html` 為**連動世界**。兩者只有入口關係，無共享模擬狀態。
- 五人小樣本腳本：[TRY.md](TRY.md)。尚未由人類跑完，不宣稱學習成效。

## 模型單位（未校準）

- 氧代理量：0–1 的無因次負載（RBC）與「模型單位」庫存（肺泡 40、組織 25 容量）。
- 係數：`K_LUNG=0.05`、`K_TISSUE=0.045`、`K_USE=0.09`（每 tick），皆為工程近似。
- **不是** SpO2、血氧分壓、ATP 或臨床分數；介面已常駐標示。
- 肺端裝載 = K_LUNG × max(0, 肺泡水位 − 負載) × lungSupply；組織卸載 = K_TISSUE × max(0, 負載 − 組織水位) × (0.5 + tissueDemand)。兩者再受供方庫存與接收方容量上限限制；容量限制不是額外乘數。
- 貧血參數 `anemia`（0–0.9，預設 0；0.3.0 新增）：每顆 RBC 肺端裝載上限 = (1 − anemia) × cap；不回溯調整既有負載——貧血表現為週期遞送下降、組織庫存平衡點下移，而非血氧飽和度異常。【補記：此行屬 0.3.0（PR #7）應載內容，因當時 patch 錨點未命中且腳本無斷言而遺漏，0.4.0 本筆補正並於 T-303 披露。】
- 灌流參數 `perfusion`（0.2–1.8，預設 1.0；0.6.0 參數、0.7.0 拓樸雙床）：≤1 時主床卸載乘 `perfusion`、次要床（`TISSUE_CAP_2`）乘 `max(0, 1−perfusion)`，名目合計血流≈1；>1 全給主床。1.0＝0.6.0 單床行為。低灌流時氧可經次床卸載，而不是只留在血中。守恆帳結構不變。**不是** mmHg 血壓、**不是**心輸出量；僅兩個建模組織床。與 `flowSpeed` 分工：後者只改跨越時間。
- 體溫參數 `temperature`（36–41 °C，預設 37；0.5.0 新增）：O₂ 使用速率乘 Q10 因子 2^((T−37)/10)；CO₂ 生產隨使用量連動，經 Bohr 同向影響卸載。37 °C＝因子 1（行為與 0.4.0 一致）。工程近似，非體溫調節模型。
- 海拔參數 `altitudeM`（0–6000 m，預設 0；0.10.0 新增）：氣壓比值 (1 − 2.25577e-5·h)^5.25588 乘肺端輸入與裝載驅動；CO₂ 排出乘過度換氣因子 (1 + 0.6·(1−比值))。高海拔＝遞送下降且血中 CO₂ 指數下降（中立性契約 altitude-neutral-at-0 守門）。聚合模型指數，非高山醫學、非旅遊或健康建議。
- CO₂ 指數（0–1，穩態 0.30；0.4.0 新增）：組織隨 O₂ 使用量生產（RQ 0.8、尺度 4）、肺端隨通氣排出（係數 0.34）；上限鉗位差額記入 retained。Bohr 效應以組織卸載倍率近似（鉗位 0.75–1.35；穩態時＝1，即上式卸載項另乘 bohr）。CO₂ 自帶生產/排出/保留帳（每 30 tick 檢查），**不與 O₂ 守恆帳混用**；≥0.70 觸發 `co2BloodHigh` 閾值事件（遲滯 <0.60 解除）。指數為模型值（主張 C-model-co2），非臨床酸鹼值；本文件不再描述 pH 換算——產品 UI 已於 T-323 移除無主張背書的 pH 衍生顯示。
- 組織使用 = K × (0.5 + 需求參數) × 水位，受現有庫存限制；庫存為零即無消耗。
- RBC 世代輪替（0.8.0／T-329 F3）：滿 `RBC_MAX_LOOPS` 圈退役，殘餘 load 記入 `ledger.expelled`（離開抽樣體），同槽於肺端替換為低負載新球；總量固定 48。示意輪替，非 120 天生理壽命校準。

## 守恆帳

`初始總量 + 累積輸入 − 累積使用 − 累積呼出 − 當前總量 = 殘差`。
每 30 tick 檢查一次，容差 `1e-6 × max(1, 當前總量)`；違規會寫入 `system` 事件。
探針實測：含三次參數變更的 180 模型秒運行，最差殘差 `≤ 1e-6`。

## 身分與時間

- 48 顆 RBC 為固定模型實體（抽樣代表，非全身總量）；數量不隨畫質或鏡頭改變。
- 同一 ID 每 tick 只存在於一條邊；跨邊為原子移交（`s` 帶餘數續行）。
- **離散時間邊界契約**：移交發生在 tick 內；移交後「同一 tick」的交換以
  **抵達後的邊**為準（HANDOFF_EXCHANGE_BOUNDARY 契約）。移交事件的地區欄位
  為抵達邊 ID。
- 模型固定時間步 1/30 模型秒；`tick` 為唯一時間權威。牆上時鐘只決定「每秒推進
  幾個 tick」（速度 0.5×–4×）；渲染幀率、DPR、粒子品質均不影響模型結果（探針：
  確定性重放、跨幀率一致）。
- 頁籤隱藏 = 模型暫停，不做追趕（policy；恢復可見時從當下狀態續行）。

## 事件溯源

- 所有正式動作（參數變更）走 `CSL.queueCommand` 唯一入口，記錄 tick、前後值、
  來源（user / tour / demo-injection）。
- 事件含 `eventId / tick / kind / actorId / regionId / ruleId / before/after /
  parentEventIds`。下游閾值事件（組織低水位）會引用引起它的參數指令——這是
  **程式內的來源鏈**，不是自然界因果證明。事件記錄面板點擊含父鏈的事件
  可展開因果鏈。
- eventId 為**分支局部配號**：A/B 各自的配號序列會出現同號事件。
  展開狀態屬於「顯示中的世界」，切換分支即收合（EVENT_ID_BRANCH_LOCAL 契約）——
  不得以同號事件在另一世界凑鏈。
- 因果鏈展開期間，時鐘／tick／水位／檢閱面板**持續更新**，僅事件清單區持續渲染
  鏈內容（EXPANDED_CHAIN_HUD_LIVE 契約；EVENT_CHAIN_OVERWRITTEN 契約不變）。
- 事件環保留最近 **1000** 筆；快照/執行包含事件尾與閾值旗標
  （`tissueLow / lastTissueLevel / co2High / lastCo2 / lastParamEvent`）——匯入續行
  不重複、不遺漏事件（IMPORT_EVENT_CONTINUATION 契約）。0.5.1 前 `exportRun`
  漏帶兩個 CO₂ 旗標，且匯入驗證拒收 `co2BloodHigh` 事件，見下方版本說明。
- 匯入深驗證涵蓋事件 **kind 相依 payload**：command 事件 before/after 必為
  `{key∈參數界限, value=有限數}`；handoff 事件必含正整數 actorId、字串
  regionId、界內 `{edge, s}`；threshold 事件 ruleId 限 `tissueStockLow`／`co2BloodHigh`、
  level 為數值字串；
  eventId 環內唯一且落後 eventSeq（IMPORT_EVENT_PAYLOAD_VALIDATION 契約）。
  稽核反例（command `after:null`）現為顯式拒絕，不再抵達 UI。
- 事件欄位字串（source/regionId/ruleId/key）渲染前一律 HTML 跳脫——
  匯入包內字串不得被當成標記解析（IMPORT_TEXT_PLAINTEXT 契約；
  稽核良性觀察：注入 SVG 字串曾建立 DOM 元素，現僅顯示為文字）。
- 來源分類：規則推進 / 外部干預（user、tour）/ 示範注入。視覺特效不寫回模型。

## 回放與分支

- 執行包（JSON）：modelVersion、schemaVersion、種子、RNG 狀態、固定步長、
  動作序列、實體、庫存、帳本、事件尾、閾值旗標、ID 分配狀態、摘要鏈尾。
- 摘要（digest）比對下列指定模型欄位：tick、參數、庫存（含容量）、
  實體（含 cap）、待處理 command 佇列、閾值旗標與其水位
  （`_tissueLow`／`_lastTissueLevel`／`_co2High`／`_lastCo2`）、CO₂ 四欄
  （blood／produced／expelled／retained）、**事件序列配號 eventSeq**
  （MODEL_STATE_DIGEST_COVERAGE 契約；DIGEST_SCOPE 修復——摘要相等即保證
  受測配號差異可識別；不保證不同事件歷史必然有不同摘要）。
  **摘要範圍界線（DIGEST_IS_NOT_EVENT_HISTORY_IDENTITY）**：摘要不涵蓋事件的
  來源標籤（user/tour 等證據性欄位）或事件史內容本身——摘要相等**不**宣稱
  「完整事件史一致」；事件史的證據完整性由快照/執行包的事件尾與
  IMPORT_EVENT_CONTINUATION 契約承擔。
- 同版本 + 同初始狀態 + 同動作序列 ⇒ 逐 tick 摘要一致（探針驗證）。
- 匯入先驗 schema／版本／dt／rules（edges 與常數與當前實作逐項比對）／尺寸／
  數值界限（實體欄位、庫存非負且不超容量、參數界限、事件 kind 相依 payload）——
  任一不符即顯式拒絕（無 eval；畸形包全數拒絕）。
- **MODEL_VERSION 0.6.0**：新增 `perfusion` 參數（T-317 D4 血流再分配，純參數版）——組織端卸載通量多乘一項比例因子，
  1.0 為基準值且與 0.5.1 逐拍摘要相同；參數界限新增一鍵，故舊執行包依版本閘顯式拒絕。
  拓樸（`EDGES`）、守恆帳結構與 digest 正規化皆未變。
- **MODEL_VERSION 0.5.1**：無交換方程式變更；升版原因為檢查點身分契約修復（T-316 刀 D2）——
  匯入驗證接受 `co2BloodHigh` 閾值事件（修復前含該事件的執行包一律 `SNAPSHOT_REJECTED`，
  A/B 分支亦然）、`exportRun` 帶出 `co2High`／`lastCo2`（漏帶會使匯入後摘要分歧並重發事件）、
  CO₂ 閾值補上本檔所述的 <0.60 解除遲滯。舊 0.5.0 執行包依版本閘顯式拒絕。
- **MODEL_VERSION 0.2.2**：本版無交換方程式變更；升版原因為檢查點身分契約變更
  （digest 正規化納入 eventSeq、事件 payload 深驗證）——舊包之 digestChainTail
  以舊正規化計算，無法跨正規化延續，故顯式拒絕。
- **匯入＝替換顯示世界**：進行中導覽即中斷（IMPORT_STOPS_TOUR 契約——舊步驟
  不得對匯入世界下 `source='tour'` 指令）；A/B 分支顯示、因果鏈展開同屬舊世界，
  一併復位，不跨匯入繼承。
- 首次介入建立 A/B：A=介入前快照的無介入基線（鎖步推進、**不繼承待處理
  command 與介入歷史**），B=介入分支；單一渲染視窗切換顯示，HUD 讀取顯示中的
  世界。回到過去改參數屬新分支，不覆寫原歷史。
- URL 僅攜帶 `?seed=`；大快照走 JSON 檔。

## 呈現語意

- 交換粒子代表**流向與相對速率**：密度直接由模型每 tick 實測通量驅動、
  無下限——零通量 ⇒ 零粒子；不是逐顆氧分子。
- 組織色階 = 組織氧庫存水位（模型欄位），非診斷影像。
- RBC 色調 = load 欄位映射；選取光暈僅代表選取。
- 場景尺度與時間壓縮屬示意（站點配置非等比例），介面常駐說明。
- **站點幾何對齊契約**：曲線取樣建立站點弧長參數 `uStations[i]`；實體在邊 i 的
  位置以 s 內插 `uStations[i] → uStations[i+1]`——s=0 恰落在站點上。
- 本介面刻意不使用無語意的裝飾性特效。

## 效能策略

- 低負載模式：pixelRatio 降為 1、粒子池縮減、標籤更新節流；模型步數與隨機序列不變。
- reduced-motion：鏡頭取消飛行（直接切位）、無裝飾漂移；資料與文字說明不變。
- 頁籤隱藏：模型暫停不追趕（單幀推進上限另為 12 tick）。
- 效能徽章顯示中位數/p95 幀間隔。**本輪數據取自隱藏分頁（rAF 節流），不具參考性**；
  正式基準需鎖定可見視窗與指定裝置（發布門檻之「尚未量測」項）。

## 已驗證（探針）

| 契約 | 結果 |
|---|---|
| 身分唯一／實體數固定（3000 tick 抽樣） | ✅ |
| 守恆殘差 ≤ 1e-6（180 模型秒，3 次參數變更） | ✅ |
| 零係數 ⇒ 零通量；lungSupply=0 ⇒ 輸入=0；無庫存 ⇒ 無消耗 | ✅ |
| 同種子＋同動作 ⇒ 摘要鏈一致 | ✅ |
| 匯出→匯入→續行，摘要鏈延續一致 | ✅ |
| 分支：介入點分歧；A/B 組織水位差異；基線不被覆寫 | ✅ |
| 導覽情境：降低→恢復肺端供氧，單顆 RBC 負載與組織水位出現模型預期差異 | ✅ |
| 不相容執行包顯式拒絕 | ✅ |
| 瀏覽器：主按鈕→跟隨→介入→A/B→匯出/匯入互動 | ✅（隱藏分頁以確定性步進驅動） |
| **獨立審查 loop_contracts.cjs 重跑：8/8**（含事件續行無重複、畸形包全數拒絕、移交邊界、摘要覆蓋、預設閾值可達） | ✅ |
| **出貨路徑**：主循環內 Tour.update 推進導覽至自然收幕（tourDone）、FOLLOW 視角由 UI 觸發、基線分支零介入繼承、HUD 讀顯示世界、canvas 點選、因果鏈展開 | ✅ |
| **v0.2.3 修復重跑**：稽核方 Node 套件全綠（loop_contracts 8/8、independent_v021 5/5、r3 8/8、r4 7/7、reset-boundary、32 矩陣零錯誤）；瀏覽器：展開期間 HUD 即時（tick 306 ⇒ HUD tick 300/14%/00:10 同步）、切換分支即收合（expanded 9540 → null，無跨分支凑鏈）、`after:null` 包 UI 顯式拒絕 `SNAPSHOT_REJECTED: bad-event-payload`、注入 SVG 字串以純文字呈現（零 DOM 元素、零 script 執行） | ✅ |
| **v0.2.4 修復重跑**：independent_v023 3/3（16 項 payload 負例全拒＋正例控制）；導覽中匯入後與乾淨續行並走 4800 tick——零 tour 指令、UI 世界與續行 **digest 相等**（49d9c4a4）、滑桿隨載入世界同步（0.4／標籤 0.40）；展開中匯入即收合 | ✅ |

## 尚未驗證／後續（誠實清單）

- 可見視窗與真實裝置的幀率基準（中位 ≤16.7ms、p95 ≤25ms 為目標，未量測）。
- 5 人小樣本使用性驗收（跟隨→改條件→回放並說出因果）。
- 真實部署站、長時間耐力測試、觸控操作細節。
- 生物學效度：本模型不支持任何臨床或生理預測主張。

## 外部依據

- NHLBI「How the Lungs Work / How the Heart Works」：路徑與敘事背景，不提供任何係數。
- Ghaffarizadeh et al. 2018, PhysiCell（PLOS Comp Biol, DOI 10.1371/journal.pcbi.1005991）：
  細胞行為與微環境運輸分離的架構借鑑；非本專案之驗證報告。
- Three.js r149（MIT，已本地化於 `vendor/three.min.js`）：僅作渲染，不作為模擬引擎。

---

## v0.3 Living Atlas（Gate A/B）— 知識與觀察資訊層

依「v0.3 Living Atlas 規劃包」（基線 v0.2.4＋§0 預期的 A/B 鈕搭車項＝v0.2.5）
實作的**第一個完整資訊閉環**。本節範圍限 Gate A/B；Gate C（其餘視角/章節/內容
擴充）與 Gate D（部署/實機/可用性）**尚未實作，不得視為已完成**。

### 新增模組（皆為唯讀層；模型 core/model/export 語義不變）

- `content.js` — 內容註冊表（純資料，無函式/eval/selector）：8 張角色卡骨架 ×
  4 個固定問題＝32 問答、主張登錄（biology_reference 為編輯草稿待審；
  model_assumption 已對照實作）、來源表 S1–S8（與規劃包 SOURCE-REGISTER.json
  一致）、能力綁定（dynamic/aggregate/knowledge_only/legacy_independent）、
  分類對應（exact/broader/related/unmapped，不捏造 ontology ID）、6 項讀值定義。
- `observe.js` — 觀察緩衝與 ViewContext：sessionEpoch（匯入/新世界安裝即前進、
  舊觀察作廢）、分支各自窗口（A/B）、每 6 tick 採樣（0.2 模型秒）上限 600 點
  （120 模型秒）、速率窗口 N=90 tick 以模型 dt 換算。**缺資料＝明示缺資料**
  （missing-window／尚未取得），不以 0 頂替；實測零通量＝真零。觀察不是模型
  的一部分：唯讀、故障即停用明示、不改 RNG 不補樣本、不進執行包。
- `atlas.js` — 四頁籤檢閱（認識它／看此刻／懂機制／查來源）、跨卡搜尋（任何
  頁籤可搜）、白名單解說規則（位置＋實測通量才宣稱交換；否則降級為「位於
  交換區域」）、選取負載時間線（缺口不連線、介入點標記）、肺泡交換剖面
  （結構示意，零通量不顯示流動；AT2/巨噬為知識層示意，不入守恆帳）。

### 契約

| 契約 | 內容 |
|---|---|
| READ_ONLY_INFORMATION | 開啟/切換頁籤、搜尋、來源、剖面皆不改變模型狀態（暫停下世界 JSON 逐位元組不變） |
| SESSION_BRANCH_ISOLATION | 觀察以 (sessionEpoch, branchId, entityId) 鍵存；A/B 窗口分離；匯入即新工作階段 |
| IMPORT_INFO_RESET | 有效匯入：epoch 前進、舊曲線全清、介面重繪、滑桿同步、包內合法排程保留 |
| MISSING_HISTORY_IS_MISSING | 缺資料顯示缺資料；不插補、不捏造過去曲線 |
| METRIC_UNITS_WINDOW | 速率以模型 dt 換算（模型單位／模型秒），非牆上秒 |
| ZERO_FLUX_NO_EXCHANGE_STORY | 窗口實測零通量 ⇒ 交換說明與流動展示停止；僅「位於交換區域」 |
| NARRATIVE_DOWNGRADE | 視角在肺部≠正在裝載；需位置＋正交換證據才可宣稱 |

### 已驗證（自建）

- `atlas-tests.cjs` 8/8：內容完整性（8 卡/32 答/主張來源可解析/能力列舉/純資料）、
  讀值數學與手工計算一致（dt 正確）、missing-window ≠ 0、實測零通量、
  A/B/session 隔離與 epoch 清空、採樣節奏與 600 上限、唯讀性（世界 JSON 與
  exportRun 逐位元組不變）、ViewContext 欄位。
- 瀏覽器：四頁籤/搜尋/剖面/曲線可反覆操作；唯讀（世界 JSON 不變）；
  匯入後 epoch 前進＋缺資料明示＋舊曲線清空；A/B 窗口分離（B 40 點 vs A 20 點
  各自鍵存）；零通量剖面無箭頭＋實測零文案；844×390 矮幕面板可用
  （檢閱開啟時蓋於環境面板，一次一個主要面板）。
- 既有回歸全綠：loop_contracts 8/8、independent_v021 5/5、independent_v023 3/3、
  r3 8/8、r4 7/7、reset-boundary 2/2、legacy 32 矩陣零錯誤、作者探針零差異、
  自建冒煙 7/7。

### 尚未驗證／未實作（誠實清單）

- Gate C 進度：速率曲線圖已於 T-319 交付（見上方速率曲線段）；血紅素放大視角
  以「模型欄位的放大」形式於 T-321 刀 K1 交付（`js/loop/hemo.js`，內容只引用既有
  主張、其餘標示意）。**仍未做**：其餘卡片內容的編輯審核（現為待審草稿）。
- **章節 B/C 學習控制器（T-321 刀 K2）**：`js/loop/chapters.js`。倉內原本沒有章節
  B/C 的規格（本檔舊版只有一行未做清單，定義它的 v0.3 規劃包不在追蹤檔內），
  本輪採用人類 2026-09-12 具名裁定的三段式——A＝現行導覽、B＝自己改一個條件、
  C＝回放比較並自述因果——**這是依裁定的定義，不是既有規格的實作**。控制器是
  關卡式：只讀世界事實（`params`／`compartments`／分支旗標）判定，不掃事件流
  （參數已等於目標值時 `applyCommand` 不發事件）；**不代使用者下指令、不判自述
  對錯、不按時間自動前進**；進度存在模組內不寫進 world，也不呼叫
  `Observe.onWorldInstalled()`——切章不是換世界，清掉觀察歷史會讓章節 C 的回放
  當場變成一片缺資料。學習成效仍須人類的五人小樣本驗收（Gate D，尚未執行）。
  **命名注意**：estate 帳本（T-303）另以「Gate C」指模型縱深（貧血／CO₂／體溫），
  與本檔這個 Gate C 不是同一件事；本檔的 Gate C 仍未做。
- Gate D 未做：真實 HTTP 部署載入、實機 FPS、5 人可用性門檻。
- biology_reference 條目為依 S1–S8 一般敘事起草，未經專家逐條審核；
  「來源存在」不等於「已驗證支持」。2026-09-10 由擁有者整批裁定 20 條為
  `verified`（整批裁定，非逐條專家審核）；`model_assumption` 條目為
  `verified-implementation`，只表示程式照該敘述實作。各條以 reviewStatus 為準。
- 觀察歷史不存於執行包（本輪不做 companion 檔）。
- **速率曲線圖（T-319）**：資料來自 `Observe.rateSeries`，每點以該 tick 為右端、
  90 tick（3 模型秒）滾動窗口計算肺端裝載／組織端卸載／組織使用速率，與「看此刻」
  的三個速率讀值同一套算法。右端與基線都必須有實際 tick 記錄且中間連續 n 筆，
  否則該點標 missing——**畫成空白，不插補、不以 0 頂替、不以虛線頂替**；跨觀察斷裂
  （匯入、切分支、暫停記錄）的點一律 missing。三條線以顏色**加**線型區分，圖例為文字，
  顏色不是唯一通道。縱軸上限取當前視窗內的實測最大值並標示數值。

### v0.3.1 修復（回應 v0.3.0 獨立審查 cellscape-v030-review-evidence）

審查確認：既有回歸全綠；內容註冊表 8 卡/32 答/27 主張/8 來源內部連結可解析；
唯讀、匯入重置、分支/實體隔離、觀察器故障隔離等契約通過。9 項 Node 測試中
4 項失敗（對應兩個獨立缺陷）與瀏覽器 7 項中 4 項失敗，全部屬實，修復如下：

| # | 發現 | 修復 | 契約 |
|---|---|---|---|
| 1 | usage_rate 差分基線取 t−N+1 ⇒ 少算一個 tick 區間 | 基線改為 tick t−N 的累積使用；tick 0 之 usage=0 為 ledgerReset 模型事實；其餘缺端點 ⇒ missing-window | METRIC_UNITS_WINDOW |
| 2 | 歷史以樣本數（600）為界 ⇒ 遠離選取的空窗留下過期樣本 | 以分支最後記錄 tick 修剪：樣本须 ≥ lastRecorded−3600（120 模型秒） | 有限歷史契約 |
| 3 | 「約比 2 模型秒前」跨觀察斷裂比較（gap 606 tick 仍報「上升」） | 基準點與最新樣本間隔 >60 tick ⇒ state=missing | NARRATIVE_MATCHES_OBSERVATION |
| 4 | 暫停中切換 A/B，看此刻凍結（渲染閘只用 tick 單值） | 刷新鍵改為 session+分支+實體+tick 複合鍵 | PAUSED_BRANCH_VIEW_CONTEXT |
| 5 | 搜尋結果被即時刷新覆寫；點擊結果卡片不跳轉 | 搜尋詞非空時 tick() 不覆寫；點擊結果＝清除搜尋並導覽至該卡 | SEARCH_CLICK_AND_LIVE_REFRESH |
| 6 | 看此刻重繪使 <details> 展開狀態重置 | 換入 innerHTML 前後保留展開狀態 | EXPANDED_DETAILS_PERSISTENCE |
| 7 | 剖面 modal 內容開啟後靜止（零通量文案過期充數） | 標記觀察時點 tick；運行中隨 tick 重繪 | SECTION_MODAL_TIME_VALIDITY |
| 8 | 曲線最新樣本落在軸中點（定義域固定 0..3600） | 定義域改為 [最早樣本, 最新樣本]，「現在」恆在右緣；左標籤顯示實際跨度 | CHART_CURRENT_AT_RIGHT_EDGE |
| 9 | 手機直向：剖面按鈕被參數面板覆蓋（點擊被攔截） | 檢閱/事件面板開啟時 body class 讓參數面板讓位（visibility:hidden；一次一個主要面板） | 介面 §9 |
| 10 | 看此刻在知識卡語境下語義含糊（非阻塞觀察） | 知識卡開啟看此刻時顯示語境提示（數值來自選取的紅血球；卡片未個別模擬） | KNOWLEDGE_ONLY_CARD_NOW_CONTEXT |

另：自建測試 `atlas-tests.cjs`／`loop-smoke.cjs` 本輪起收錄於
`docs/audit-probes/`（回應上一輪「無法重現作者自建測試」——腳本隨包交付）。

重跑（稽核方原封 `atlas-independent.cjs` 對修復後樹）：**8/9**——剩餘 1 項
（SELECTED_HISTORY_120S_TIME_BOUND）為**探針端診斷欄位崩潰**：其
`lastGapSeconds:(points.at(-1).t−points.at(-2).t)/30` 無條件求值，而修剪後的
歷史合法地僅含 1 個窗內樣本（t=4206，唯一 ≥ cutoff 606 者），`.at(-2)` 為
undefined。產品行為直接驗證：points=[4206] 全部 ≥ 界、recentChange=missing——
pass 條件本身（短路安全）評估為真。原封腳本不予改動，留待下輪複驗確認。
既有全套回歸（loop_contracts 8/8、independent_v021 5/5、independent_v023 3/3、
r3 8/8、r4 7/7、reset-boundary、32 矩陣）零退步；自建 atlas-tests 8/8、
loop-smoke 7/7（已隨包）。


## v0.3.2 私人封存收尾

本輪只改觀察／介面：短窗口按實際觀測秒數描述；選取空窗不算覆蓋時間，舊樣本不冒充目前趨勢；圖右端綁定 world.tick；剖面刷新識別綁定 session／run／branch／entity／tick，匯入後關閉舊剖面；面板互斥 class 完整清理。
MODEL_VERSION=0.2.2 未變，Content 保持原樣；observationVersion=v0.3.2-obs.2。
本次結論以 FINAL-REVIEW.md 與交付證據為準。以上歷次勾選表是歷史紀錄，不代表新增範圍已驗證。
（後續補記）該封存輪當時尚未推送；本倉已於 2026-09-08 推送至 `taipei49314/cellscape`（私有），其後以 PR 進 main，CI 收據見 `docs/verification/ci-receipts-model-0.3.0-0.5.0.md`。
