import React, { useState, useEffect } from 'react'
import { Sparkles, Download, AlertCircle, Send, CheckCircle, XCircle, Link2, Check, ChevronLeft } from 'lucide-react'
// 安全的輕量 Markdown 轉譯器：抽成純模組（dashboard/src/utils/markdown.js），
// 由根目錄 tests/markdown-renderer.test.js 做 XSS 防護與格式轉譯的確定性單元測試。
import { parseMarkdownToHtml } from '../utils/markdown.js'
import WaveformVisualizer from './WaveformVisualizer'

// 複製目前頁面連結的小按鈕（桌面端分享體驗；行動端已有原生分享）
const CopyLinkButton = () => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      // 剪貼簿 API 不可用（非 HTTPS 等）→ 退回選取提示
      window.prompt('複製這個連結分享給朋友：', window.location.href)
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="複製歌曲頁連結"
      className="bg-white/10 hover:bg-white/20 transition-all text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto"
    >
      {copied ? <Check size={16} className="text-spotify-green" /> : <Link2 size={16} />}
      {copied ? '已複製！' : '複製連結'}
    </button>
  )
}

/**
 * 🎤 SongPanel — 單曲歌詞與 AI 工具面板
 *
 * 【小朋友解釋法】：
 * 改版設計哲學：使用者點進一首歌，最核心的需求是「立刻看到歌詞、對著唱」。
 * 所以我們把歌詞推到最頂端，把工具按鈕（複製、匯出、發佈）沉到歌詞下面。
 * 手機上額外顯示「返回專輯」讓使用者不迷路，桌機靠 Header 的返回鍵。
 */
const SongPanel = ({
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
  handlePublishToSocial,
  onBackToAlbum // 手機版「返回專輯資訊」的回調
}) => {
  if (!selectedAlbum) return null

  return (
    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col gap-6">

      {/* ── 歌曲標題與音波視覺化 ── */}
      <div>
        <h2 className="text-xl font-bold text-white leading-tight">
          {selectedTrack?.name || selectedAlbum.name}
        </h2>
        <p className="text-sm text-gray-400 mt-0.5">{selectedAlbum.artistName}</p>

        {selectedTrack && (
          <div className="mt-4" title={`${selectedTrack.name} 的專屬音波`}>
            <WaveformVisualizer seed={selectedTrack.id} />
          </div>
        )}
      </div>

      {/* ── 雙頁籤切換 ── */}
      <div className="flex gap-2 border-b border-white/5 pb-3">
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

      {/* ── 主內容渲染區域（歌詞最優先） ── */}
      <div className="flex-1 flex flex-col min-h-[300px]">
        {activeTab === 'lyrics' ? (
          // 頁籤一：AI 雙語歌詞
          isLoading ? (
            <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
              <div className="w-10 h-10 border-4 border-spotify-green border-t-transparent rounded-full animate-spin"></div>
              <p className="animate-pulse font-medium text-center text-xs">AI 正在取得歌詞與雙語翻譯...</p>
            </div>
          ) : lyricsData ? (
            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-h3:text-spotify-green prose-h3:mt-8 prose-h3:mb-4 overflow-y-auto max-h-[500px] pr-2">
              <div className="ai-stagger" dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(lyricsData) }} />
            </div>
          ) : (
            // 歌詞載入完成前的短暫過場
            <div className="py-16 flex flex-col items-center justify-center text-center space-y-4">
              <Sparkles size={32} className="text-spotify-green/40 animate-pulse" />
              <p className="text-xs text-gray-500">正在準備 AI 雙語歌詞…</p>
              <button
                onClick={handleFetchLyrics}
                className="text-xs text-gray-400 hover:text-spotify-green transition-colors underline underline-offset-4"
              >
                沒有自動載入？點此重新載入
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
            <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-h3:text-spotify-green prose-h3:mt-8 prose-h3:mb-4 overflow-y-auto max-h-[500px] pr-2">
              <div className="ai-stagger" dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(analysisData) }} />
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

      {/* ── 分隔線：歌詞 / 工具區 ── */}
      <div className="border-t border-white/10 pt-5 flex flex-col gap-4">
        {/* 工具標題列 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={12} className="text-spotify-green" /> AI 歌曲智囊助手
            </p>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
              當前選中：<span className="text-white font-semibold">{selectedTrack ? selectedTrack.name : selectedAlbum.name}</span>
            </p>
          </div>
        </div>

        {/* 發文結果通知 */}
        {publishResult && (
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium ${
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

        {/* 操作按鈕群組（垂直堆疊讓手機也寬敞） */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <CopyLinkButton />

          <button
            onClick={exportShareCard}
            disabled={isExporting || isLoading || analysisLoading}
            className="bg-white text-black hover:bg-spotify-green hover:scale-105 transition-all px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg w-full sm:w-auto"
          >
            {isExporting ? <AlertCircle size={16} className="animate-spin" /> : <Download size={16} />}
            匯出 IG/TikTok 限動卡
          </button>

          <button
            onClick={handlePublishToSocial}
            disabled={isPublishing || isLoading || analysisLoading}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-400 hover:to-purple-500 hover:scale-105 transition-all px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg w-full sm:w-auto"
          >
            {isPublishing ? <AlertCircle size={16} className="animate-spin" /> : <Send size={16} />}
            {isPublishing ? '發文中...' : '發佈到社群'}
          </button>
        </div>

        {/* 手機版「返回專輯資訊」按鈕（桌機隱藏，桌機靠 HeaderBanner） */}
        {onBackToAlbum && (
          <button
            onClick={onBackToAlbum}
            className="lg:hidden mt-1 flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium py-2 rounded-xl hover:bg-white/5"
          >
            <ChevronLeft size={16} />
            返回專輯資訊
          </button>
        )}
      </div>
    </div>
  )
}

export default SongPanel
