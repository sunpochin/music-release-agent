import React from 'react'
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
      {/* 
        給開發者的筆記（為什麼這裡沒有分秒進度？）：
        
        小朋友版本的解釋：
        「KTV 動態」就像是有人拿著碼表，在你唱歌的時候幫你記下每一句話是在第幾分第幾秒唱出來的。
        「雙語全文 (Markdown 模式)」則是 AI 機器人聽完整首歌後，寫下的一篇優美翻譯文章。
        AI 機器人只知道整首歌的意思，但它沒有拿碼表幫我們記錄這句話是第幾秒唱的！
        因為我們沒有 AI 翻譯文章的「碼表時間」，所以沒辦法讓字跟著音樂一起變色前進喔！
      */}
      <div 
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
