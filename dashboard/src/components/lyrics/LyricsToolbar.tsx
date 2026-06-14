import React, { useState, useEffect } from 'react'
import { Sparkles, MoreHorizontal, RefreshCw, Trash2 } from 'lucide-react'

interface LyricsToolbarProps {
  rawLoading: boolean
  isTranslating: boolean
  isTranslated: boolean
  handleTranslate: (forceRefresh?: boolean) => void
  handleRedownloadRaw: () => void
  handleClearCache: () => void
}

const LyricsToolbar: React.FC<LyricsToolbarProps> = ({
  rawLoading,
  isTranslating,
  isTranslated,
  handleTranslate,
  handleRedownloadRaw,
  handleClearCache
}) => {
  const [menuOpen, setMenuOpen] = useState(false)

  // 點選外部區域自動關閉懸浮選單
  useEffect(() => {
    if (!menuOpen) return
    const handleOutsideClick = () => setMenuOpen(false)
    // slight delay to avoid closing immediately on the same click
    setTimeout(() => {
      window.addEventListener('click', handleOutsideClick)
    }, 0)
    return () => window.removeEventListener('click', handleOutsideClick)
  }, [menuOpen])

  // 渲染智慧多態控制按鈕 (Jony Ive 風格)
  const renderMorphingButton = () => {
    if (rawLoading) {
      return (
        <button
          disabled
          className="bg-white/5 border border-white/10 text-gray-400 px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 cursor-not-allowed opacity-60"
        >
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping" />
          讀取原文中...
        </button>
      )
    }

    if (isTranslating) {
      return (
        <button
          disabled
          className="bg-white/5 border border-white/10 text-spotify-green px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 cursor-not-allowed animate-pulse"
        >
          <Sparkles size={12} className="animate-spin text-spotify-green" />
          對照翻譯中...
        </button>
      )
    }

    if (isTranslated) {
      return (
        <button
          onClick={() => handleTranslate(true)}
          className="bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white hover:scale-105 active:scale-95 transition-all px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1.5 shadow-lg"
        >
          <Sparkles size={12} className="text-spotify-green" />
          重新翻譯
        </button>
      )
    }

    // 預設為：原文已載入，可開始翻譯
    return (
      <button
        onClick={() => handleTranslate()}
        className="bg-white/10 backdrop-blur-2xl border border-white/10 hover:border-white/30 hover:bg-white/20 text-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 px-4 py-2 rounded-full font-medium text-xs flex items-center gap-1.5 shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]"
      >
        <Sparkles size={12} className="animate-pulse text-white/80" />
        <span className="tracking-widest">產生雙語翻譯</span>
      </button>
    )
  }

  return (
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
  )
}

export default LyricsToolbar
