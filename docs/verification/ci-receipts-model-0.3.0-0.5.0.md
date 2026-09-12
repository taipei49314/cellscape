# CI 收據：模型 0.3.0 – 0.6.0（estate runner pool）

> 檔名保留原 0.3.0–0.5.0（避免改名斷連結）；0.5.1 與 0.6.0 的段落在文末。

本檔補記 v0.3.2 封存輪之後三個模型維度的 CI 結果。**這是 CI 收據，不是產品驗收**：
`npm test` 只跑隨包零依賴的 19 項 scoped check；`browser acceptance` 是 pool 上的無頭
Chromium（軟體渲染），不是實機、跨瀏覽器或生物學驗收。封存輪本身的證據仍見
`docs/FINAL-REVIEW.md` 與 `test-summary.json`，本檔不改寫它們。

- 執行主機：estate runner pool 的 self-hosted runner `DESKTOP-D127QSP`（labels 見 EC）。
- 兩個 workflow：`.github/workflows/npm-test.yml`、`.github/workflows/browser-test.yml`。
- 產出時間：2026-09-11（UTC），由 T-316 以 GET 逐筆讀回 GitHub Actions 紀錄後撰寫。
- run 的 log 由 GitHub 保留約 90 天，因此下表直接寫入當時的摘要行與數字。

## 模型 0.3.0（貧血 `anemia`）— PR #7，squash `797ddbf`

| 位置 | run | 結論 | 摘要 |
|---|---|---|---|
| PR head `9eb33ab` | `34490767339` npm test | failure | `FAIL old-version-and-malformed-rejected`（`oldRejected:false`）→ `1 FAILURES`；同 PR 下一個 head 修正 |
| PR head `3adb130` | `34491084580` npm test | success | `ALL 8 PASS`／`PASS MODEL_VERSION=0.3.0 got 0.3.0`／`ALL 7 SMOKE CHECKS PASS`／claims `passed:4 failed:0`／`19 scoped checks passed.` |
| main `797ddbf` | `34491385922` npm test | success | 同上摘要行 |

**缺口**：0.3.0 當時 `browser acceptance` workflow 尚未存在（由 PR #9 引入），因此該版沒有瀏覽器驗收收據——是「當時不存在」，不是遺失。

## 模型 0.4.0（CO₂ 指數與 Bohr 卸載倍率）— PR #10，squash `8511e19`

| 位置 | run | 結論 | 摘要 |
|---|---|---|---|
| PR head `ef66452` | `34496684544` npm test | success | `ALL 8 PASS`／`PASS MODEL_VERSION=0.4.0 got 0.4.0`／`ALL 7 SMOKE CHECKS PASS`／claims `passed:4 failed:0`／`19 scoped checks passed.` |
| PR head `ef66452` | `34496684555` browser acceptance | success | `BROWSER ACCEPTANCE: ALL 9 PASS`；perf `sampleMs 8000, frames 481, fps 60.01, ticksAdvanced 350, pass true` |
| main `8511e19` | `34496940378` npm test | success | 同上摘要行（0.4.0） |
| main `8511e19` | `34496940261` browser acceptance | success | `ALL 9 PASS`；perf `frames 481, fps 60.02, ticksAdvanced 350` |

## 模型 0.5.0（體溫 `temperature`，Q10）— PR #12，squash `16dcce1`（現行 main）

| 位置 | run | 結論 | 摘要 |
|---|---|---|---|
| PR head `ba38a38` | `34500440694` npm test | success | `ALL 8 PASS`／`PASS MODEL_VERSION=0.5.0 got 0.5.0`／`ALL 7 SMOKE CHECKS PASS`／claims `passed:4 failed:0`／`19 scoped checks passed.` |
| PR head `ba38a38` | `34500440784` browser acceptance | success | `ALL 9 PASS`；perf `frames 481, fps 60.01, ticksAdvanced 350` |
| main `16dcce1` | `34500933374` npm test | success | 同上摘要行（0.5.0） |
| main `16dcce1` | `34500933386` browser acceptance | success | 9 條逐條 PASS（`loop-loads`／`loop-no-errors-so-far`／`follow-starts-inspector`／`anemia-slider-present`／`model-advances tick 110 → 170`／`search-hits-en-alias`／`export-path-fires`／`index-loads`／`index-no-errors`）；perf `sampleMs 8000, frames 481, fps 60.02, ticksAdvanced 350, pageErrors []` |

## 同期其他 PR

| PR | squash | CI |
|---|---|---|
| #8（20 條 biology_reference → verified） | `85db2fc` | head `34492040217`、main `34492344644`，皆 npm test success |
| #9（browser acceptance workflow ＋ perf baseline） | `dd0da01` | 最終 head `0e8355d`：`34494334672` npm test、`34494334521` acceptance 皆 success；main：`34494583153`／`34494583152` 皆 success |
| #11（C-model-co2 → verified） | `c20bd58` | head `34500078303`／`34500078294`、main `34500255762`／`34500255727`，皆 success |

PR #9 在架設 harness 期間有五個紅：`34492303828`（缺 `headless_shell.exe`）、`34492525434`（缺
`chrome.exe`）、`34492958990`（favicon 404 使 `loop-no-errors-so-far`／`index-no-errors` 失敗）、
`34493394554`（9 條斷言全過，收尾 `TargetClosedError` 使 job 退出非零）、`34493939544`（測試全過，
`Artifact storage quota has been hit` 使 job 紅）。這些是環境與 harness 問題，不是產品回歸；
artifact 上傳其後移除，效能數字改以 step log 為收據。

## 這份收據不涵蓋的事

1. **主張分級沒有 CI 覆蓋**：#8、#11 的 `reviewStatus` 升級沒有任何工作流驗證，`npm test` 自己的
   結尾行就寫著 `Browser, deployment and biology are separate acceptance scopes.`。
2. **效能數字是相對回歸基準**：perf baseline 自帶說明 `pool self-hosted, headless chromium
   (software rendering) — relative regression baseline, NOT real-machine performance`，且 fps 都貼在
   60.01–60.04（vsync 飽和），不足以偵測退化。
3. **三個新模型維度沒有行為斷言**：0.3.0–0.5.0 的 19 項 scoped check 只驗到 `MODEL_VERSION` 字串，
   沒有貧血上限、Q10 因子、Bohr 倍率、CO₂ 帳的行為測試。
4. **兩套版本號**：瀏覽器驗收抓到的頁面標題仍是 `CELLSCAPE · Living Atlas v0.3.2`（產品版），
   與 `MODEL_VERSION`（模型版）是不同的東西，不可混用。
5. 實機效能、熱行為、長時間耐力、跨瀏覽器、五人可用性與生物學有效性，全部未做。

## 模型 0.5.1（CO₂ 匯入修復與遲滯）— PR #15，squash `8c34630b`（T-316 刀 D2）

先在未修正的 main 上以負向對照證明測試抓得到缺陷（分支 `test/co2-negative-control-t316`，run
`34658515799`、`34658809829` 皆 2 FAILURES：`SNAPSHOT_REJECTED: bad-event-rule`、`packHasFlags:false`、
遲滯 `bandTicks:189` 但 `midHold:false`）。修正後 PR head run `34658603317` 起，
`co2-event-export-import-continues` 轉 PASS；合併後 main `34659043853` npm test、`34659043855`
browser acceptance 皆 success。

## 模型 0.6.0（perfusion 血流再分配）— T-317 D4

PR-head 與合併後 main 的 run ID 見 estate-consolidation 的 T-317 證據（本檔在該刀開 PR 時寫入，
合併後的 main run 不回填本檔，以免與「不改寫歷史收據」的做法混淆）。本刀新增兩項行為契約：
`perfusion-neutral-at-1`（1.0 與未設定世界逐拍摘要相同）與 `perfusion-scales-tissue-delivery`
（低／基準／高灌流的組織庫存單調、低灌流時平均負載上升、守恆殘差 ≤1e-6）。
