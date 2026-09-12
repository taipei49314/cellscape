# CELLSCAPE · Living Atlas

**跟著同一顆紅血球，從肺微血管出發，經心臟與體循環，抵達組織，再回到肺。**

產品 **0.5.0**。簡化供氧模型；內部數值是模型單位，不是 SpO₂，也不是臨床指標。

## 啟動

Windows：雙擊 `start.bat`（或在此目錄執行 `.\start.ps1`）。

瀏覽器會打開 [http://127.0.0.1:8642/loop.html](http://127.0.0.1:8642/loop.html)。關掉那個終端視窗即停止伺服器。

其他環境：

```sh
python -m http.server 8642 --bind 127.0.0.1
```

然後打開同一網址。無建置步驟；Three.js 已隨附。

根路徑 `/` 會進入 Living Atlas。舊的八個 Canvas 場景在 [museum.html](museum.html)，與這個世界**不共用模擬狀態**。

## 八分鐘

1. 按「跟著一顆紅血球」。
2. 看它在肺裝載、在組織卸載。
3. 切到自由探索，拉低「肺端供氧」（或提高「貧血程度」）。
4. 等組織水位變化後，切 A/B，用自己的話講「誰造成誰」。

可隨時中斷導覽。空白的曲線表示沒有觀測，不能讀成零。

學習章節（A 跟隨 → B 自己改條件 → C 回放比較）不會替你動滑桿，也不評對錯。五人小樣本腳本見 [docs/TRY.md](docs/TRY.md)；尚未由人類跑完，所以**不宣稱學習成效**。

## 這不是什麼

- 不是臨床模型，也不是全身模擬。
- 氧庫存、負載、速率都未校準成生理單位。
- 舊八景是獨立展示，不是這個連動世界的一部分。

## 檢查

```sh
npm test
```

隨包 47 項 scoped check（Atlas、Loop、模型契約、觀察邊界）。瀏覽器驗收由 CI 在 pool 上跑，不是實機或跨瀏覽器成績。生物學有效不在這份檢查裡。

模型單位、守恆帳、匯入契約與已知限制寫在 [docs/LOOP-NOTES.md](docs/LOOP-NOTES.md)。驗證收據在 [docs/verification/](docs/verification/)。

第三方 Three.js 的 MIT 授權見 `vendor/THREE-LICENSE.txt`。本倉維持私人。
