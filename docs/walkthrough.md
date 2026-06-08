# Music Release Agent: Frontend Dashboard 實作總結

恭喜！我們已經成功將原本純後端的 `music-release-agent` 升級為一個具備精美視覺與 AI 互動的 **Full-stack 應用程式**。這次的重構與擴充大幅提升了專案在面試中的「產品展示度」與「技術說服力」。

## 完成的功能亮點

### 1. React + Tailwind CSS 現代化前端 (雙欄設計)
- **技術棧轉換**：我們順應職缺趨勢，採用 Vite + React (Hooks/Functional Components) 打造前端，並成功導入 **Tailwind CSS**。
- **本地庫資料簡介 (左欄)**：點擊專輯後，**立刻載入並呈現本地庫中儲存的元資料**，包括發行日期、曲目數量、作品介紹與 Spotify 連結。大幅提高「即時呈現」的流暢感。
- **AI 雙語歌詞翻譯與賞析 (右欄)**：點擊後改為「手動觸發」，使用者可視需求點擊 **「尋找歌詞與 AI 翻譯」**，此時才會調用後端 Gemini API，防止不必要的 API 呼叫與讀取延遲。
- **Glassmorphism 視覺**：以 Spotify 經典的深色系 (Dark Mode) 為基底，加入毛玻璃效果 (`backdrop-blur`)、半透明邊框 (`border-white/10`) 與動態 Hover 效果，確保第一眼的視覺衝擊力。

### 2. 雙向全端 API 整合
- **`/api/albums`**：後端自動解析 `data/spotify-cache.json` 中繁雜的快取資料，並結合 `followed_artists` 將藝人名稱正確對應注入各專輯，提供給前端乾淨的 JSON 陣列。
- **`/api/lyrics`**：前端發送非同步請求，後端收到 `artistName` 與 `trackName` 後，會透過 `@google/genai` 呼叫 Gemini 2.5 Flash 進行精準且感性的中英雙語歌詞翻譯。

### 3. 社群散播：IG / TikTok 限動分享卡 (隨時匯出與原生分享)
- 我們運用 `html2canvas` 實作了「截圖匯出」機制。
- **即時匯出**：不需要等待 AI 歌詞載入完成。若無歌詞，圖卡會自動帶入由專輯名稱與藝人構成的精美社群行銷 fallback 文案（如：「這首來自《專輯》的動人旋律已正式發行...」），使用者能**隨時隨地**點擊「匯出 IG/TikTok 限動卡」並完成下載。
- **原生分享整合 (Web Share API)**：在行動端裝置（如手機版 Safari/Chrome），系統會自動偵測並呼叫作業系統的 `navigator.share` 原生分享面版，使用者可**直接發送至 Instagram Stories、FB 或 Line**；在電腦端，則會自動降級為一般檔案下載，並跳出引導提示。
- **面試加分**：這項功能不僅展示了複雜的畫布繪製能力，還融合了現代行動網頁 API (`navigator.share`) 的條件判定與優雅降級，完美展示了「如何從 Web App 打通社群行銷的最後一哩路」，是極佳的 User Growth (使用者成長) 案例。

## 如何測試與運行？

因為我們使用了 Vite 的代理機制，開發階段前端（Port 5173）與後端（Port 3011）是分開運行的。如果您對為什麼要分成兩個連接埠感到困惑，請參考特別準備的 [連接埠原理解析與小朋友解說法](file:///Users/pac/codes/interview/music-release-agent/port_architecture_explanation.md) 技術文件。

請開啟 **兩個終端機 (Terminal)** 執行以下指令：

**終端機 1 (啟動後端 Express API 與 AI 服務)**：
```bash
cd /Users/pac/codes/interview/music-release-agent
npm start
```
*(後端會運行在 http://localhost:3011)*

**終端機 2 (啟動前端 React 開發伺服器)**：
```bash
cd /Users/pac/codes/interview/music-release-agent/dashboard
npm run dev
```
*(前端會運行在 http://localhost:5173)*

打開瀏覽器前往 `http://localhost:5173`，你就能享受剛出爐的 Music Release Agent Dashboard 了！

> [!TIP]
> 面試小技巧：在 Demo 時，可以先用左側邊欄隨意切換專輯展示 UI 的流暢度，接著點開 AI 翻譯面板，展現 loading 狀態的細節。最後，一定要在面試官面前點擊「匯出 IG/TikTok 限動卡」，打開那張產生的直式圖片，絕對能讓他們眼睛一亮！
