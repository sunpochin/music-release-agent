import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Sparkles, Download, AlertCircle, Link2, Check, ChevronLeft, MoreHorizontal, Trash2, RefreshCw, Upload } from 'lucide-react'
import html2canvas from 'html2canvas'
import ShareCard from './ShareCard'
// 安全的輕量 Markdown 轉譯器：抽成純模組（dashboard/src/utils/markdown.js），
// 由根目錄 tests/markdown-renderer.test.js 做 XSS 防護與格式轉譯的確定性單元測試。
import { parseMarkdownToHtml } from '../utils/markdown.js'
import { createTranslationMap, getTranslation } from '../utils/translationMatcher'

import LyricsSourceBadge from './LyricsSourceBadge'
import AddToPlaylistButton from './AddToPlaylistButton'

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
  lrcData,
  playerControls,
  lyricsSource,
  rawLoading,
  shouldAnimateLyrics = true,
  isTranslated,
  isTranslating,
  albumReview,
  handleFetchLyrics,
  handleTranslate,
  handleRedownloadRaw,
  handleClearCache,
  onBackToAlbum // 手機版「返回專輯資訊」的回調
}: any) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const lyricsContainerRef = useRef<HTMLDivElement>(null)

  // 1. 社群分享與發佈之本機狀態 (SOLID: 狀態局部化)
  const [isExporting, setIsExporting] = useState(false)
  
  const shareCardRef = useRef(null)
  const shareFileRef = useRef(null)

  // 切換歌曲時重設狀態（原本發佈狀態也在此重設）
  useEffect(() => {
  }, [selectedTrack])

  // 背景非同步預產生分享圖檔，提升 Web Share API 響應速度
  const generateShareFile = useCallback(async () => {
    if (!shareCardRef.current || !selectedAlbum) return
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        backgroundColor: '#121212',
        useCORS: true
      })
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Canvas to Blob conversion failed')
      const file = new File([blob], `share-${selectedTrack ? selectedTrack.name : selectedAlbum.name}.png`, { type: 'image/png' })
      shareFileRef.current = file
    } catch (err) {
      console.error("Failed to pre-generate share file", err)
    }
  }, [selectedAlbum, selectedTrack])

  // 歌詞、樂評就緒時，背景預產生分享卡片
  useEffect(() => {
    if (selectedAlbum) {
      shareFileRef.current = null
      const timer = setTimeout(() => {
        generateShareFile()
      }, 600)
      return () => clearTimeout(timer)
    } else {
      shareFileRef.current = null
    }
  }, [selectedAlbum, selectedTrack, lyricsData, albumReview, generateShareFile])

  // 匯出 IG 限動卡邏輯
  const exportShareCard = async () => {
    if (!selectedAlbum) return

    const spotifyLink = selectedTrack?.url || `https://open.spotify.com/album/${selectedAlbum.id}`
    const shareText = `🎵 ${selectedTrack ? selectedTrack.name : selectedAlbum.name} - ${selectedAlbum.artistName || '未知藝人'}
${spotifyLink}

${lyricsData ? lyricsData.replace(/[#*_\-`]/g, '').trim() : (albumReview?.summary || '')}`

    // --- 完全同步的剪貼簿複製 (繞過 iOS 嚴格的非同步安全限制) ---
    const textArea = document.createElement("textarea")
    textArea.value = shareText
    textArea.style.position = "fixed"
    textArea.style.left = "-9999px"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      // 提示使用者已成功複製，可以直接貼到 IG Reels
      setTimeout(() => alert("✅ 包含 Spotify 歌曲連結與翻譯歌詞的文案已為您複製到剪貼簿！\n\n您可以直接貼上到 Instagram Reels！"), 100);
    } catch (e) {
      console.warn("execCommand copy failed", e)
    }
    document.body.removeChild(textArea)

    // --- 自動背景發布到 Threads (僅發送單一發行連結以防字數超限) ---
    // 放入 setTimeout 延遲執行，避免阻礙瀏覽器對 Web Share API (navigator.share) 的點擊觸發判定
    setTimeout(() => {
      const releaseUrl = selectedTrack
        ? `https://release.sunpochin.xyz/album/${selectedAlbum.id}/song/${selectedTrack.id}`
        : `https://release.sunpochin.xyz/album/${selectedAlbum.id}`

      fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption: releaseUrl,
          platforms: ['threads'],
          imageBase64: null // 不包含圖片以節省字數與流量，僅分享純連結
        })
      }).catch(err => {
        console.error("Auto publish to Threads failed", err)
      })
    }, 1000)

    // --- 以下為圖卡匯出邏輯 ---
    if (shareFileRef.current) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [shareFileRef.current] })) {
          await navigator.share({
            files: [shareFileRef.current],
            title: `分享《${selectedAlbum.name}》`,
            text: shareText
          })
          return
        }
      } catch (err) {
        if (err.name === 'AbortError') return
        console.error("Native share failed, falling back to download", err)
      }
    }

    setIsExporting(true)
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        backgroundColor: '#121212',
        useCORS: true
      })
      const image = canvas.toDataURL("image/png")
      const link = document.createElement('a')
      link.href = image
      link.download = `share-${selectedAlbum.name || 'card'}.png`
      link.click()
    } catch (err) {
      console.error("Export failed", err)
      alert("匯出失敗，請稍後再試。")
    } finally {
      setIsExporting(false)
    }
  }


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
        className="bg-white/10 backdrop-blur-2xl border border-white/10 hover:border-white/30 hover:bg-white/20 text-white hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 px-6 py-3 rounded-full font-medium text-sm flex items-center gap-3 shadow-[0_0_40px_rgba(255,255,255,0.1)] hover:shadow-[0_0_60px_rgba(255,255,255,0.2)]"
      >
        <Sparkles size={14} className="animate-pulse text-white/80" />
        <span className="tracking-widest">產生 AI 雙語翻譯</span>
      </button>
    )
  }

  return (
    <div className="flex-1 bg-black/20 backdrop-blur-[60px] border border-white/5 rounded-[32px] p-8 shadow-2xl shadow-black/50 flex flex-col gap-6">

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


      </div>

      {/* ── 主內容渲染區域（直接顯示歌詞） ── */}
      <div className="flex-1 flex flex-col min-h-[300px]">
        {rawLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-white/50 space-y-6">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
            <p className="animate-pulse font-light tracking-widest text-center text-sm">聆聽中...</p>
          </div>
        ) : lyricsData || lrcData ? (
          <div 
            ref={lyricsContainerRef}
            className="prose prose-invert max-w-none prose-lg prose-p:leading-loose tracking-wide prose-h3:text-white/80 prose-h3:mt-8 prose-h3:mb-4 overflow-y-auto max-h-[500px] pr-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20 relative"
          >
            {/* 歌詞來源徽章：誠實標示可信度（真實來源 / 實驗性 / AI 記憶模式可能不準確） */}
            <div className="not-prose mb-3 sticky top-0 bg-black/20 backdrop-blur-md z-10 p-2 rounded-lg">
              <LyricsSourceBadge source={lrcData ? 'LRCLIB (動態同步)' : lyricsSource} />
            </div>
            
            {/* 動態 KTV 歌詞模式 */}
            {lrcData ? (
              <div className="flex flex-col gap-6 py-32 transition-all duration-500">
                {(() => {
                  const translationMap = createTranslationMap(lyricsData);
                  return lrcData.map((line: any, idx: number) => {
                    const isCurrent = playerControls?.position >= line.timeMs && 
                      (idx === lrcData.length - 1 || playerControls?.position < lrcData[idx + 1].timeMs);
                    
                    // 自動置中滾動
                    if (isCurrent && lyricsContainerRef.current) {
                      const el = document.getElementById(`lrc-line-${idx}`);
                      if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }
                    }
                    
                    // 嘗試在 lyricsData 翻譯結果中尋找對應的翻譯
                    const translatedText = getTranslation(line.text, translationMap);

                  return (
                    <div 
                      key={idx} 
                      id={`lrc-line-${idx}`}
                      onClick={() => {
                        if (playerControls?.seek) playerControls.seek(line.timeMs);
                      }}
                      className={`cursor-pointer transition-all duration-500 flex flex-col items-center justify-center text-center ${isCurrent ? 'scale-105' : 'blur-[0.5px] hover:blur-none'}`}
                    >
                      <p className={`m-0 ${isCurrent ? 'text-white text-2xl font-bold shadow-white drop-shadow-lg' : 'text-white/30 hover:text-white/60'}`}>
                        {line.text || '...'}
                      </p>
                      {translatedText && (
                        <p className={`m-0 mt-1 ${isCurrent ? 'text-spotify-green text-lg font-medium' : 'text-spotify-green/30 hover:text-spotify-green/60'}`}>
                          {translatedText}
                        </p>
                      )}
                    </div>
                  );
                  });
                })()}
              </div>
            ) : (
              /* 純文字/Markdown 降級模式 */
              <div className={shouldAnimateLyrics ? 'ai-stagger' : ''} dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(lyricsData) }} />
            )}

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




        {/* 操作按鈕群組（垂直堆疊讓手機也寬敞） */}
        <div className="flex flex-col sm:flex-row flex-wrap gap-2">
          <CopyLinkButton />

          <button
            onClick={exportShareCard}
            disabled={isExporting || rawLoading}
            className="bg-white text-black hover:bg-spotify-green hover:scale-105 transition-all px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg w-full sm:w-auto"
          >
            {isExporting ? <AlertCircle size={16} className="animate-spin" /> : <Upload size={16} />}
            匯出 IG 限動卡
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

      {/* 隱藏的 offscreen ShareCard 用於渲染導出圖片 */}
      <div className="fixed -left-[9999px] -top-[9999px]">
         <ShareCard 
            ref={shareCardRef} 
            album={selectedAlbum} 
            track={selectedTrack}
            artistName={selectedAlbum?.artistName || 'Featured Artist'} 
            lyrics={lyricsData} 
            introduction={albumReview?.introduction}
         />
      </div>
    </div>
  )
}

export default SongPanel
