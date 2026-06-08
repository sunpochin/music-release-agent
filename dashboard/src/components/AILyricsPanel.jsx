import React from 'react'
import { Sparkles, Download, AlertCircle } from 'lucide-react'

// AI 歌詞控制面板元件：負責歌詞抓取、加載動態、雙語歌詞渲染，以及觸發導出/分享圖卡
const AILyricsPanel = ({ 
  selectedAlbum, 
  lyricsData, 
  isLoading, 
  isExporting, 
  handleFetchLyrics, 
  exportShareCard 
}) => {
  if (!selectedAlbum) return null

  return (
    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
        <h2 className="text-xl font-bold flex items-center gap-2 text-spotify-green">
          <Sparkles size={20} /> AI 雙語歌詞翻譯與賞析
        </h2>
        
        {/* 匯出按鈕，在導出中或加載中時禁用 */}
        <button 
          onClick={exportShareCard}
          disabled={isExporting || isLoading}
          className="bg-white text-black hover:bg-spotify-green hover:scale-105 transition-all px-4 py-2 rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isExporting ? <AlertCircle size={16} className="animate-spin" /> : <Download size={16} />}
          匯出 IG/TikTok 限動卡
        </button>
      </div>

      <div className="flex-1 flex flex-col justify-center">
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
            <div className="w-10 h-10 border-4 border-spotify-green border-t-transparent rounded-full animate-spin"></div>
            <p className="animate-pulse font-medium text-center">Gemini AI 正在編寫精美的雙語歌詞與樂評...</p>
          </div>
        ) : lyricsData ? (
          <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-h3:text-spotify-green prose-h3:mt-8 prose-h3:mb-4 overflow-y-auto max-h-[400px] pr-2">
            <div dangerouslySetInnerHTML={{ __html: lyricsData.replace(/\n/g, '<br/>') }} />
          </div>
        ) : (
          <div className="py-16 flex flex-col items-center justify-center text-center space-y-6">
            <Sparkles size={48} className="text-gray-500 opacity-40 animate-pulse" />
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-gray-300">尚未產生 AI 歌詞</h3>
              <p className="text-sm text-gray-500 max-w-md">
                目前僅載入本地庫中存儲的專輯資訊。您可以隨時匯出純淨版限動卡，或者點擊下方按鈕啟動 AI 深入解析這首歌的歌詞意境。
              </p>
            </div>
            <button 
              onClick={handleFetchLyrics}
              className="bg-spotify-green text-black hover:scale-105 transition-all px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg shadow-spotify-green/20"
            >
              <Sparkles size={16} />
              尋找歌詞與 AI 翻譯
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AILyricsPanel
