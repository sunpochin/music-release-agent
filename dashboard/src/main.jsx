import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import LyricsPage from './components/LyricsPage.jsx'

// 檔案用途：前端路由入口；所在層：dashboard/src；主要關聯：App.jsx、LyricsPage.jsx。
// 翻譯頁不掛在 App 底下，避免查歌時也載入專輯清單與 Spotify 播放器。
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/lyrics" element={<LyricsPage />} />
        <Route path="/" element={<App />} />
        <Route path="/album/:albumId" element={<App />} />
        {/* 新增獨立單曲頁面路由，保留專輯上下文 */}
        <Route path="/album/:albumId/song/:trackId" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
