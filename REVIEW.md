> 歷史審查／交付說明。當前私人封存範圍請見 [FINAL-REVIEW](docs/FINAL-REVIEW.md)；
> 封存後的模型 0.3.0–0.5.0 與其 CI 收據見 [ci-receipts-model-0.3.0-0.5.0](docs/verification/ci-receipts-model-0.3.0-0.5.0.md)。
> 現行進場是 Living Atlas（`loop.html`／根目錄）。下文的 `index.html` 八景現在是 [museum.html](museum.html)。

# CELLSCAPE 審查包 · Review Guide

> 打包日期：2026-09-07 · 版本：概念驗證 v0.1-r4（含三輪獨立稽核之修復與複驗，詳見 `docs/AUDIT-RESPONSE.md`）
> 對應專案目標：可程式化的人體細胞模擬與沉浸式視覺展示系統

---

## 1. 內容物

```
index.html              應用進入點（HUD 骨架）
css/style.css           介面樣式（科幻醫療 HUD、玻璃擬態）
js/data.js              宣告式資料層：8 器官 / 20 細胞類型 / 4 情境腳本 + 擴充 API
js/engine.js            模擬引擎：行為、訊號、路徑流、傷口、情境狀態機
js/render.js            渲染層：全景 / 微觀場景 / 精靈圖快取 / 特效 / 轉場
js/ui.js                HUD：導覽、圖例、檢閱面板、敘事、控制
js/main.js              啟動、主循環、互動、鏡頭
README.md               使用者與開發者文件
REVIEW.md               本文件
docs/screenshots/       實測截圖（自動化瀏覽器 1440×900 擷取）
```

零外部依賴、零建置步驟；所有運算在本機 Canvas 2D 完成，總計約 2,970 行。

## 2. 快速開始

- 直接以 Chrome / Edge 開啟 `index.html`（file:// 即可運作），或：
- `python -m http.server 8642` 後連 `http://127.0.0.1:8642/index.html`

## 3. 建議審查動線（約 5 分鐘）

1. 開啟即見**人體全景**：旋轉 HUD 環、血管流動、掃描線；滑過器官節點有簡介
2. 點擊**肺臟**（或左側圖譜）→ 轉場進入微觀；肺泡環 + 紅血球繞行微血管
3. 右下切換**細菌感染**情境 → 依序看到：病原體湧入 → 危險訊號擴散 →
   IL-8 趨化 → 嗜中性球湧入 → 發炎指數上升（右上儀表 + 畫面紅暈）
4. **點擊任一細胞** → 檢閱面板（角色/狀態/任務/訊號）；開「◎ 追蹤鏡頭」跟隨
5. 滾輪縮放、拖曳平移；按 **Esc** 返回全景
6. 進入**皮膚**，切換**組織修復** → 血小板凝血 → 纖維母細胞沉積膠原 → 傷口閉合
7. 進入**肝臟**，切換**癌化病變** → 突變 → 增殖 → 抗原呈現 → T 細胞毒殺；
   若癌細胞達上限將觸發「免疫逃逸／失控」紅色警示分支
8. 事件按鈕：＋病原體 / ＋傷口 / ＋突變 / ⟲淨化；空白鍵暫停；0.5×–4× 時間軸

## 4. 已驗證項目（對應 docs/screenshots/）

| 項目 | 狀態 | 截圖 |
|---|---|---|
| 人體全景：輪廓、血管流、器官節點、圖譜切換 | ✅ | 01-body-overview.png |
| 肺臟感染：肺泡場景、病原體、危險訊號環 | ✅ | 02-lungs-infection.png |
| 血流感染：紅血球隊列、嗜中性球動員、發炎指數 | ✅ | 03-blood-infection.png |
| 肝臟癌化：微腫瘤聚集 + 細胞檢閱面板（點擊互動） | ✅ | 04-liver-cancer-inspector.png |
| 心臟恆定：心肌收縮波、心跳脈衝環 | ✅ | 05-heart-normal.png |
| 腸道＋傷口事件：鋸齒缺損、發炎邊界、碎片粒子 | ✅ | 06-gut-wound.png |
| 腸道修復：血小板/纖維母細胞招募、膠原沉積敘事 | ✅ | 07-gut-repair.png |
| Esc 返回全景、圖例切換（細胞普查 ↔ 器官圖譜） | ✅ | 01 / 07 |
| CELLSCAPE.run / register* 擴充 API | ✅（載入驗證） | — |

實測期間發現並已修正的缺陷：紅血球路徑參數溢出（血管清空）、無常駐 T 細胞
器官的癌化情境必失控、無血小板器官傷口無人修補、情境敘事佇列堆積。

## 5. 已知限制與建議後續

- 人體輪廓為風格化示意圖，非解剖繪圖
- 細胞行為為教育性簡化（族群動力學層級，非分子級）
- Canvas 2D 粒子規模約數百級；升級路線：WebGPU / OffscreenCanvas
- 情境腳本以情境秒數驅動（1× 設計）；跨器官的劇情強度未逐一調平
- 器官僅 8 個為示意取樣，透過 registerOrgan 可無限擴充（未提供佈局時使用預設散佈）
- 建議後續：藥物介入情境（抗生素/免疫檢查點抑制劑）、JSON 情境匯出匯入、
  細胞內部視圖（粒線體/細胞核）、多語系

## 6. 架構地圖

```
資料層 data.js ──宣告式──▶ 引擎 engine.js ──狀態──▶ 渲染 render.js
   ▲                          │                        │
   └────── CELLSCAPE API ◀────┴────── HUD ui.js ◀─────┘
                                   ▲
                            輸入 main.js（滑鼠/滾輪/鍵盤/轉場調度）
```

- **訊號系統**：7 種訊號（danger/chemokine/antigen/growth/cytokine/pulse/o2）以
  擴散環傳播，僅具對應受器的細胞響應——機制上即「可程式化」的行為開關
- **情境狀態機**：script（時間軸步驟）+ loop（循環規則）+ resolve/fail（解脫條件），
  動作以名稱註冊於 engine.js 的 ACTS 表
- **效能策略**：細胞以預渲染精靈圖（4× 超取樣）繪製；器官背景離屏快取

## 7. 擴充範例

```js
CELLSCAPE.registerCellType('nk', {
  name: 'NK 自然殺手細胞', en: 'Natural Killer Cell',
  color: '#66ffd9', r: 12, shape: 'blob', role: '非特異性毒殺',
  desc: '不需抗原呈現即可攻擊異常細胞的先天免疫細胞。',
});
CELLSCAPE.registerScenario('radiation', {
  name: '輻射損傷', color: '#ffe066',
  intro: '情境載入：游離輻射造成 DNA 雙鏈斷裂。',
  script: [{ t: 1, phase: '曝露期', msg: 'DNA 雙鏈斷裂——修復酶全面動員。' }],
});
```
