import React from 'react'
import { Sparkles, Download, AlertCircle } from 'lucide-react'

// 輔助函式：將 Markdown 語法安全且語意化地轉譯為具有 Tailwind 樣式的 HTML
function parseMarkdownToHtml(markdown) {
  if (!markdown) return '';
  
  // 轉譯特殊字元，確保防範 XSS 安全漏洞
  const escapeHtml = (text) => text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const lines = markdown.split('\n');
  let inList = false;
  const resultLines = [];

  for (let line of lines) {
    const trimmed = line.trim();
    
    // 檢查無序列表項目 - 
    if (trimmed.startsWith('- ')) {
      const content = escapeHtml(trimmed.slice(2));
      const formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>');
      
      // 若尚未進入列表狀態，補上 ul 容器
      if (!inList) {
        resultLines.push('<ul class="my-3">');
        inList = true;
      }
      resultLines.push(`<li class="ml-4 list-disc my-1">${formattedContent}</li>`);
    } else {
      // 離開列表狀態時，關閉 ul 容器
      if (inList) {
        resultLines.push('</ul>');
        inList = false;
      }
      
      let processed = escapeHtml(line);
      // 解析各級標題
      if (processed.startsWith('### ')) {
        processed = `<h3 class="text-spotify-green font-bold text-lg mt-6 mb-3">${processed.slice(4)}</h3>`;
      } else if (processed.startsWith('## ')) {
        processed = `<h2 class="text-spotify-green font-bold text-xl mt-8 mb-4">${processed.slice(3)}</h2>`;
      } else if (processed.startsWith('# ')) {
        processed = `<h1 class="text-white font-black text-2xl mt-8 mb-4">${processed.slice(2)}</h1>`;
      } else {
        // 解析行內樣式：粗體與斜體
        processed = processed
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/\*(.*?)\*/g, '<em>$1</em>');
      }
      
      resultLines.push(processed);
    }
  }

  // 確保未關閉的列表在結尾時關閉
  if (inList) {
    resultLines.push('</ul>');
  }

  // 合併行，只有非 HTML 結構標籤的行才補上換行符 <br/>，防範無效的結構嵌套
  return resultLines.map((line) => {
    const isTag = line.startsWith('<h') || line.startsWith('<u') || line.startsWith('<l') || line.startsWith('</');
    if (isTag) {
      return line;
    }
    return line ? `${line}<br/>` : '<br/>';
  }).join('\n');
}

// AI 歌詞控制面板元件：負責歌詞抓取、單曲 AI 分析、雙頁籤切換與圖卡導出
const AILyricsPanel = ({ 
  selectedAlbum, 
  selectedTrack,
  lyricsData, 
  isLoading, 
  isExporting, 
  handleFetchLyrics, 
  exportShareCard,
  analysisData,
  analysisLoading,
  handleAnalyzeTrack,
  activeTab = 'lyrics',
  setActiveTab
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
        
        {/* 匯出按鈕，在導出中或加載中時禁用 */}
        <button 
          onClick={exportShareCard}
          disabled={isExporting || isLoading || analysisLoading}
          className="bg-white text-black hover:bg-spotify-green hover:scale-105 transition-all px-4 py-2 rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          {isExporting ? <AlertCircle size={16} className="animate-spin" /> : <Download size={16} />}
          匯出 IG/TikTok 限動卡
        </button>
      </div>

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
              <p className="animate-pulse font-medium text-center">Gemini AI 正在編寫精美的雙語歌詞與翻譯...</p>
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
                <p className="text-sm text-gray-500 max-w-md">
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
              <p className="animate-pulse font-medium text-center">AI 樂評大腦正在深度分析編曲與音樂風格...</p>
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
                <p className="text-sm text-gray-500 max-w-md">
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
