# 獨立單曲頁面與 UI 拋光實作計畫 (Song Page & UI Polish)

本計畫旨在將 AI 歌詞與歌曲 AI 賞析等單曲級別功能，從專輯主頁（`/album/:albumId`）中分離，搬移至獨立的單曲頁面（`/album/:albumId/song/:trackId`），並完成細部的 UI 拋光（隱藏系統偵錯資訊、替換自訂 Favicon）。

## User Review Required

> [!IMPORTANT]
> **路由設計選型與 Spotify 結構考量**：
> 針對您提到 Spotify 中單曲可能同時屬於「單曲 EP」與後來的「正式專輯」的情況，這在 Spotify 的資料結構中非常常見。
> 在 Spotify API 中，即使是一首單曲（Single），它也是被包裝在一個 `album` 物件中（其 `album_type` 為 `"single"` 或 `"album"`）。
> 
> 我們之所以建議採用 `/album/:albumId/song/:trackId` 而非單純的 `/song/:trackId`，原因正是為了解決您提到的這個問題：
> 1. **上下文（Context）一致性**：同一首熱門歌曲可能同時收錄在《歌曲A - Single》和《大合輯專輯》中。如果網址只有 `/song/:trackId`，系統將無法得知使用者是從哪一個發行版本點進來的，這會導致左側側邊欄的「選中專輯」與「歌曲清單」在重新整理時無法正確還原。
> 2. **精確的發行版本對齊**：透過 `/album/:albumId/song/:trackId`，我們可以明確告訴系統：「請在《大合輯專輯》的脈絡下展示這首歌」。這樣無論使用者在哪個發行版本中瀏覽，側邊欄與播放連結都會精確對齊他當前選擇的那個發行版本，提供最直覺的體驗。
> 
> 基於上述考量，我們建議維持 `/album/:albumId/song/:trackId` 的設計。您是否同意此分析與規劃？

> [!TIP]
> **系統偵錯資訊隱藏**：
> 我們將使用 Vite 原生的環境變數 `import.meta.env.DEV` 來判斷當前模式：
> * 在**開發模式**下（`npm run dev`），系統偵錯面板將會顯示，以便於實機除錯。
> * 在**生產模式**下（部署後 / 產品展示），系統偵錯面板將會自動隱藏，維持介面精美。

## Open Questions

> [!WARNING]
> 1. 當使用者處於 `/album/:albumId`（尚未點選歌曲）時，右側原本顯示 AI 歌詞的區塊，我們提議顯示一個帶有微動畫的 Glassmorphism 面板，顯示「🎵 請從左側曲目清單中選擇一首歌曲以開始 AI 雙語歌詞與音樂賞析」的提示。您是否有其他希望在此處展示的內容（例如專輯整體的 AI 樂評摘要）？

## Proposed Changes

### 1. 前端路由與頁面元件重構
---

#### [MODIFY] [main.jsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/main.jsx)
- 增加單曲頁面路由匹配：
  `Route path="/album/:albumId/song/:trackId" element={<App />}`

#### [MODIFY] [App.jsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/App.jsx)
- 整合 React Router 的 `useParams` 來額外提取 `trackId`。
- 修改 `useEffect`，根據 `trackId` 來自動載入或切換選中的單曲 `selectedTrack`。
- 當曲目清單點擊時，改用 `navigate` 跳轉至 `/album/:albumId/song/:trackId` 而非單純的 `setSelectedTrack` 狀態更新。
- 只有當 `trackId` 存在時，才將 `AILyricsPanel` 渲染於右側。
- 當 `trackId` 不存在時，渲染一個提示選擇曲目的佔位面板（Placeholder）。

#### [MODIFY] [MetadataPanel.jsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/components/MetadataPanel.jsx)
- 修改「專輯曲目清單」中的歌曲點擊事件，呼叫路由跳轉（`navigate`）。
- 隱藏「系統偵錯資訊」面板，僅在 `import.meta.env.DEV` 為 `true` 時渲染。

---

### 2. 靜態資源更新與後端支援
---

#### [MODIFY] [server.js](file:///Users/pac/codes/interview/music-release-agent/server.js)
- 確保 wildcard `app.get('*')` 能正確匹配並回傳新路由格式下的 `index.html`（新路由符合排除規則，此處不需大幅修改，但需確認其與 `/album/:albumId/song/:trackId` 的相容性）。

#### [NEW] [favicon.svg](file:///Users/pac/codes/interview/music-release-agent/dashboard/public/favicon.svg)
- 覆寫原本的 React icon，設計一個自訂的音樂音符 SVG（使用和 Spotify Green 主題配色相契合的漸層設計）。

---

## Verification Plan

### Automated Tests
- 執行 `npm test` 確保既有單元測試不會因為路由重構而壞掉。
- 調整 `tests/e2e/dashboard.spec.js` 的頁面導向逻辑，以驗證新路由網址變化（`/album/.../song/...`）。

### Manual Verification
1. 進入 `http://localhost:3011/` 選擇專輯，點選後網址更新為 `/album/:albumId`，且右側顯示「請選擇歌曲」的引導卡。
2. 點擊曲目清單中的歌曲，網址更新為 `/album/:albumId/song/:trackId`，且右側順暢載入該歌曲的歌詞與分析。
3. 直接在瀏覽器輸入 `/album/:albumId/song/:trackId` 進行重新整理，確認側邊欄、曲目清單以及歌詞能正確復原載入，無 404 錯誤。
4. 在生產模式建置後，確認系統偵錯面板已被隱藏。
5. 確認網頁標籤頁上的 Favicon 已換成自訂的漸層音樂音符圖示。
