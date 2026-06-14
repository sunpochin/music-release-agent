import React, { useMemo, useEffect } from 'react'
import { parseMarkdownToBlocks, MarkdownBlock } from '../../utils/markdownParser'
import { createTranslationMap, getTranslation } from '../../utils/translationMatcher'
import LyricLine from './LyricLine'

interface UnifiedLyricsViewProps {
  lrcData?: any[]
  lyricsData: string
  shouldAnimateLyrics: boolean
  isTranslating: boolean
  playerControls?: any
  songUri?: string
  lyricsContainerRef: any
}

const UnifiedLyricsView: React.FC<UnifiedLyricsViewProps> = ({
  lrcData,
  lyricsData,
  shouldAnimateLyrics,
  isTranslating,
  playerControls,
  songUri,
  lyricsContainerRef
}) => {
  // 1. 解析 Markdown 為 Blocks
  const blocks = useMemo(() => parseMarkdownToBlocks(lyricsData || ''), [lyricsData])

  // 2. 準備 lrcData 的翻譯 Map
  const translationsMap = useMemo(() => createTranslationMap(lyricsData || ''), [lyricsData])

  // 3. 分離 Intro, Lyrics, Outro
  const { introBlocks, outroBlocks } = useMemo(() => {
    const firstLyricIdx = blocks.findIndex(b => b.type === 'lyric')
    const lastLyricIdx = blocks.findLastIndex(b => b.type === 'lyric')
    
    if (firstLyricIdx === -1) {
      // 找不到任何歌詞，全當 Intro
      return { introBlocks: blocks, outroBlocks: [] }
    }
    
    return {
      introBlocks: blocks.slice(0, firstLyricIdx),
      outroBlocks: blocks.slice(lastLyricIdx + 1)
    }
  }, [blocks])

  // 4. 判斷目前播放進度
  const position = playerControls?.position ?? 0
  
  const { activeIdx, activeMs } = useMemo(() => {
    if (!position) return { activeIdx: -1, activeMs: -1 }

    if (lrcData && lrcData.length > 0) {
      // 走 KTV lrcData 邏輯
      let idx = -1
      for (let i = 0; i < lrcData.length; i++) {
        if (lrcData[i].timeMs <= position) {
          idx = i
        } else {
          break
        }
      }
      return { activeIdx: idx, activeMs: idx !== -1 ? lrcData[idx].timeMs : -1 }
    } else {
      // 走 Markdown lyric blocks 邏輯
      let idx = -1
      let activeMs = -1
      let lyricCounter = 0
      for (const block of blocks) {
        if (block.type === 'lyric') {
          if (block.timeMs <= position) {
            idx = lyricCounter
            activeMs = block.timeMs
          } else {
            break
          }
          lyricCounter++
        }
      }
      return { activeIdx: idx, activeMs }
    }
  }, [lrcData, position, blocks])

  // 5. 自動捲動邏輯
  useEffect(() => {
    if (activeIdx !== -1 && lyricsContainerRef?.current) {
      // 確保 DOM 渲染完畢後再捲動
      requestAnimationFrame(() => {
        const activeElement = lyricsContainerRef.current.querySelector('[data-active="true"]')
        if (activeElement) {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    }
  }, [activeIdx, lyricsContainerRef])

  // 6. 處理跳轉
  const handleLyricClick = (timeMs: number) => {
    if (!playerControls) return
    if (!playerControls.currentTrack && songUri && playerControls.playUri) {
      playerControls.playUri(songUri, timeMs)
    } else if (playerControls.seek) {
      playerControls.seek(timeMs)
    }
  }

  // Helper 渲染一般 Block
  const renderTextWithBold = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  const renderBlock = (block: MarkdownBlock, index: number) => {
    if (block.type === 'heading') {
      if (block.level === 3) {
        return <h3 key={`h3-${index}`} className="text-sm font-bold text-spotify-green mt-8 mb-4 flex items-center gap-1">{block.text}</h3>
      }
      return <h2 key={`h2-${index}`} className="text-base font-bold text-white mt-6 mb-3">{block.text}</h2>
    }
    
    if (block.type === 'hr') {
      return <hr key={`hr-${index}`} className="border-white/10 my-4" />
    }

    if (block.type === 'paragraph') {
      // 處理純粗體金句
      if (block.text.startsWith('**') && block.text.endsWith('**')) {
        return (
          <p key={`p-${index}`} className="text-sm italic font-medium text-spotify-green/90 bg-spotify-green/5 border-l-2 border-spotify-green py-2 px-3 my-3 rounded-r-lg">
            {block.text.replace(/\*\*/g, '')}
          </p>
        )
      }
      // 處理清單
      if (block.text.startsWith('- ')) {
        return (
          <div key={`li-${index}`} className="flex items-start gap-2 my-1 text-xs text-gray-300">
            <span className="text-spotify-green">•</span>
            <span>{renderTextWithBold(block.text.substring(2))}</span>
          </div>
        )
      }
      return <p key={`p-${index}`} className="text-xs text-gray-300 leading-relaxed my-2">{renderTextWithBold(block.text)}</p>
    }
    return null
  }

  return (
    <div className={`py-4 ${shouldAnimateLyrics ? 'ai-stagger' : ''}`}>
      {/* 1. Intro 區塊 */}
      {introBlocks.length > 0 && (
        <div className="mb-12">
          {introBlocks.map(renderBlock)}
        </div>
      )}

      {/* 2. 歌詞區塊 */}
      <div className="flex flex-col items-center justify-center text-center space-y-4 relative py-8">
        {lrcData && lrcData.length > 0 ? (
          // 有 lrcData：使用高精度 lrcData 渲染
          lrcData.map((line, index) => {
            const translation = getTranslation(line.timeMs, translationsMap) || undefined
            const isCurrent = index === activeIdx
            const distance = activeIdx === -1 ? index : index - activeIdx

            return (
              <div key={`lrc-${index}`} data-active={isCurrent} className="w-full">
                <LyricLine
                  timeMs={line.timeMs}
                  text={line.text}
                  translation={translation}
                  distance={distance}
                  onClick={handleLyricClick}
                />
              </div>
            )
          })
        ) : (
          // 沒有 lrcData：使用 Markdown 解析出來的 lyrics blocks
          blocks.filter(b => b.type === 'lyric').map((block, index) => {
            if (block.type !== 'lyric') return null // Typescript narrow
            const isCurrent = block.timeMs === activeMs
            const distance = activeIdx === -1 ? index : index - activeIdx
            
            return (
              <div key={`mdl-${index}`} data-active={isCurrent} className="w-full">
                <LyricLine
                  timeMs={block.timeMs}
                  text={block.text}
                  translation={block.translation}
                  distance={distance}
                  onClick={handleLyricClick}
                />
              </div>
            )
          })
        )}
      </div>

      {/* 3. Outro 區塊 */}
      {outroBlocks.length > 0 && (
        <div className="mt-12">
          {outroBlocks.map(renderBlock)}
        </div>
      )}

      {/* 4. 翻譯載入中提示 */}
      {isTranslating && (
        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md animate-pulse flex items-center justify-center gap-3">
          <svg className="w-4 h-4 text-spotify-green animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="text-xs text-spotify-green font-bold">AI 正在對照翻譯中...</span>
        </div>
      )}
    </div>
  )
}

export default UnifiedLyricsView
