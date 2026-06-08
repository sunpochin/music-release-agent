# Music Release Agent Dashboard Tasks

- `[x]` 1. 初始化環境與工具
  - `[x]` 建立 Vite + React 前端專案 (`dashboard`)
  - `[x]` 建立 `task.md` 追蹤進度
- `[x]` 2. 後端 API 與 AI 服務擴充
  - `[x]` 實作 `src/lyrics-translator.js` (Gemini 歌詞翻譯)
  - `[x]` 更新 `server.js` 新增 `/api/albums` 與 `/api/lyrics` endpoints
  - `[x]` 配置 Express 靜態路由服務 React Build 檔案
- `[x]` 3. 前端架構與樣式 (Tailwind CSS)
  - `[x]` 配置 Tailwind CSS (Glassmorphism, 深色模式, 現代化排版)
  - `[x]` 實作基礎 Layout (側邊欄與主要內容區塊)
- `[x]` 4. 核心功能實作
  - `[x]` 串接 `/api/albums` 並實作專輯/歌曲列表
  - `[x]` 串接 `/api/lyrics` 並實作 AI 歌詞與翻譯面板
- `[x]` 5. 社群分享功能
  - `[x]` 實作 `ShareCard.jsx` 隱藏/預覽元件 (9:16 比例)
  - `[x]` 整合 `html2canvas` 下載圖片功能
- `[x]` 6. 整合測試與驗證
  - `[x]` 執行完整流程測試 (讀取、翻譯、截圖)
  - `[x]` 撰寫 `walkthrough.md` 總結成果

- `[ ]` 7. 優化與升級功能
  - `[ ]` 實作 Web Share API 整合 (行動端喚起原生分享選單，直發 Instagram/TikTok)
  - `[ ]` 優化前後端連接埠職責分離（開發環境改為純 API 模式）
