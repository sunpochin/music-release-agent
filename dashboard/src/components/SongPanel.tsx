import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Sparkles, AlertCircle, ChevronLeft, Upload } from 'lucide-react'
import html2canvas from 'html2canvas'
import ShareCard from './ShareCard'
import { createTranslationMap } from '../utils/translationMatcher'

import LyricsSourceBadge from './LyricsSourceBadge'
import AddToPlaylistButton from './AddToPlaylistButton'

// Extracted Sub-Components
import CopyLinkButton from './lyrics/CopyLinkButton'
import KtvLyricsView from './lyrics/KtvLyricsView'
import MarkdownLyricsView from './lyrics/MarkdownLyricsView'
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

  // 視圖切換狀態：'ktv' 或 'markdown'
  const [viewMode, setViewMode] = useState<'ktv' | 'markdown'>('ktv')
  const autoFallbackRef = useRef(false)

  // 當切換歌曲時重置視圖為 KTV 模式
  useEffect(() => {
    setViewMode('ktv')
    autoFallbackRef.current = false
  }, [selectedTrack])

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

  // Check translation mapping viability
  const translationMap = useMemo(() => createTranslationMap(lyricsData || ''), [lyricsData]);
  const hasTranslationsInMap = Object.keys(translationMap).length > 0;
  
  // 自動降級邏輯：如果要求翻譯，卻沒抓出任何雙語對照，則自動強制切換為 Markdown 模式
  // 使用 autoFallbackRef 確保每首歌只會自動降級一次，允許使用者事後手動切換回 KTV 模式（即便沒翻譯）
  useEffect(() => {
    // 只有在「已經經過翻譯」且「沒有抓出任何雙語對照」時，才自動降級為 Markdown 模式
    if (isTranslated && lrcData && !hasTranslationsInMap && viewMode === 'ktv' && !autoFallbackRef.current) {
      setViewMode('markdown')
      autoFallbackRef.current = true
    }
  }, [isTranslated, lrcData, hasTranslationsInMap, viewMode])

  const effectiveViewMode = lrcData ? viewMode : 'markdown';

  return (
    <div className="flex-1 bg-black/20 backdrop-blur-[60px] border border-white/5 rounded-[32px] p-8 shadow-2xl shadow-black/50 flex flex-col gap-6">

      {/* ── 隨選翻譯按鈕 ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-end gap-4">
        <LyricsToolbar 
          rawLoading={rawLoading}
          isTranslating={isTranslating}
          isTranslated={isTranslated}
          handleTranslate={handleTranslate}
          handleRedownloadRaw={handleRedownloadRaw}
          handleClearCache={handleClearCache}
        />
      </div>

      {/* ── 標題與來源 ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 border-b border-white/10 pb-6">
        <div>
          {selectedTrack ? (
            <>
              <div className="flex items-center gap-3 mb-2">
                <span className="px-2.5 py-1 rounded-md bg-white/10 text-white/70 text-xs font-bold tracking-widest uppercase">
                  Track {selectedTrack.track_number}
                </span>
                <span className="text-white/40 text-sm font-medium">
                  {Math.floor(selectedTrack.duration_ms / 60000)}:{String(Math.floor((selectedTrack.duration_ms % 60000) / 1000)).padStart(2, '0')}
                </span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 tracking-tight leading-tight">
                {selectedTrack.name}
              </h2>
            </>
          ) : (
            <h2 className="text-3xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-white/60 tracking-tight leading-tight">
              {selectedAlbum.name}
            </h2>
          )}
        </div>
        
        <div className="flex flex-col items-end gap-2">
          {selectedTrack && <AddToPlaylistButton trackUri={selectedTrack.uri} />}
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
            {/* Header: Badge & View Toggle */}
            <div className="not-prose mb-3 sticky top-0 bg-black/20 backdrop-blur-md z-10 p-2 rounded-lg flex items-center justify-between">
              <LyricsSourceBadge source={lrcData ? 'LRCLIB (動態同步)' : lyricsSource} />
              
              {/* Toggle switch visible if we have lrcData (even before translation) */}
              {lrcData && (
                <div className="flex bg-white/5 border border-white/10 rounded-xl p-1">
                  <button 
                    onClick={() => setViewMode('ktv')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewMode === 'ktv' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                  >
                    KTV 動態
                  </button>
                  <button 
                    onClick={() => setViewMode('markdown')}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${viewMode === 'markdown' ? 'bg-white/20 text-white' : 'text-white/40 hover:text-white/70'}`}
                  >
                    雙語全文
                  </button>
                </div>
              )}
            </div>
            
            {effectiveViewMode === 'ktv' && lrcData ? (
              <KtvLyricsView 
                lrcData={lrcData} 
                lyricsData={lyricsData} 
                playerControls={playerControls} 
                lyricsContainerRef={lyricsContainerRef} 
                songUri={selectedTrack ? `spotify:track:${selectedTrack.id}` : undefined}
              />
            ) : (
              <MarkdownLyricsView 
                lyricsData={lyricsData} 
                shouldAnimateLyrics={shouldAnimateLyrics} 
                isTranslating={isTranslating} 
                playerControls={playerControls}
                songUri={selectedTrack ? `spotify:track:${selectedTrack.id}` : undefined}
              />
            )}
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

      {/* ── 分隔線：工具區 ── */}
      <div className="border-t border-white/10 pt-5 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">
              當前選中：<span className="text-white font-semibold">{selectedTrack ? selectedTrack.name : selectedAlbum.name}</span>
            </p>
          </div>
        </div>

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
