import React, { useRef, useEffect } from 'react'
import { parseMarkdownToHtml } from '../../utils/markdown.js'
import { Sparkles } from 'lucide-react'

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
  const prevActiveMsRef = useRef<number | null>(null)

  // 當歌詞資料改變時，重設上一次播放的 active 時間，以確保換歌時滾動正常
  useEffect(() => {
    prevActiveMsRef.current = null
  }, [lyricsData])

  // 處理時間同步高亮與自動捲動的副作用 (useEffect)
  useEffect(() => {
    if (!containerRef.current || playerControls?.position === undefined) return

    // 取得所有的時間徽章
    const badges = Array.from(containerRef.current.querySelectorAll('.time-badge'))
    if (badges.length === 0) return

    // 解析出所有的 [timeMs, element] 組合並排序
    const parsedBadges = badges.map(el => {
      const ms = parseInt(el.getAttribute('data-time-ms') || '0', 10)
      return { ms, el: el as HTMLElement }
    }).sort((a, b) => a.ms - b.ms)

    const position = playerControls.position
    let activeIdx = -1

    // 尋找最後一個小於等於當前播放進度的時間標籤
    for (let i = 0; i < parsedBadges.length; i++) {
      if (parsedBadges[i].ms <= position) {
        activeIdx = i
      } else {
        break
      }
    }

    const activeBadge = activeIdx !== -1 ? parsedBadges[activeIdx] : null

    // 更新所有時間標籤與其對應段落的樣式
    parsedBadges.forEach((badge) => {
      const isCurrent = activeBadge && badge.ms === activeBadge.ms
      const parent = badge.el.closest('p, div') // 尋找該徽章所屬的段落

      if (isCurrent) {
        // 高亮時間徽章本身
        badge.el.classList.remove('bg-white/10', 'text-white/50')
        badge.el.classList.add('bg-spotify-green', 'text-black', 'font-bold')

        // 高亮對應的整行翻譯段落
        if (parent) {
          parent.classList.remove('text-gray-300', 'opacity-30')
          parent.classList.add('text-white', 'font-medium', 'scale-[1.01]', 'transition-all', 'duration-300')
        }
      } else {
        // 還原時間徽章樣式
        badge.el.classList.remove('bg-spotify-green', 'text-black', 'font-bold')
        badge.el.classList.add('bg-white/10', 'text-white/50')

        // 暗化非當前播放的段落，使焦點集中在目前歌詞上
        if (parent) {
          parent.classList.remove('text-white', 'font-medium', 'scale-[1.01]')
          parent.classList.add('text-gray-300', 'opacity-30', 'transition-all', 'duration-300')
        }
      }
    })

    // 自動捲動至當前高亮段落的置中位置，且只在歌詞切換時觸發，避免頻繁滾動
    if (activeBadge) {
      if (prevActiveMsRef.current !== activeBadge.ms) {
        prevActiveMsRef.current = activeBadge.ms
        const parent = activeBadge.el.closest('p, div')
        if (parent) {
          parent.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    } else {
      prevActiveMsRef.current = null
    }
  }, [playerControls?.position, lyricsData])

  // 處理點擊時間標籤事件
  const handleLyricsClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const timeMsStr = target.getAttribute('data-time-ms');
    if (timeMsStr && playerControls) {
      const timeMs = parseInt(timeMsStr, 10);
      if (!isNaN(timeMs)) {
        if (!playerControls.currentTrack && songUri && playerControls.playUri) {
          // 如果尚未載入歌曲，就發送播放請求並指定時間
          playerControls.playUri(songUri, timeMs);
        } else if (playerControls.seek) {
          // 如果已經載入歌曲，直接 seek
          playerControls.seek(timeMs);
        }
      }
    }
  };

  return (
    <>
      <div 
        ref={containerRef}
        className={shouldAnimateLyrics ? 'ai-stagger' : ''} 
        dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(lyricsData || '') }} 
        onClick={handleLyricsClick}
      />
      
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
