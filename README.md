# Cellscape · Living Atlas（產品 0.3.2＋後續功能 · 模型 0.5.0）

**私有倉（已推送）· Gate A/B 資訊層已收尾，其後另加三個模型維度 · 最後更新 2026-09-11（UTC）**

以程式驅動的細胞展示與互動知識原型。Gate A/B 收尾了資訊層與封存流程；其後陸續加入貧血、CO₂／Bohr 與體溫三個模型維度（模型 0.3.0→0.5.0），仍未完成全人體模擬。

## 兩個入口

- `loop.html`：Living Atlas 主入口。固定 48 顆代表性紅血球在同一個簡化供氧世界運行；支援跟隨、參數介入、A/B、JSON 續跑，以及八張角色卡／32 個問答、七項模型讀值（含血中 CO₂ 指數）、藥物介入快速預設、中英雙語覆蓋層、內部視圖、有限歷史與肺泡剖面示意。
- `index.html`：八個舊 Canvas 2D 獨立場景。**不與 Living Atlas 共用模擬狀態。**

資訊層是 Gate A/B 收尾，不宣稱三個學習章節已完成。知識庫主張分兩類：`verified` 由人類整批裁定，不是逐條專家審核；`verified-implementation` 只表示程式確實照該敘述實作。各條現況以 `js/loop/content.js` 的 `reviewStatus` 為準，都不等於完整文獻審核或臨床模型。

## 本機啟動

在此目錄開啟終端：

```sh
python -m http.server 8642 --bind 127.0.0.1
```

Windows 可用 `py -m http.server 8642 --bind 127.0.0.1`。
瀏覽器開啟 `http://127.0.0.1:8642/loop.html`。無建置步驟；Three.js r149 已隨附，不需要載入 CDN。
這是啟動方法，並非宣稱已完成部署端對端驗收。瀏覽器驗收由 estate runner pool 的 `browser acceptance` workflow 以無頭 Chromium 執行，不是實機或跨瀏覽器驗收。

## 操作

按「跟著一顆紅血球」開始導覽，或切「自由探索」。知識面板分為認識它／看此刻／懂機制／查來源；搜尋支援已收錄的名稱與別名。
暫停、A/B、點選、剖面與 JSON 匯入都只顯示所屬工作階段的資料。曲線空白表示沒有觀測，不能解讀成零。

## 重跑

需要 Node.js（pool CI 目前使用 v22.23.2），不需要 npm 依賴：

```sh
npm test
# 等同 node scripts/test.cjs
```

此命令執行隨包的 Atlas 10 項、Loop 7 項、模型行為契約 7 項與最終觀察邊界 4 項（共 28 項）；**不是完整瀏覽器或生物學驗證**。模型行為契約涵蓋貧血上限、Q10、CO₂ 鉗位與帳目、參數界限與凍結五檔雜湊。
兩道 pool CI（`npm test`、`browser acceptance`）在每個 PR 與 main 推送上執行。封存輪的 evidence ZIP 不在本倉內；審查範圍見 `docs/FINAL-REVIEW.md`，模型 0.3.0–0.5.0 的 CI 收據見 `docs/verification/`。

## 版本與資料界線

產品 **0.3.2**；模型 **0.5.0**（0.3.0 `anemia` 貧血參數；0.4.0 CO₂ 指數與 Bohr 卸載倍率；0.5.0 `temperature` 體溫參數——O₂ 使用量乘 Q10 因子，CO₂ 生產自動連動；守恆帳結構不變）；觀察規則 **v0.3.2-obs.2**。
氧庫存／負載／速率均為未校準的模型數值，不是 SpO₂、血氧分壓或臨床指標。結構圖不是分子模擬。
摘要不是完整事件歷史的身分證明。較早未保存的觀察資料不會由事件尾反推成曲線。

## 封存與私人發布

交付包另有 `cellscape.bundle`、`HANDOFF-MANIFEST.json` 與 `publish_private.py`。
推送器只接受登入帳號 `taipei49314`，目標 `taipei49314/cellscape`，只建立／接受私人倉庫，拒絕覆寫非空且不相同的遠端，不 force push、不開 Pages、不建立公開 Release。
**歷史說明：封存輪當時環境未提供 GitHub 寫入能力，該輪記為 NOT_PUSHED。** 本倉已於 2026-09-08 推送至 `taipei49314/cellscape`（私有），其後的工作都以 PR 進 main；`PUSH-RECEIPT.json` 只在使用該推送器時產生。

## 限制與授權

尚未完成正式部署、實機效能、長時間耐力、跨瀏覽器、五人使用性驗收與生物學有效性驗證。pool 的無頭瀏覽器驗收不等於實機或跨瀏覽器驗收。
本專案沒有在這次封存中另行授予開源授權；請維持私人倉庫。第三方 Three.js 的 MIT 授權見 `vendor/THREE-LICENSE.txt`；既有素材保持來源狀態，未宣稱已逐項完成公開再散布審查。
歷史 README 保留於 `docs/archive/README-before-freeze.md`，其舊版敘述不作本次驗收保證。
