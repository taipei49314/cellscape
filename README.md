# Cellscape · Living Atlas v0.3.2

**私人封存候選版 · Gate A/B · 2026-09-08**

以程式驅動的細胞展示與互動知識原型。這次交付只收尾資訊層與封存流程，沒有擴充新的生理方程或完成全人體模擬。

## 兩個入口

- `loop.html`：Living Atlas 主入口。固定 48 顆代表性紅血球在同一個簡化供氧世界運行；支援跟隨、參數介入、A/B、JSON 續跑，以及八張角色卡／32 個問答、六項模型讀值、有限歷史與肺泡剖面示意。
- `index.html`：八個舊 Canvas 2D 獨立場景。**不與 Living Atlas 共用模擬狀態。**

本版是 Gate A/B 收尾，不宣稱三個學習章節已完成。知識庫的生物學主張仍有待審項，不等於完整文獻審核或臨床模型。

## 本機啟動

在此目錄開啟終端：

```sh
python -m http.server 8642 --bind 127.0.0.1
```

Windows 可用 `py -m http.server 8642 --bind 127.0.0.1`。
瀏覽器開啟 `http://127.0.0.1:8642/loop.html`。無建置步驟；Three.js r149 已隨附，不需要載入 CDN。
這是啟動方法，並非宣稱本輪已完成部署端對端驗收；本輪瀏覽器環境阻擋直接 HTTP/file 導航，使用記憶體測試頁。

## 操作

按「跟著一顆紅血球」開始導覽，或切「自由探索」。知識面板分為認識它／看此刻／懂機制／查來源；搜尋支援已收錄的名稱與別名。
暫停、A/B、點選、剖面與 JSON 匯入都只顯示所屬工作階段的資料。曲線空白表示沒有觀測，不能解讀成零。

## 重跑

需要 Node.js（本輪使用 22.16.0），不需要 npm 依賴：

```sh
npm test
# 等同 node scripts/test.cjs
```

此命令執行隨包的 Atlas 8 項、Loop 7 項與最終觀察邊界 4 項；**不是完整瀏覽器或生物學驗證**。
完整本輪回歸腳本、瀏覽器記錄與環境限制另存於交付的 evidence ZIP。審查範圍見 `docs/FINAL-REVIEW.md`。

## 版本與資料界線

產品 **0.3.2**；模型 **0.3.0**（0.3.0 新增 `anemia` 貧血參數：肺端裝載上限 = 1 − anemia，守恆帳結構不變）；觀察規則 **v0.3.2-obs.2**。
氧庫存／負載／速率均為未校準的模型數值，不是 SpO₂、血氧分壓或臨床指標。結構圖不是分子模擬。
摘要不是完整事件歷史的身分證明。較早未保存的觀察資料不會由事件尾反推成曲線。

## 封存與私人發布

交付包另有 `cellscape.bundle`、`HANDOFF-MANIFEST.json` 與 `publish_private.py`。
推送器只接受登入帳號 `taipei49314`，目標 `taipei49314/cellscape`，只建立／接受私人倉庫，拒絕覆寫非空且不相同的遠端，不 force push、不開 Pages、不建立公開 Release。
**本輪環境未提供 GitHub 寫入能力，遠端狀態為 NOT_PUSHED。** 只有推送器完成後讀回 private 與 commit SHA，才會產生 `PUSH-RECEIPT.json`。

## 限制與授權

尚未完成正式部署、實機效能、長時間耐力、跨瀏覽器、五人使用性驗收與生物學有效性驗證。
本專案沒有在這次封存中另行授予開源授權；請維持私人倉庫。第三方 Three.js 的 MIT 授權見 `vendor/THREE-LICENSE.txt`；既有素材保持來源狀態，未宣稱已逐項完成公開再散布審查。
歷史 README 保留於 `docs/archive/README-before-freeze.md`，其舊版敘述不作本次驗收保證。
