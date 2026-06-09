import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// 用 BrowserRouter 與 Routes 包裹 App 元件以啟用 React Router 路由參數匹配
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/album/:albumId" element={<App />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
