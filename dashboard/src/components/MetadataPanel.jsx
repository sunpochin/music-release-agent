import React from 'react'
import { Info, Calendar, Layers, ExternalLink } from 'lucide-react'

// 本地資料面板元件：展示專輯發行屬性、AI 介紹，並內嵌系統診斷小工具與 Spotify 外部播放連結
const MetadataPanel = ({ selectedAlbum, albumReview, shareFile }) => {
  if (!selectedAlbum) return null

  return (
    <div className="w-full lg:w-1/3 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2 text-spotify-green mb-6 border-b border-white/10 pb-4">
          <Info size={20} /> 本地資料庫簡介
        </h2>
        
        <div className="space-y-4 text-sm text-gray-300">
          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
            <Calendar size={18} className="text-spotify-green" />
            <div>
              <p className="text-xs text-gray-400">發行日期</p>
              <p className="font-semibold">{selectedAlbum.release_date}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
            <Layers size={18} className="text-spotify-green" />
            <div>
              <p className="text-xs text-gray-400">曲目總數</p>
              <p className="font-semibold">{selectedAlbum.total_tracks} 首歌曲</p>
            </div>
          </div>

          <div className="bg-white/5 p-4 rounded-xl space-y-2">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">作品介紹</p>
            <p className="leading-relaxed text-gray-200">
              {/* 若有從本地 AI 樂評載入介紹，則優先顯示，否則回退至預設元數據描述 */}
              {albumReview?.introduction ? (
                albumReview.introduction
              ) : (
                <>
                  此發行作品由藝人 <strong className="text-spotify-green">{selectedAlbum.artistName || '未知藝人'}</strong> 創作，類型為 <strong className="text-white">{selectedAlbum.type === 'album' ? '專輯 (Album)' : '單曲 (Single)'}</strong>，共收錄 {selectedAlbum.total_tracks} 首曲目。這張作品於 {selectedAlbum.release_date} 正式發行，已成功自 Spotify 同步至我們的本地快取資料庫。
                </>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 pt-4 border-t border-white/10 space-y-4">
        {/* 偵錯小工具，方便實機測試排查 */}
        <div className="bg-white/5 p-3 rounded-xl text-[11px] text-gray-400 font-mono space-y-1">
          <p className="text-spotify-green font-bold text-[10px] uppercase tracking-wider mb-1">系統偵錯資訊</p>
          <p>HTTPS 安全連線: {window.location.protocol === 'https:' ? '🟢 是' : '🔴 否 (不支援原生分享)'}</p>
          <p>原生分享 API: {navigator.share ? '🟢 支援' : '🔴 否'}</p>
          <p>原生檔案分享: {navigator.canShare && navigator.canShare({ files: [new File([], 'test.png', { type: 'image/png' })] }) ? '🟢 支援' : '🔴 否'}</p>
          <p>分享圖卡狀態: {shareFile ? '🟢 已就緒' : '⏳ 生成中/失敗'}</p>
        </div>

        <a 
          href={selectedAlbum.url} 
          target="_blank" 
          rel="noopener noreferrer"
          className="w-full bg-white/10 hover:bg-white/20 transition-all text-white px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md"
        >
          <ExternalLink size={16} />
          在 Spotify 上聆聽
        </a>
      </div>
    </div>
  )
}

export default MetadataPanel
