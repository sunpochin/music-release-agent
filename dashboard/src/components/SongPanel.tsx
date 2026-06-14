import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Sparkles, AlertCircle, ChevronLeft, Upload } from 'lucide-react'
import html2canvas from 'html2canvas'
import ShareCard from './ShareCard'

import LyricsSourceBadge from './LyricsSourceBadge'
import AddToPlaylistButton from './AddToPlaylistButton'

// Extracted Sub-Components
import CopyLinkButton from './lyrics/CopyLinkButton'
import UnifiedLyricsView from './lyrics/UnifiedLyricsView'
import LyricsToolbar from './lyrics/LyricsToolbar'

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
  onBackToAlbum
}: any) => {
  const lyricsContainerRef = useRef<HTMLDivElement>(null)

  // 社群分享與發佈之本機狀態
  const [isExporting, setIsExporting] = useState(false)
  const shareCardRef = useRef(null)
  const shareFileRef = useRef(null)

  // 背景非同步預產生分享圖檔
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
      const file = new File([blob as any], `share-${selectedTrack ? selectedTrack.name : selectedAlbum.name}.png`, { type: 'image/png' })
      shareFileRef.current = file as any
    } catch (err) {
      console.error("Failed to pre-generate share file", err)
    }
  }, [selectedAlbum, selectedTrack])

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
    setIsExporting(true)
    const spotifyLink = selectedTrack?.url || `https://open.spotify.com/album/${selectedAlbum.id}`
    const shareText = `🎵 ${selectedTrack ? selectedTrack.name : selectedAlbum.name} - ${selectedAlbum.artistName || '未知藝人'}\n${spotifyLink}\n\n${lyricsData ? lyricsData.replace(/[#*_\-`]/g, '').trim() : (albumReview?.summary || '')}`

    const textArea = document.createElement("textarea")
    textArea.value = shareText
    textArea.style.position = "fixed"
    textArea.style.left = "-9999px"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      setTimeout(() => alert("✅ 包含 Spotify 歌曲連結與翻譯歌詞的文案已為您複製到剪貼簿！\n\n您可以直接貼上到 Instagram Reels！"), 100);
    } catch (e) {
      console.warn("execCommand copy failed", e)
    }
    document.body.removeChild(textArea)
    setIsExporting(false)
  }

  if (!selectedAlbum) return null

  return (
    <div className="flex-1 min-h-0 bg-black/20 backdrop-blur-[60px] border border-white/5 rounded-[32px] p-4 lg:p-6 shadow-2xl shadow-black/50 flex flex-col gap-3">

      {/* ── 隨選翻譯按鈕與 IG 限動卡 ── */}
      <div className="flex flex-row items-center justify-end gap-2 shrink-0">
        {lyricsData && (
          <button
            onClick={exportShareCard}
            disabled={isExporting || rawLoading}
            className="bg-white text-black hover:bg-spotify-green hover:scale-105 transition-all px-3 py-1.5 rounded-full font-bold text-xs flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
            title="匯出 IG 限動卡"
          >
            {isExporting ? <AlertCircle size={14} className="animate-spin" /> : <Upload size={14} />}
            <span className="hidden sm:inline">IG 限動卡</span>
            <span className="sm:hidden">IG</span>
          </button>
        )}
        <LyricsToolbar 
          rawLoading={rawLoading}
          isTranslating={isTranslating}
          isTranslated={isTranslated}
          handleTranslate={handleTranslate}
          handleRedownloadRaw={handleRedownloadRaw}
          handleClearCache={handleClearCache}
        />
      </div>

      {/* ── 主內容渲染區域（直接顯示歌詞） ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {rawLoading ? (
          <div className="py-24 flex flex-col items-center justify-center text-white/50 space-y-6">
            <div className="w-8 h-8 border-2 border-white/20 border-t-white/80 rounded-full animate-spin"></div>
            <p className="animate-pulse font-light tracking-widest text-center text-sm">讀取中...</p>
          </div>
        ) : lyricsData || lrcData ? (
          <div 
            ref={lyricsContainerRef}
            className="prose prose-invert max-w-none prose-lg prose-p:leading-loose tracking-wide prose-h3:text-white/80 prose-h3:mt-8 prose-h3:mb-4 overflow-y-auto flex-1 min-h-0 pr-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20 relative"
          >
            {/* Header: Badge */}
            <div className="not-prose mb-3 sticky top-0 bg-black/20 backdrop-blur-md z-10 p-2 rounded-lg flex items-center justify-between">
              <LyricsSourceBadge source={lyricsSource} isSynced={!!lrcData} />
            </div>
            
            <UnifiedLyricsView
              lrcData={lrcData}
              lyricsData={lyricsData}
              shouldAnimateLyrics={shouldAnimateLyrics}
              isTranslating={isTranslating}
              playerControls={playerControls}
              songUri={selectedTrack ? `spotify:track:${selectedTrack.id}` : undefined}
              lyricsContainerRef={lyricsContainerRef}
            />
          </div>
        ) : (
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
