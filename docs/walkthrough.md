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
- **面試加分**：這項功能不僅展示了複雜 of 畫布繪製能力，還融合了現代行動網頁 API (`navigator.share`) 的條件判定與優雅降級，完美展示了「如何從 Web App 打通社群行銷的最後一哩路」，是極佳的 User Growth (使用者成長) 案例。

### 4. 路由與 URL 狀態管理 (React Router)
- **深層連結與導航**：前端導入了 `react-router-dom`，將專輯選取狀態與 `/album/:albumId` 路徑雙向綁定。不僅支援網址分享、直接造訪指定專輯 (Deep Linking)，更能以瀏覽器「上一頁/下一頁」進行上一張與下一張專輯的切換。
- **後端 Fallback 支援**：在後端 `server.js` 尾端設置 `app.get('*')` wildcard 路由攔截非 API 的前端頁面請求，自動轉發 `dashboard/dist/index.html`，以避免使用者在前端路由頁面重新整理 (F5) 時遭遇後端 Express 拋出 404 錯誤。
- **Race Condition 守衛**：前端在處理 `:albumId` 時，會確保專輯列表非同步載入完成後 (`albums.length > 0`) 才進行路由匹配，防止因為載入順序所導致的空狀態錯誤。

### 5. 獨立單曲頁面與 UI 拋光 (Song Page & UI Polish)
- **單曲專屬 URL**：我們將原本在專輯頁面下的 AI 歌詞與賞析重構，當使用者點擊歌曲清單後，透過 React Router 跳轉至專屬的 `/album/${albumId}/song/${trackId}` 路由，保留側邊欄與專輯資訊上下文的同時，讓單曲擁有獨立的網頁路徑。
- **首頁與專輯頁佔位面板 (Placeholder)**：在尚未點選歌曲時，右側以精緻的 Glassmorphism 卡片引導使用者選擇歌曲，保持介面在無選定單曲時的清爽與美感。
- **偵錯面板優雅隱藏**：我們將「系統偵錯資訊」面板透過 `import.meta.env.DEV` 進行綁定，僅在開發環境渲染，在生產環境中將被自動隱藏以保持乾淨清爽。
- **自訂音樂音符 Favicon**：我們將 React 預設的 favicon 替換為自訂的 Spotify 綠色漸層音樂音符 SVG，讓瀏覽器分頁外觀更加精緻高級。

## 如何測試與運行？

因為我們使用了 Vite 的代理機制，開發階段前端（Port 5173）與後端（Port 3011）是分開運行的。如果您對為什麼要分成兩個連接埠感到困惑，請參考特別準備的 [連接埠原理解析與小朋友解說法](./port_architecture_explanation.md) 技術文件。

請開啟 **兩個終端機 (Terminal)** 執行以下指令：

**終端機 1 (啟動後端 Express API 與 AI 服務)**：
```bash
cd music-release-agent
npm start
```
*(後端會運行在 http://localhost:3011)*

**終端機 2 (啟動前端 React 開發伺服器)**：
```bash
cd music-release-agent/dashboard
npm run dev
```
*(前端會運行在 http://localhost:5173)*

打開瀏覽器前往 `http://localhost:5173`，你就能享受剛出爐的 Music Release Agent Dashboard 了！

## 代碼品質審計與可移植性修復 (Code Quality & Portability Fixes)

為了符合高品質的代碼評審（Code Review）標準，我們針對系統的可移植性與 HTML 渲染語意進行了兩項重要修正：

### 1. 消除硬編碼絕對路徑 (可移植性)
- **問題**：在 [src/gitbook-publisher.js](../src/gitbook-publisher.js) 中，原本使用本地絕對路徑 `/Users/pac/codes/interview/social-dancing-notes` 作為 GitBook 的預設位置，這會導致程式在其他開發者環境或 CI 中因找不到路徑而報錯。
- **修正**：改用 `path.resolve(process.cwd(), '../social-dancing-notes')` 進行相對路徑解析，在保有環境變數（`GITBOOK_PATH`）優先級的同時，讓專案在任何本地環境解壓後均能開箱即用。

### 2. 重構 Markdown 解析器以符合 HTML 語意化標準 (HTML Semantics)
- **問題**：原先使用簡陋的正則表達式 `replace(/^\- (.*$)/gim, '<li>...</li>')` 來解析 AI 生成的無序列表，會產生孤立的 `<li>` 標籤（沒有被 `<ul>` 容器包裹）。且隨後的全域 `\n` 轉 `<br/>` 會在 `<ul>` 內部插入非法的 `<br/>`，違反 HTML5 標準。
- **修正**：將 [AILyricsPanel.jsx](../dashboard/src/components/AILyricsPanel.jsx) 與 [App.jsx](../dashboard/src/App.jsx) 的 Markdown 解析器重構為**狀態化逐行解析器**（Stateful Line-by-Line Parser）。當偵測到 `- ` 開頭時自動補上 `<ul>` 容器，並在離開列表時自動關閉，且過濾掉結構標籤內的 `<br/>`，確保輸出完全符合 HTML 語意與瀏覽器渲染標準。

### 3. 修復模擬沙箱中的失效連結 (Broken Link)
- **問題**：在 [scan-releases-dry.js](../scan-releases-dry.js) 的 `ensureSandboxStructure` 函式中，產生的 `SUMMARY.md` 目錄大綱包含了指向 `new-releases/README.md` 的連結，然而該函式本身並未建立此檔案，導致模擬沙箱中存在失效連結。
- **修正**：在模擬初始結構時，補上 `new-releases/README.md` 的預設檔案建立邏輯，與生產發布器 [gitbook-publisher.js](../src/gitbook-publisher.js) 保持行為一致。

> [!TIP]
> 面試小技巧：在 Demo 時，可以先用左側邊欄隨意切換專輯展示 UI 的流暢度，接著點開曲目清單選擇歌曲，此時網址將會更新為獨立的單曲路由，並展現右側的歌詞翻譯 loading 細節。最後，一定要在面試官面前點擊「匯出 IG/TikTok 限動卡」，打開那張產生的直式圖片，絕對能讓他們眼睛一亮！
