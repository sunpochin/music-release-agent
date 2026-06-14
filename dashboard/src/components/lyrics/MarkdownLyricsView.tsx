/**
 * 📝 MarkdownLyricsView — 雙語全文模式（React 元件化版本）
 * 
 * 負責渲染整篇歌詞，包含 AI 的前言與樂評。
 * 使用 parseMarkdownToBlocks 解析字串，並共用 <LyricLine> 渲染歌詞，
 * 徹底解決版面閃動與 XSS 風險，同時擁有 Apple Music 等級的視覺體驗。
 */
import React, { useMemo, useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { parseMarkdownToBlocks } from '../../utils/markdownParser'
import LyricLine from './LyricLine'

interface MarkdownLyricsViewProps {
  lyricsData: string
  shouldAnimateLyrics: boolean
  isTranslating: boolean
  playerControls?: any
  songUri?: string
}

const MarkdownLyricsView: React.FC<MarkdownLyricsViewProps> = ({
  lyricsData,
  shouldAnimateLyrics,
  isTranslating,
  playerControls,
  songUri
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // 1. 解析 Markdown 為 Blocks
  const blocks = useMemo(() => parseMarkdownToBlocks(lyricsData || ''), [lyricsData])

  // 2. 決定目前啟動的歌詞時間戳記
  const currentPosition = playerControls?.position ?? 0
  
  // 找出最後一個時間戳 <= currentPosition 的歌詞區塊
  const activeLyricInfo = useMemo(() => {
    if (!currentPosition) return { activeMs: -1, activeIdx: -1 }
    let activeMs = -1
    let activeIdx = -1
    let lyricIdx = 0
    for (const block of blocks) {
      if (block.type === 'lyric') {
        if (block.timeMs <= currentPosition) {
          activeMs = block.timeMs
          activeIdx = lyricIdx
        } else {
          break
        }
        lyricIdx++
      }
    }
    return { activeMs, activeIdx }
  }, [blocks, currentPosition])

  const { activeMs: activeTimeMs, activeIdx: activeLyricIdx } = activeLyricInfo

  // 3. 自動捲動邏輯
  const activeLyricRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (activeLyricRef.current) {
      activeLyricRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeTimeMs])

  // 處理點擊歌詞跳轉
  const handleLyricClick = (timeMs: number) => {
    if (!playerControls) return
    if (!playerControls.currentTrack && songUri && playerControls.playUri) {
      playerControls.playUri(songUri, timeMs)
    } else if (playerControls.seek) {
      playerControls.seek(timeMs)
    }
  }

  // 渲染內嵌粗體字 (非歌詞的普通段落用)
  const renderTextWithBold = (content: string) => {
    const parts = content.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>
      }
      return part
    })
  }

  return (
    <>
      <div 
        ref={containerRef}
        className={`${shouldAnimateLyrics ? 'ai-stagger' : ''}`}
      >
        {(() => {
          let lyricIdxCounter = 0;
          return blocks.map((block, index) => {
            if (block.type === 'heading') {
              if (block.level === 3) {
                return <h3 key={index} className="text-sm font-bold text-spotify-green mt-8 mb-4 flex items-center gap-1">{block.text}</h3>
              }
              return <h2 key={index} className="text-base font-bold text-white mt-6 mb-3">{block.text}</h2>
            }
            
            if (block.type === 'hr') {
              return <hr key={index} className="border-white/10 my-4" />
            }

            if (block.type === 'lyric') {
              const currentLyricIdx = lyricIdxCounter++;
              const isCurrent = block.timeMs === activeTimeMs
              const distance = activeLyricIdx === -1 ? currentLyricIdx : currentLyricIdx - activeLyricIdx
              
              return (
                <div key={index} ref={isCurrent ? activeLyricRef : null}>
                  <LyricLine
                    timeMs={block.timeMs}
                    text={block.text}
                    translation={block.translation}
                    distance={distance}
                    onClick={handleLyricClick}
                  />
                </div>
              )
            }

          if (block.type === 'paragraph') {
            // 處理純粗體金句
            if (block.text.startsWith('**') && block.text.endsWith('**')) {
              return (
                <p key={index} className="text-sm italic font-medium text-spotify-green/90 bg-spotify-green/5 border-l-2 border-spotify-green py-2 px-3 my-3 rounded-r-lg">
                  {block.text.replace(/\*\*/g, '')}
                </p>
              )
            }
            // 處理清單
            if (block.text.startsWith('- ')) {
              return (
                <div key={index} className="flex items-start gap-2 my-1 text-xs text-gray-300">
                  <span className="text-spotify-green">•</span>
                  <span>{renderTextWithBold(block.text.substring(2))}</span>
                </div>
              )
            }
            
            return <p key={index} className="text-xs text-gray-300 leading-relaxed my-2">{renderTextWithBold(block.text)}</p>
          }
          
          return null
          })
        })()}
      </div>
      
      {isTranslating && (
        <div className="mt-6 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md animate-pulse flex items-center gap-3">
          <Sparkles size={16} className="text-spotify-green animate-spin" />
          <span className="text-xs text-spotify-green font-bold">AI 正在翻譯中，請稍候...</span>
        </div>
      )}
    </>
  )
}

export default MarkdownLyricsView
