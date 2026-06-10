import React from 'react'
import { Sparkles, Download, AlertCircle, Send, CheckCircle, XCircle } from 'lucide-react'

// 輔助函式：將 Markdown 語法安全且語意化地轉譯為具有 Tailwind 樣式的 HTML
// 【小朋友解釋法】：
// 想像 AI 給我們的內容是一張可能有藏有壞人（惡意腳本）的畫。
// 如果直接貼到牆上（dangerouslySetInnerHTML），壞人就會跑出來做壞事（XSS 攻擊）。
// 所以我們需要一個安檢門（escapeHtml），把 `<` 和 `>` 這些可能變成壞人的符號，
// 所以我們需要一個安檢門（escapeHtml），在最開始就將每一行文字貼上安全膠帶（轉譯），
// 後續的格式判斷都只針對已轉譯的安全內容（escapedLine），這樣壞人就絕對無法活過來作怪了！
function parseMarkdownToHtml(markdown) {
  if (!markdown) return '';
  
  const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = markdown.split('\n');
  return lines.map(line => {
    const escapedLine = escapeHtml(line.trim());
    
    // 處理副標題 H3 (例如 ### 歌曲意境與背景)
    if (escapedLine.startsWith('###')) {
      return `<h3 class="text-sm font-bold text-spotify-green mt-4 mb-2 flex items-center gap-1">${escapedLine.replace('###', '').trim()}</h3>`;
    }
    
    // 處理主標題 H2
    if (escapedLine.startsWith('##')) {
      return `<h2 class="text-base font-bold text-white mt-6 mb-3">${escapedLine.replace('##', '').trim()}</h2>`;
    }

    // 處理水平分隔線 ---
    if (escapedLine === '---') {
      return '<hr class="border-white/10 my-4" />';
    }

    // 處理無序清單 -
    if (escapedLine.startsWith('-')) {
      let content = escapedLine.substring(1).trim();
      // 處理粗體 text
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
      return `<div class="flex items-start gap-2 my-1 text-xs text-gray-300"><span class="text-spotify-green">•</span><span>${content}</span></div>`;
    }

    // 處理純粗體段落 (通常是精選歌詞或金句)
    if (escapedLine.startsWith('**') && escapedLine.endsWith('**')) {
      return `<p class="text-sm italic font-medium text-spotify-green/90 bg-spotify-green/5 border-l-2 border-spotify-green py-2 px-3 my-3 rounded-r-lg">${escapedLine.replace(/\*\*/g, '')}</p>`;
    }

    // 處理一般段落，支援內建粗體
    if (escapedLine) {
      const formatted = escapedLine.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
      return `<p class="text-xs text-gray-300 leading-relaxed my-2">${formatted}</p>`;
    }
    return escapedLine ? `${escapedLine}<br/>` : '<br/>';
  }).join('\n');
}

// AI 歌詞控制面板元件：負責歌詞抓取、單曲 AI 分析、雙頁籤切換與圖卡導出，並支援社群發文
const AILyricsPanel = ({ 
  selectedAlbum, 
  selectedTrack,
  lyricsData, 
  isLoading, 
  isExporting, 
  isPublishing,
  publishResult,
  handleFetchLyrics, 
  exportShareCard,
  analysisData,
  analysisLoading,
  handleAnalyzeTrack,
  activeTab = 'lyrics',
  setActiveTab,
  handlePublishToSocial
}) => {
  if (!selectedAlbum) return null

  return (
    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col">
      {/* 頂部標題與操作按鈕 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 border-b border-white/10 pb-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2 text-spotify-green">
            <Sparkles size={20} /> AI 歌曲智囊助手
          </h2>
          <p className="text-xs text-gray-400 mt-1 truncate max-w-xs sm:max-w-md">
            當前選中: <span className="text-white font-bold">{selectedTrack ? selectedTrack.name : selectedAlbum.name}</span>
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          {/* 匯出按鈕，在導出中或加載中時禁用 */}
          <button 
            onClick={exportShareCard}
            disabled={isExporting || isLoading || analysisLoading}
            className="bg-white text-black hover:bg-spotify-green hover:scale-105 transition-all px-4 py-2 rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isExporting ? <AlertCircle size={16} className="animate-spin" /> : <Download size={16} />}
            匯出 IG/TikTok 限動卡
          </button>

          {/* 自動發佈到社群平台（呼叫 social-post-service 微服務） */}
          <button 
            onClick={handlePublishToSocial}
            disabled={isPublishing || isLoading || analysisLoading}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-400 hover:to-purple-500 hover:scale-105 transition-all px-4 py-2 rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isPublishing ? <AlertCircle size={16} className="animate-spin" /> : <Send size={16} />}
            {isPublishing ? '發文中...' : '發佈到社群'}
          </button>
        </div>
      </div>

      {/* 發文結果通知 */}
      {publishResult && (
        <div className={`flex items-center gap-2 px-4 py-2 mb-4 rounded-lg text-xs font-medium ${
          publishResult.success 
            ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
            : 'bg-red-500/20 text-red-400 border border-red-500/30'
        }`}>
          {publishResult.success ? (
            <><CheckCircle size={14} /> 發文已排程成功！JobId: {publishResult.jobId?.slice(0, 8)}...</>
          ) : (
            <><XCircle size={14} /> 發文失敗: {publishResult.error}</>
          )}
        </div>
      )}

      {/* 雙頁籤切換 Tabs */}
      <div className="flex gap-2 mb-6 border-b border-white/5 pb-2">
        <button
          onClick={() => setActiveTab('lyrics')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'lyrics'
              ? 'bg-spotify-green/20 text-spotify-green border border-spotify-green/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🎵 AI 雙語歌詞
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            activeTab === 'analysis'
              ? 'bg-spotify-green/20 text-spotify-green border border-spotify-green/30'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          🧠 歌曲 AI 賞析
        </button>
      </div>

      {/* 內容渲染區域 */}
      <div className="flex-1 flex flex-col justify-center min-h-[300px]">
        {activeTab === 'lyrics' ? (
          // 頁籤一：AI 雙語歌詞
          isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-10 h-10 border-4 border-spotify-green border-t-transparent rounded-full animate-spin"></div>
              <p className="animate-pulse font-medium text-center text-xs">Gemini AI 正在編寫精美的雙語歌詞與翻譯...</p>
            </div>
          ) : lyricsData ? (
            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-h3:text-spotify-green prose-h3:mt-8 prose-h3:mb-4 overflow-y-auto max-h-[400px] pr-2">
              <div dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(lyricsData) }} />
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-6">
              <Sparkles size={48} className="text-gray-500 opacity-40 animate-pulse" />
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-300">尚未產生 AI 歌詞</h3>
                <p className="text-xs text-gray-500 max-w-md">
                  您可以點擊下方按鈕，請 AI 尋找這首單曲的原文歌詞，並為其翻譯成優雅的繁體中文。
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
          )
        ) : (
          // 頁籤二：歌曲 AI 賞析
          analysisLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-10 h-10 border-4 border-spotify-green border-t-transparent rounded-full animate-spin"></div>
              <p className="animate-pulse font-medium text-center text-xs">AI 樂評大腦正在深度分析編曲與音樂風格...</p>
            </div>
          ) : analysisData ? (
            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-h3:text-spotify-green prose-h3:mt-8 prose-h3:mb-4 overflow-y-auto max-h-[400px] pr-2">
              <div dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(analysisData) }} />
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-6">
              <Sparkles size={48} className="text-gray-500 opacity-40 animate-pulse" />
              <div className="space-y-2">
                <h3 className="text-lg font-bold text-gray-300">尚未進行單曲分析</h3>
                <p className="text-xs text-gray-500 max-w-md">
                  點擊下方按鈕，請資深 AI 樂評人為這首單曲起草一份精緻的音樂風格剖析與意境賞析報告。
                </p>
              </div>
              <button 
                onClick={handleAnalyzeTrack}
                className="bg-spotify-green text-black hover:scale-105 transition-all px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg shadow-spotify-green/20"
              >
                <Sparkles size={16} />
                開始歌曲 AI 賞析
              </button>
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default AILyricsPanel
