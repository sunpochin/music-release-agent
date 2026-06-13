/**
 * 🎤 KtvLyricsView — KTV 動態同步模式
 * 
 * 專門處理帶有精準時間戳記的動態歌詞 (LRC)。
 * 會將正在播放的那一句歌詞放大並置中顯示，同時透過 `translationMatcher`
 * 自動尋找並顯示對應的中文翻譯。點擊任意一句歌詞，可使播放器直接跳轉至該時間點。
 */
import React, { useEffect, useMemo } from 'react'
import { createTranslationMap, getTranslation } from '../../utils/translationMatcher'
import LyricLine from './LyricLine'

interface KtvLyricsViewProps {
  lrcData: any[]
  lyricsData: string
  playerControls: any
  lyricsContainerRef: any
  songUri?: string
}

const KtvLyricsView: React.FC<KtvLyricsViewProps> = ({
  lrcData,
  lyricsData,
  playerControls,
  lyricsContainerRef,
  songUri
}) => {
  // 自動找出這首歌的最佳翻譯，並快取起來避免頻繁重新運算
  const translationsMap = useMemo(() => {
    return createTranslationMap(lyricsData || '')
  }, [lyricsData])

  const position = playerControls?.position ?? 0

  // 決定哪一行歌詞是正在播放的
  const activeIdx = useMemo(() => {
    if (!position || lrcData.length === 0) return -1
    let idx = -1
    for (let i = 0; i < lrcData.length; i++) {
      if (lrcData[i].timeMs <= position) {
        idx = i
      } else {
        break
      }
    }
    return idx
  }, [lrcData, position])

  // 自動捲動
  useEffect(() => {
    if (activeIdx !== -1 && lyricsContainerRef.current) {
      // 確保 DOM 渲染完畢後再捲動
      requestAnimationFrame(() => {
        const activeElement = lyricsContainerRef.current.querySelector('[data-active="true"]')
        if (activeElement) {
          activeElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      })
    }
  }, [activeIdx, lyricsContainerRef])

  // 處理點擊歌詞直接跳轉進度
  const handleLyricClick = (timeMs: number) => {
    if (!playerControls.currentTrack && songUri && playerControls.playUri) {
      // 若播放器內尚未載入該曲目，直接要求播放該首並帶入指定時間
      playerControls.playUri(songUri, timeMs)
    } else if (playerControls.seek) {
      // 已在播放，直接跳轉
      playerControls.seek(timeMs)
    }
  }

  return (
    <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
      {lrcData.map((line, index) => {
        const translation = getTranslation(line.timeMs, translationsMap) || undefined
        const isCurrent = index === activeIdx
        const isPast = index < activeIdx
        const state = isCurrent ? 'current' : (isPast ? 'past' : 'future')

        return (
          <div key={index} data-active={isCurrent}>
            <LyricLine
              timeMs={line.timeMs}
              text={line.text}
              translation={translation}
              state={state}
              onClick={handleLyricClick}
            />
          </div>
        )
      })}
    </div>
  )
}

export default KtvLyricsView
