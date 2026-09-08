# CELLSCAPE 稽核回應 · Audit Response（r4 / v0.2 輪）

> 回應對象：第一輪稽核、第二輪複驗（r2）、第三輪（r3）、第四輪（r4）、
> **v0.2 Living Loop 獨立審查**（cellscape-v02-review-evidence）、
> **v0.2.2 複驗**（cellscape-v022-review-evidence）、
> **v0.2.3 複驗**（cellscape-v023-review-evidence）。
> 本版本：v0.2.4（MODEL_VERSION 0.2.2）· 日期：2026-09-08

## 0. 狀態總覽

| 輪次 | 結果 |
|---|---|
| r2 | 「14 項全數修復」宣稱超出證據（deployT 分派回歸、DPR CSS 尺寸、抗原門控自補前提、遠方隔空修復）——已於 r3 修正並如實更正宣稱 |
| r3 | 第二輪複驗確認 r3 六項主張結案（deployT 正例計數、DPR 桌面/手機 DPR1&2、抗原來源無菌反例+四種子正例、傷口局部性全程軌跡、突變來源顯示、390×844 檢閱面板）；另提出 **P1：RESET_DEAD_CELL_DIVISION** 與 reset 語義/血統/橫向佈局觀察 |
| **r4** | **P1 與全部觀察項處理完畢，複驗全數通過（見 §2、§3）** |

## 1. 第三輪新發現：RESET_DEAD_CELL_DIVISION（P1）

**根因**：`updateCell` 缺少死亡守衛。`purge()`/`setScenario()`/T 細胞毒殺僅標記 `dead`，
細胞屍仍在陣列中直到影格末過濾；下一步更新時死細胞照常執行行為——
分裂計時已歸零的母細胞因此能在死後產生子細胞。

**修復**：`updateCell` 進入點加上 `if (c.dead) return;`——死細胞不執行任何行為
（分裂、移動、感染進程、訊號反應）。

**複驗**：
- 稽核方 `reset-boundary-probe.cjs` 原封重跑（skin、單顆植入腫瘤、自然推進至
  `divT ≤ dt`、呼叫真實重置方法、再推進一影格）：`purge → pass`、`setScenario → pass`、
  `cancers_after = 0`。
- Chromium 實際按鈕路徑：癌細胞 `divT=0.005` 時點擊真實「⟲ 淨化」鈕，跨越一影格後
  `cancers=0`、無殘留屍體、零頁面例外。
- 一般化探針：毒殺（lysis）與分裂邊界交疊 → 死後子代 `0`。

## 2. reset 語義規格化（回應「reset semantics must be specified」）

| 操作 | 異常實體 | 感染狀態 | 進行中呈現 | 哨兵 antigenStock | 訊號環/脈衝 | 場景旗標 |
|---|---|---|---|---|---|---|
| `⟲ 淨化`（完全重置） | 清除 | 清除 | 中斷 | **歸零** | 清除 | 歸零 |
| 情境切換（軟重置） | 清除 | 清除 | 中斷 | **保留** | 清除 | 歸零 |

理由：淨化宣稱「完全重置」，故不含任何歷史（含吞噬記憶）；情境切換是同一器官
造訪內的換場，哨兵庫存是**真實吞噬的歷史事實**，予以保留——剩餘庫存可自然恢復
呈現（稽核觀察到的 ~2.63s 恢復現象，即為此語義的預期行為，非缺陷）。
兩種語義皆已寫入 `engine.js` 註解並以探針固定：

- `purge-full-reset`：呈現中斷、stock 0、signals 0、pulses 0、tReady false ✓
- `setScenario-soft-reset`：呈現中斷、stock 保留、signals 0 ✓

## 3. 其餘觀察項

- **腫瘤血統**：`planted` 旗標隨分裂遺傳，新增 `gen` 世代計數，檢閱面板顯示
  「第 N 代」。探針：植入種子的子代 `planted=true, gen≥1` ✓
- **橫向矮幕（≤500px 高）**：檢閱面板改為右側停靠（先前底部抽出式在 844×390
  與圖例重疊 163.8px、四列中心全被遮）。實測 844×390：面板 left=564、
  五列圖例中心被遮數 = **0**。
- 390×844 直式：維持底部抽出式，稽核已確認結案。

## 4. r3 主張之回歸確認（第三輪重跑，r4 修復後）

| 套件 | 結果 |
|---|---|
| `legacy-a/engine_check.cjs`（32 矩陣 + 契約測試） | 零例外、零錯誤 |
| `legacy-b/probe_engine.js`（32×45s） | 零錯誤 |
| `r3-independent-probes.cjs`（8 主張群組） | **8/8 passed** |
| `reset-boundary-probe.cjs`（P1 反例） | 2/2 passed |
| 作者探針 `r3-probes.cjs` | 4/4 passed（含延長 18s 抗原反例、自然呈現鏈 2.65s） |
| 新增 r4 探針 | 4/4 passed |
| 語法檢查 | 5 檔通過 |

（註：`r2-contracts` 之 MUTATION_PROVENANCE 舊判定按稽核方說明以旗標+訊息新測試
取代，非靜默弱化。）

## 5. 誠實的驗收邊界（維持不變）

- 抗原鏈為「吞噬 → 庫存 → 呈現 → 啟動」的最低限度可追溯流程；劇本步驟屬導覽介入。
- 癒合「作用中」判定以距離閾值近似。
- file:// / HTTP 導航於稽核環境仍受阻；部署路由、真實裝置、長時效能、生物學效度未驗證。
- 檢閱面板血統顯示僅至「第 N 代」與植入標示，未建完整譜系樹。

---
*r4 修復範圍：engine.js（死細胞守衛／重置語義／血統遺傳）、style.css（橫向佈局）、
ui.js（世代顯示）。*

---

# v0.2 Living Loop 審查輪回應

審查確認：守恆/確定性/身分/匯出續行/唯讀渲染等正面契約成立；舊套件（32 矩陣、
r3 8/8、reset-boundary、r4 探針除 1 項）無回歸；原硬重置抗原洩漏已修復。
以下為 9 項確認發現與 4 項診斷觀察的處置（v0.2.1）：

| # | 發現 | 處置 | 複驗 |
|---|---|---|---|
| 1 | 主循環未呼叫 `Tour.update`——導覽卡在第 0 步 | 主迴圈每模型 tick 呼叫 `Tour.update` | 出貨路徑幫浦驗證：導覽推進至自然收幕（tourDone），零例外 |
| 2 | FOLLOW 視角從未被 UI/導覽選用 | `followNextRBC` 觸發 `setView('FOLLOW')` | 點擊主按鈕後 `Render.view === 'FOLLOW'` |
| 3 | 首次介入的待處理 command 被複製進基線分支 | `ensureBranch` 清空 `branchA.pendingCommands` | 介入後 `pendA=0, actA=0` |
| 4 | A 視圖渲染基線但 HUD 讀 B | `_tickUI`／時鐘改讀「顯示中的世界」 | 切換 A/B 徽章與時鐘/檢閱值同步 |
| 5 | 匯出遺失事件與閾值旗標 ⇒ 匯入後重複閾值事件 | 快照/執行包含 `events` 尾與 `_tissueLow/_lastTissueLevel/_lastParamEvent` | IMPORT_EVENT_CONTINUATION：續行無重複、無遺漏 |
| 6 | 匯入驗證過淺（畸形包 9/10 被接受 ⇒ 迴圈爆炸） | 深驗證：dt/實體欄位（邊界、有限值、數量=48）/庫存非負不超容/參數界限/帳本/pending/`rulesSummary` 逐項比對 | IMPORT_VALIDATION_NEGATIVE_CASES：10/10 顯式拒絕 |
| 7 | Canvas 點選被 `e.target !== currentTarget` 過濾掉 | 綁定至 renderer canvas、移除過濾 | 派發 click 於 RBC 投影位置 ⇒ `selectedId` 命中 |
| 8 | 零通量仍繪交換粒子（密度用庫存水位下限） | 密度改由**模型每 tick 實測通量**驅動、無下限 | 通量歸零 ⇒ 粒子歸零；比例隨通量變化 |
| 9 | handoff 事件 regionId 為 null；因果鏈 UI 未實作 | regionId = 抵達邊 ID；事件面板點擊展開父鏈 | 閾值事件展開顯示「指令 → 閾值」鏈 |

診斷觀察處置：①移交後同 tick 交換改以**抵達邊**為準（HANDOFF_EXCHANGE_BOUNDARY
通過）並寫為離散時間邊界契約；②摘要涵蓋補全（pendingCommands + cap，納入
MODEL_STATE_DIGEST_COVERAGE 契約）；③站點幾何對齊改為弧長內插契約
（`uStations`）；④肺端裝載公式改為趨向肺泡水位（移除可用量相乘），
基線組織水位可達閾值（DEFAULT_TOUR_THRESHOLDS 通過：maxLoad 0.979、
maxTissue 0.472@tick1637），導覽結尾步逾時亦正確收幕。

r4 探針補遺：`PURGE_CLEARS_DOCUMENTED_SCENARIO_FLAGS` —— purge 補齊
`failT`/`tAware` 重置（setScenario 同步），重跑 **7/7**。

重跑結果：`loop_contracts.cjs` **8/8**；`r4-independent` **7/7**；
`legacy-a` 32 矩陣零例外；`reset-boundary`、`r3-independent` exit 0；
出貨路徑（主循環幫浦）零例外、導覽自然收幕。

仍未驗證（誠實邊界維持）：HTTP/file 導航於稽核環境、真實部署、實際裝置
FPS、長時耐力、生物學效度。

---

# v0.2.1 審查輪回應（v0.2.2 修復）

審查確認：v0.2.1 七項修復全部結案（loop_contracts 8/8、r3 8/8、r4 7/7、死細胞
守衛 2/2、32 矩陣零例外、導覽於真實 Main 回呼自然收幕 tick 2020、無逾時步）。
七項新發現（範圍均小於前輪）處置如下（v0.2.2）：

| # | 發現 | 處置 |
|---|---|---|
| 1 | MODEL_VERSION 別名：新舊交換方程式共用 0.2.0，舊執行包被靜默續用 | 版本升至 **0.2.1** 並明文化「方程式變更必須升版」；舊包匯入即顯式拒絕 |
| 2 | `events=[null]` 與重複實體 ID 被匯入驗證接受 | 深驗證：事件逐筆（eventId/tick/kind/parents 結構）+ 實體 ID 唯一性 |
| 3 | 暫停中切換 A/B，HUD 維持舊值（tick%10 閘門） | `toggleBranch` 觸發 `force` 刷新；實測暫停切換即時反映 A 值 |
| 4 | 分支於 Tour.update 內建立 ⇒ A 恆多 1 tick | 迴圈記錄 `hadBranch`，建立當 tick 不多走——A/B 鎖步同 tick |
| 5 | digest 未涵蓋 tissueLow 旗標（未來事件行為不同卻同摘要） | digest 補入 `tissueLow / lastTissueLevel / lastParamEvent` |
| 6 | 因果鏈展開被下一幀例行清單覆寫 | 展開狀態持久化（`_expandedEventId`），例行渲染改繪鏈內容；可再點收合 |
| 7 | 零通量後粒子池殘留 2 顆（+2 排空遲滯） | 改精確排空：零通量 fixture 實測兩池均為 **0** |

另依觀察修正導覽 step5 字幕：其 until 為 OR 條件，結論字幕移至後續步驟，
不再預設「組織低水位」成因。

重跑結果：稽核方 `loop_contracts.cjs` **8/8**（含事件續行、畸形包 10/10 拒絕、
移交邊界、摘要覆蓋、預設閾值可達）；`v0.2` 自建探針 7/7；`m0-probe` 通過；
legacy 全套 exit 0。瀏覽器出貨路徑：分支乾淨（pendA=0/actA=0）、A/B 同 tick
鎖步、暫停切換即時刷新、因果鏈持久、零通量零粒子。

誠實邊界維持：部署路由、真實裝置 FPS、長時耐力、跨瀏覽器、生物學效度未驗證。

---

# v0.2.2 複驗輪回應（v0.2.3 修復）

複驗確認：v0.2.2 全部舊套件綠燈（loop_contracts 8/8、independent_v021 5/5、
r3 8/8、r4 7/7、死細胞守衛 2/2、legacy 32 矩陣零錯誤列、導覽於真實主循環
tick 2020 自然收幕、A/B 偏移集合 = {0}），七項特定反例全數通過。4 項確認
殘留發現與 1 項標記注入觀察處置如下：

| # | 發現 | 根因（對照源碼確認屬實） | 處置 |
|---|---|---|---|
| 1 | EXPANDED_CHAIN_FREEZES_HUD：因果鏈展開 300 tick 後 HUD 凍結在 tick 140／24%／00:04 | `main.js _tickUI` 展開時提前 `return`，跳過時鐘/tick/水位/檢閱更新 | HUD 數值欄位改為**總是更新**，僅事件清單區在展開期間持續渲染鏈內容（新契約 EXPANDED_CHAIN_HUD_LIVE；EVENT_CHAIN_OVERWRITTEN 不變） |
| 2 | CROSS_BRANCH_EVENT_ID_ALIAS：展開中切到 A，event 92 解析為 A 的同號無關事件（t138 handoff） | `_expandedEventId` 為裸數字；eventId 是分支局部配號，切換後在另一世界查同名 | `toggleBranch` 即收合展開（新契約 EVENT_ID_BRANCH_LOCAL：展開屬於顯示中的世界）；切回後維持收合（收合是狀態變更，非隱藏） |
| 3 | IMPORTED_COMMAND_NULL_AFTER：真實匯出的 command 事件 `after:null` 被接受，下一影格 UI 拋 TypeError | `validateSnapshot` 僅驗事件結構（eventId/tick/kind/parents），未驗 kind 相依 payload | 深驗證：command `{key∈參數界限, value 有限數}`、handoff actorId/regionId/`{edge,s}`、threshold ruleId+level、eventId 環內唯一且落後 eventSeq；UI 另加防禦 fallback |
| 4 | DIGEST_SCOPE：閾值旗標案例通過，但事件流分歧（eventSeq 813 vs 814）後摘要重新收斂——摘要相等不保證後續配號一致 | digest 未含 `eventSeq` | digest 納入 eventSeq；重跑複驗同一案例：分歧後 digestA=`012ffb75` ≠ digestB=`4678ba8e`（摘要相等 ⇒ 配號一致） |
| 5 | IMPORT_TEXT_INTERPRETED_AS_MARKUP（觀察）：注入事件 source 的 SVG 字串建立 DOM 元素（script 標記未執行，稽核方未宣稱 XSS） | `#eventList` 以 `innerHTML` 內插 `ev.source` 等未跳脫字串 | 新增 `esc()`：source/regionId/ruleId/key 等所有字串內插一律 HTML 跳脫（IMPORT_TEXT_PLAINTEXT 契約） |
| 6 | TOUR_STATE_SURVIVES_IMPORT（v0.2.3 交付後補發現，同一版內修復）：導覽進行中載入有效存檔，舊導覽仍啟用並對新世界下 `source='tour'` 指令（tick 4242→0.12、tick 4533→0.85），乾淨續行對照組維持 0.4 | 匯入只替換 `M.world`，`Tour.active/idx` 與模式等 UI 狀態原樣繼承；舊步驟的 `until/onEnter` 繼續對匯入世界評估與下指令 | 匯入成功即 `setMode('explore')`（內含 `Tour.stop()`）並復位 `idx/waited`；同契約一併復位 `activeIsA`、`branchA`、`_expandedEventId` 並 `_tickUI(true)`（IMPORT_STOPS_TOUR 契約——導覽/A/B 顯示/因果鏈展開皆屬「被替換的舊世界」，不跨匯入繼承） |

**MODEL_VERSION 0.2.1 → 0.2.2**：本版**無交換方程式變更**；升版原因為檢查點
身分契約變更（digest 正規化納入 eventSeq、事件 payload 深驗證）——舊包之
digestChainTail 以舊正規化計算，無法跨正規化延續，故顯式拒絕而非靜默混鏈。
`docs/samples/sample-run.json` 已以 0.2.2 重產（tick 1200、812 事件、
tissueLow=true），PACKAGED_SAMPLE 契約重驗通過。

重跑結果（稽核方原封腳本，v0.2.3 樹）：
`loop_contracts.cjs` **8/8**；`independent_v021.cjs` **5/5**（含舊包拒絕、
結構負例、樣本相容）；`r3-independent` **8/8**；`r4-independent` **7/7**；
`reset-boundary-probe.cjs` exit 0；`engine_check.cjs` 32 矩陣零錯誤列；
作者探針 r3 7 測試 + r4 4 測試與稽核留存基線**零差異**；
自建冒煙探針 **7/7**（守恆殘差 4.5e-13、確定性摘要鏈、匯出匯入續行、
payload 負例拒絕）。

瀏覽器重驗（真實頁面、真實控制項與 file input，暫停+確定性步進推進）：
- 展開閾值事件（event 92，與稽核基線同點 tick 132）後運行至 world tick 306：
  HUD 同步顯示 **tick 300／14%／00:10**，鏈持續顯示（chains=2）——凍結消除。
- 展開中點擊 A/B 切換：expanded **9540 → null**、清單頭為例行移交列
  （不再以同號事件凑鏈）；切回 B 維持收合；再展開→點收合列正常。
- `after:null` 包經真實 file input 匯入：字幕顯示
  **SNAPSHOT_REJECTED: bad-event-payload**，世界物件與狀態不變、零例外。
- source 帶 `<svg onload=…>` 的包：匯入接受（source 為記錄標籤），事件列
  **零 SVG 元素、標記文字以跳脫純文字呈現**（截圖
  `docs/screenshots/15-loop-chain-escaped-hud-live.png`）、注入 onload 未執行。

TOUR_STATE_SURVIVES_IMPORT 複驗（瀏覽器，真實檔案輸入載入未修改的
`docs/samples/sample-run.json`）：導覽 tick 100（idx 1）時匯入 → 即時
`tour=false, idx=0, mode=explore`、參數 0.4、滑桿解鎖；續行 4800 tick 至
tick 6009：**零**新增 command/tour 事件、**零**新增 actions、lungSupply 維持
**0.4**——與 Node 乾淨續行對照組（tick 6000、0.4、零 command）一致。
展開（eventId 1296、2 鏈）與 A 分支顯示中匯入 → `expanded=null`、`activeIsA=false`、
`branchA=null`，零例外。本項為 UI 層修復，模型契約與 digest 不變，
故 MODEL_VERSION 維持 0.2.2、版本維持 v0.2.3（原 zip 原地重打包）。

誠實邊界維持：部署路由（HTTP/file 導航於稽核環境受阻）、真實裝置 FPS、
長時耐力、跨瀏覽器、生物學效度、全種子組合未驗證。本輪瀏覽器數據取自
受控時脈/確定性步進，不構成實機幀率主張。

---

# v0.2.3 複驗輪回應（v0.2.4 修復）

複驗確認（對 cellscape-v0.2.3-living-loop.zip，SHA-256 收據見其
source-integrity.json）：五項 v0.2.2 反例於受測路徑全數結案；全套回歸綠燈
（loop_contracts 8/8、independent_v021 5/5、r3 8/8、r4 7/7、legacy 32 矩陣
零錯誤、死細胞 2/2）；導覽 tick 2020 自然收幕、A/B 偏移 {0}；新套件
`independent_v023.cjs` **3/3**（16 項 kind 相依 payload 單欄位負例全數顯式
拒絕＋自然正例控制、版本/樣本檢查、eventSeq 摘要分歧兩側成立）。

**時序說明（重要）**：本輪記錄的 `VALID_IMPORT_SESSION_CONTEXT_NOT_RESET`
（舊導覽對匯入世界下 tour 指令，tick 4242→0.12、tick 4533→0.85）測於**修復前**
的 v0.2.3 包——其 main.js 雜湊（4c19533b…）與修復後樹（6dcee070…）不同。
該項已於 v0.2.3 交付後、本輪證據包製作同期以 `IMPORT_STOPS_TOUR` 契約修復
（匯入即停導覽並復位 A/B/展開；見前節第 6 項），非本輪新修。

本輪證據另有兩項新資訊，處置如下：

| # | 項目 | 處置 |
|---|---|---|
| 1 | 匯入後 UI 殘留之**滑桿位置**：舊世界滑桿 0.00 與載入世界 0.4 不同步（證據 importWhileExpanded.after.sliders） | 匯入成功路徑補 `_syncParamsUI()`——滑桿位置與數值標籤以載入世界的參數為準（IMPORT_UI_STATE_RESET 契約的一部分） |
| 2 | `DIGEST_IS_NOT_EVENT_HISTORY_IDENTITY`（觀察，非閘門）：同數值演化、同 eventSeq、同摘要，command 事件 `source` 標籤不同（user vs tour）⇒ 事件字串不等 | **接受措辭收斂**：LOOP-NOTES 摘要段明文化「摘要不涵蓋事件來源標籤等證據性欄位或事件史內容本身；摘要相等不宣稱完整事件史一致——事件史證據完整性由事件尾與 IMPORT_EVENT_CONTINUATION 契約承擔」。不加摘要欄位（標籤不影響未來演化，入摘要將違反摘要範圍定義） |

v0.2.4 重驗（稽核方原封腳本，對修復後樹與交付包）：
`independent_v023.cjs` **3/3**（觀察項記錄為非閘門）；`loop_contracts` 8/8、
`independent_v021` 5/5、`r3` 8/8、`r4` 7/7、`reset-boundary`、`engine_check`
32 矩陣零錯誤列；作者探針 r3/r4 與基線零差異；自建冒煙 7/7。

瀏覽器重驗（真實檔案輸入，稽核方 import-context-long 同情境）：
導覽 tick 100／idx 1 匯入未修改範例 → 即時 `tour=false, idx=0, mode=explore`、
滑桿即同步 0.4；與乾淨續行**並走 4800 tick 至 tick 6009**：零新增 command/tour
事件、零 actions、UI 世界與續行 **digest 相等（49d9c4a4 == 49d9c4a4）**、
參數兩側均 0.4。展開中（eventId 4704、2 鏈）匯入 → `expanded=null`、鏈收合、
滑桿 0.4／標籤 0.40 與世界一致，零例外。

MODEL_VERSION 維持 **0.2.2**：本輪變更為 UI 層（匯入路徑滑桿同步）與文件措辭，
模型契約、digest、匯入驗證皆不變。版本按釋出計數升為 **v0.2.4**
（先例：v0.2.1 包同樣搭載未升版的模型 0.2.0）。

誠實邊界維持：部署路由（HTTP/file 導航於稽核環境受阻）、真實裝置 FPS、
長時耐力、跨瀏覽器、生物學效度、全種子組合未驗證。瀏覽器數據取自受控時脈/
確定性步進，不構成實機幀率主張。

---

# v0.2.4 複驗輪回應（v0.2.5 修復）

複驗結論（對 cellscape-v0.2.4-living-loop.zip，SHA-256 157c77c3…，35 檔未修改）：
**通過**。全套回歸綠燈（loop_contracts 8/8、independent_v021 5/5、
independent_v023 3/3、r3 8/8、r4 7/7、reset-boundary 2/2、legacy 32 矩陣零錯誤列）；
新瀏覽器契約 **5/5**（匯入生命週期：舊導覽停止、A/B 與事件選取復位、三支滑桿
全同步、4800 tick 續行與乾淨對照在 tick 6000 相等——含完整匯出 JSON 相等、
包內合法指令（含一筆 tour 標記）完整保留）；原反例重跑 zero tour 動作、
digest 相等；導覽 tick 2020 自然收幕、A/B 偏移 {0}；渲染唯讀、零通量零粒子、
DPR 三視窗檢查通過。digest 範圍限制被接受為文件註記（非完整事件史同一性主張）。

唯一記錄項為**非阻塞外觀觀察**（cosmetic-observation.json）：A/B 切換鈕在
無分支時仍可見、點擊無效果。對照源碼屬實：`_setBranchBadge()` 只控制徽章
顯隱，切換鈕僅在 `ensureBranch()` 時被打開、匯入清空分支後無人復位。

| # | 項目 | 處置 | 複驗 |
|---|---|---|---|
| 1 | 匯入/無分支時 A/B 切換鈕殘留可見（點擊為 no-op） | `_setBranchBadge()` 統一控制切換鈕顯隱：僅分支存在時顯示 | 瀏覽器：初始隱藏 → 建分支出現、切換正常 → 匯入後按鈕與徽章皆隱藏、世界正確、零例外 |

本項為純 UI 可見性修復，模型契約、digest、匯入驗證皆不變，MODEL_VERSION
維持 **0.2.2**；版本按釋出計數升為 **v0.2.5**。重跑：loop_contracts 8/8、
independent_v023 3/3、自建冒煙 7/7（UI 層變更，Node 契約不受影響）。

誠實邊界維持：部署路由、真實裝置 FPS、長時耐力、跨瀏覽器、生物學效度、
全種子組合未驗證。
