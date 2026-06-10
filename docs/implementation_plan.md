# Music Release Agent Dashboard - Implementation Plan

為了將 `music-release-agent` 提升為具備完整視覺化體驗與社群分享功能的 Full-stack AI 產品，我們將在現有專案中加入一個前端 Dashboard，並擴充後端 API。

## User Review Required

> [!IMPORTANT]
> **前端框架選擇**：因應市場職缺趨勢，決定採用 **Vite + React (Hooks & Functional Components) + TailwindCSS**。因為手寫 CSS 會大幅拖慢開發進度與後續維護，所以我們導入 TailwindCSS 以確保快速打造現代化的介面 (如 Glassmorphism, 響應式排版)。您是否同意此技術選型？

> [!TIP]
> **歌詞獲取機制**：由於 Spotify API 不提供直接的歌詞抓取，我們將實作一個 `lyrics-translator.js`，讓使用者點選歌曲後，透過 Gemini AI 直接根據「歌手 + 歌曲名稱」生成原文歌詞與繁體中文翻譯對照。

## Open Questions

> [!WARNING]
> 1. Dashboard 視覺風格：您希望 Dashboard 是深色模式 (Dark Mode，類似 Spotify 本身的黑綠色調) 還是其他明亮的色調？
> 2. 社群分享卡的比例：為了支援 IG Story、TikTok Reel，產生的圖片比例會設定為 9:16 (直式滿版)。這樣可以嗎？

## Proposed Changes

### Backend API & AI Services

---
#### [MODIFY] [server.js](../server.js)
- 新增 `GET /api/albums` 讀取 `data/spotify-cache.json` 並回傳依時間排序的最新專輯與歌曲清單。
- 新增 `POST /api/lyrics` 接收 `artistName` 與 `trackName`，呼叫 AI 翻譯並回傳。
- 加入 Express 靜態檔案伺服，將 `dashboard/dist` 作為前端產出目錄供瀏覽器存取。

#### [NEW] [src/lyrics-translator.js](../src/lyrics-translator.js)
- 仿照 `album-reviewer.js`，建立使用 `@google/genai` 的模組。
- 撰寫 Prompt：給定歌手與歌名，要求 AI 回傳結構化的原文與繁體中文歌詞對照。

### Frontend Dashboard (Vite + React)

---
#### [NEW] [dashboard/package.json](../dashboard/package.json)
- 獨立的 Vite + React 前端專案。
- 引入 `html2canvas` 或 `dom-to-image` 來將網頁 DOM 元素轉換成可下載的分享圖片 (Share Card)。

#### [NEW] [dashboard/src/App.jsx](../dashboard/src/App.jsx)
- 實作主要的三欄位/兩欄位版面 (側邊欄、專輯/歌曲列表、AI 歌詞與翻譯面板)。

#### [NEW] [dashboard/src/index.css](../dashboard/src/index.css)
- 導入 TailwindCSS 的基底指令。
- 使用 Tailwind 的 utility classes 來實作毛玻璃 (backdrop-filter)、動態 Hover 效果與響應式排版。

#### [NEW] [dashboard/src/components/ShareCard.jsx](../dashboard/src/components/ShareCard.jsx)
- 一個隱藏或可預覽的 9:16 (1080x1920 比例) 視覺元件。
- 內部排版包含：專輯封面、歌曲名稱、最經典的一段翻譯歌詞。
- 點擊「分享至 IG/TikTok」時，將此元件渲染成圖片提供下載。

#### [MODIFY] React Router 整合 (前端路由與狀態管理)
- **進入點**：修改 `dashboard/src/main.jsx` 使用 `BrowserRouter` 與 `Routes`/`Route` 包裹主要 App。
- **狀態管理**：重構 `dashboard/src/App.jsx` 利用 `useParams` 讀取網址的專輯 ID (`/album/:albumId`)，實現與路由同步之狀態機制；利用 `useNavigate` 做路徑切換。
- **後端 Fallback**：在 `server.js` 尾端設置 `app.get('*')` 路由以支援網頁重新整理與深層連結 (Deep Linking)。

## Verification Plan

### Manual Verification
1. 啟動 `npm run dev` 後，開啟 `http://localhost:3011` 能否看到精美的深色模式 Dashboard。
2. 畫面是否能成功載入過去抓取到的藝人專輯與歌曲。
3. 點選任一首歌曲後，AI 面板是否能出現載入動畫，並正確顯示雙語歌詞。
4. 點選「產生分享卡 (Story/Reel)」，是否能成功下載一張比例為 9:16 的精美圖片，且版面未跑版。
5. 點擊專輯時網址列是否改變為 `/album/:albumId`；直接輸入該網址或於該路徑重新整理頁面，系統應能正確解析並呈現該專輯頁面且不觸發後端 404 錯誤。
