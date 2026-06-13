import React, { useState, useEffect } from 'react'
import { Sparkles, Download, AlertCircle, Send, CheckCircle, XCircle, Link2, Check, ChevronLeft, MoreHorizontal, Trash2, RefreshCw } from 'lucide-react'
// 安全的輕量 Markdown 轉譯器：抽成純模組（dashboard/src/utils/markdown.js），
// 由根目錄 tests/markdown-renderer.test.js 做 XSS 防護與格式轉譯的確定性單元測試。
import { parseMarkdownToHtml } from '../utils/markdown.js'
import WaveformVisualizer from './WaveformVisualizer'
import LyricsSourceBadge from './LyricsSourceBadge'

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
  lyricsSource,
  rawLoading,
  shouldAnimateLyrics = true,
  isTranslated,
  isTranslating,
  isExporting,
  isPublishing,
  publishResult,
  handleFetchLyrics,
  handleTranslate,
  handleRedownloadRaw,
  handleClearCache,
  exportShareCard,
  handlePublishToSocial,
  onBackToAlbum // 手機版「返回專輯資訊」的回調
}) => {
  const [menuOpen, setMenuOpen] = useState(false)

  // 點選外部區域自動關閉懸浮選單
  useEffect(() => {
    if (!menuOpen) return
    const handleOutsideClick = () => setMenuOpen(false)
    window.addEventListener('click', handleOutsideClick)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [menuOpen])

  if (!selectedAlbum) return null

  // 渲染智慧多態控制按鈕 (Jony Ive 風格)
  const renderMorphingButton = () => {
    if (rawLoading) {
      return (
        <button
          disabled
          className="bg-white/5 border border-white/10 text-gray-400 px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 cursor-not-allowed opacity-60"
        >
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
          ⏳ 讀取原文中...
        </button>
      )
    }

    if (isTranslating) {
      return (
        <button
          disabled
          className="bg-white/5 border border-white/10 text-spotify-green px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 cursor-not-allowed animate-pulse"
        >
          <Sparkles size={12} className="animate-spin text-spotify-green" />
          🧠 AI 正在對照翻譯...
        </button>
      )
    }

    if (isTranslated) {
      return (
        <button
          onClick={() => handleTranslate(true)}
          className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white hover:scale-105 active:scale-95 transition-all px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg"
        >
          <Sparkles size={12} className="text-spotify-green" />
          🔄 重新翻譯
        </button>
      )
    }

    // 預設為：原文已載入，可開始翻譯
    return (
      <button
        onClick={handleTranslate}
        className="bg-gradient-to-r from-spotify-green/10 to-spotify-green/20 hover:from-spotify-green/20 hover:to-spotify-green/30 border border-spotify-green/30 hover:border-spotify-green/50 text-spotify-green hover:scale-105 active:scale-95 transition-all px-4 py-2 rounded-full font-bold text-xs flex items-center gap-2 shadow-lg shadow-spotify-green/5"
      >
        <Sparkles size={12} className="animate-pulse" />
        🎵 AI 雙語對照翻譯
      </button>
    )
  }

  return (
    <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col gap-6">

      {/* ── 隨選翻譯按鈕 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">


        {/* 智慧多態按鈕與進階下拉選單 */}
        <div className="flex items-center gap-2 relative">
          {renderMorphingButton()}

          {/* 更多選項極簡按鈕 */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            aria-label="更多歌詞選項"
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-gray-400 hover:text-white rounded-full transition-all active:scale-95 flex items-center justify-center"
          >
            <MoreHorizontal size={14} />
          </button>

          {/* 毛玻璃浮動選單 */}
          {menuOpen && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleRedownloadRaw();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-2 font-medium"
              >
                <RefreshCw size={12} />
                重新下載原文
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  handleClearCache();
                }}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all flex items-center gap-2 font-medium"
              >
                <Trash2 size={12} />
                清除本地快取
              </button>
            </div>
          )}
        </div>

        {selectedTrack && (
          <div className="hidden" title={`${selectedTrack.name} 的專屬音波`}>
            <WaveformVisualizer seed={selectedTrack.id} />
          </div>
        )}
      </div>

      {/* ── 主內容渲染區域（直接顯示歌詞） ── */}
      <div className="flex-1 flex flex-col min-h-[300px]">
        {rawLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
            <div className="w-10 h-10 border-4 border-spotify-green border-t-transparent rounded-full animate-spin"></div>
            <p className="animate-pulse font-medium text-center text-xs">正在從網路資料庫尋獲並載入原文歌詞...</p>
          </div>
        ) : lyricsData ? (
          <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-h3:text-spotify-green prose-h3:mt-8 prose-h3:mb-4 overflow-y-auto max-h-[500px] pr-2">
            {/* 歌詞來源徽章：誠實標示可信度（真實來源 / 實驗性 / AI 記憶模式可能不準確） */}
            <div className="not-prose mb-3">
              <LyricsSourceBadge source={lyricsSource} />
            </div>
            {/* ai-stagger 進場動畫只在首次顯示某首歌歌詞時掛上；之後若父層 remount 則不帶動畫，避免重播閃爍（見 useTrackAi 的 shouldAnimateLyrics） */}
            <div className={shouldAnimateLyrics ? 'ai-stagger' : ''} dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(lyricsData) }} />
            {isTranslating && (
              <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md animate-pulse flex items-center gap-3">
                <Sparkles size={16} className="text-spotify-green animate-spin" />
                <span className="text-xs text-spotify-green font-bold">AI 正在翻譯中，請稍候...</span>
              </div>
            )}
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
              <><CheckCircle size={14} /> 發文已排程成功！JobId: {publishResult.jobId}</>
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
            disabled={isExporting || rawLoading}
            className="bg-white text-black hover:bg-spotify-green hover:scale-105 transition-all px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg w-full sm:w-auto"
          >
            {isExporting ? <AlertCircle size={16} className="animate-spin" /> : <Download size={16} />}
            匯出 IG 限動卡
          </button>

          <button
            onClick={handlePublishToSocial}
            disabled={isPublishing || rawLoading}
            className="bg-gradient-to-r from-blue-500 to-purple-600 text-white hover:from-blue-400 hover:to-purple-500 hover:scale-105 transition-all px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg w-full sm:w-auto"
          >
            {isPublishing ? <AlertCircle size={16} className="animate-spin" /> : <Send size={16} />}
            {isPublishing ? '發文中...' : '發佈到社群'}
          </button>
        </div>

        {/* 「返回專輯資訊」按鈕（手機桌機皆顯示，讓使用者從歌曲頁回到 AlbumPanel） */}
        {onBackToAlbum && (
          <button
            onClick={onBackToAlbum}
            className="flex items-center justify-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-medium py-2 rounded-xl hover:bg-white/5 mt-1"
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
