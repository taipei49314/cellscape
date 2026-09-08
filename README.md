# CELLSCAPE · Living Human Atlas

可程式化的人體細胞沉浸式模擬系統。從人體全景進入、選擇器官、深入微觀尺度，
觀看細胞流動、协作與事件反應；即時切換情境（恆定 / 感染 / 修復 / 癌化），
點擊任一細胞檢閱它的角色、訊號、狀態與任務。

> **v0.2 Living Loop（新）**：跟著同一顆紅血球完成「肺 → 循環 → 組織 → 回肺」的旅程，
> 以簡化供氧模型驅動，支援介入、A/B 比較與回放——開啟 [loop.html](loop.html)，
> 詳見 [docs/LOOP-NOTES.md](docs/LOOP-NOTES.md)。本頁八個場景為「既有獨立場景」，
> 未與 v0.2 連動世界共享狀態。

## 快速開始

無需安裝、無需建置、無外部依賴——直接用瀏覽器開啟：

```
cellscape/index.html
```

> 建議使用 Chrome / Edge。所有運算皆在本機 Canvas 2D 完成。

## 操作

| 動作 | 說明 |
|---|---|
| 點擊發光節點 / 左側器官圖譜 | 進入該器官的微觀世界 |
| `Esc` / 麵包診導覽 | 返回人體全景 |
| 滾輪 | 以游標為中心縮放 |
| 拖曳 | 平移微觀場景 |
| 點擊細胞 | 開啟檢閱面板（角色 / 狀態 / 任務 / 訊號） |
| ◎ 追蹤鏡頭 | 鏡頭跟隨選取的細胞 |
| 情境 chips 或鍵盤 `1-4` | 切換：正常恆定 / 細菌感染 / 組織修復 / 癌化病變 |
| 事件按鈕 | ＋病原體 / ＋傷口 / ＋突變 / ⟲ 淨化 |
| `空白鍵` / 0.5×–4× | 暫停與時間尺度 |

## 模擬了什麼

- **細胞行為**：紅血球沿微血管路徑循環、巨噬細胞巡邏與吞噬、嗜中性球趨化追擊、
  T 細胞 antigen 啟動後精準毒殺、血小板傷緣凝血、纖維母細胞沉積膠原、
  造血幹細胞分化、神經元脈衝傳導、心肌同步收縮波、角質細胞表皮更新、共生菌避險。
- **訊號系統**：danger（DAMP/IL-1）、chemokine（IL-8）、antigen（抗原呈現）、
  growth（PDGF）、cytokine、心跳 pulse——以擴散環傳播，僅被具對應受器的細胞接收。
- **情境狀態機**：每個情境是宣告式腳本（時間軸步驟 + 循環規則 + 解脫條件），
  引擎即時演出並以敘事跑馬燈與階段徽章說明（入侵期 → 動員期 → 清除期 → 痊癒…）。
- **感染動力學**：病原體接觸上皮 → 感染值上升 → 危險訊號 → 免疫動員 →
  清除或細胞裂解釋出更多病原體。
- **傷口癒合**：缺損 → 血小板栓 → PDGF 招募 → 膠原沉積 → 傷口閉合留下疤痕。
- **癌化與免疫監視**：突變 → 失控增殖 → 抗原呈現 → CD8 毒殺，並演出「MHC-I 下調」
  的免疫逃逸分支（可能導致紅色失控警示）。

## 架構

```
index.html        HUD 骨架
css/style.css     介面樣式（玻璃擬態 HUD）
js/data.js        宣告式資料層：器官 / 細胞知識庫 / 情境腳本 + 擴充 API
js/engine.js      模擬引擎：行為、訊號、路徑流、傷口、情境狀態機
js/render.js      渲染：人體全景、八種微觀場景、細胞精靈圖、特效、轉場
js/ui.js          HUD：導覽、圖例、檢閱面板、敘事、控制
js/main.js        啟動、主循環、互動、鏡頭
```

## 可程式化擴充 API

`data.js` 即「可程式化」核心。載入後透過全域 `CELLSCAPE` 物件擴充，
所有系統（渲染、模擬、HUD）會自動採用新內容：

```js
// 新細胞類型
CELLSCAPE.registerCellType('nk', {
  name: 'NK 自然殺手細胞', en: 'Natural Killer Cell',
  color: '#66ffd9', r: 12, shape: 'blob', role: '非特異性毒殺',
  desc: '不需抗原呈現即可攻擊異常細胞的先天免疫細胞。',
});

// 新情境腳本（t 為情境秒數；act 對應 engine.js 內的事件動作）
CELLSCAPE.registerScenario('radiation', {
  name: '輻射損傷', en: 'Radiation Injury', color: '#ffe066',
  intro: '情境載入：游離輻射造成 DNA 雙鏈斷裂。',
  script: [
    { t: 1, phase: '曝露期', msg: 'DNA 雙鏈斷裂——修復酶全面動員。' },
    { t: 5, act: 'mutateOne' },
  ],
});

// 直接導航
CELLSCAPE.run('lungs', 'infection');
CELLSCAPE.state; // → { t, organ, scenario, phase, inflammation, bacteria, ... }
```

未提供專屬佈局的器官會使用預設散佈；`micro.bg` 可挑選八種現成背景樣式
（vessel / alveoli / fiber / neural / hex / villi / trabecula / layers）。

## 路線圖（概念驗證後的延伸）

- WebGPU 粒子升級（10⁴ 級細胞）
- 細胞內部視圖（粒線體 / 細胞核 / 訊息傳遞級聯）
- 藥物介入情境（抗生素、免疫檢查點抑制劑）與劑量參數
- 場景分享：情境腳本以 JSON 匯出 / 匯入
