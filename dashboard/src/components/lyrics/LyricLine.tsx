import React from 'react'

export interface LyricLineProps {
  timeMs: number
  text: string
  translation?: string
  state: 'current' | 'past' | 'future'
  onClick: (timeMs: number) => void
}

/**
 * 共用的單句歌詞元件
 * 封裝了 Apple Music 風格的縮放與模糊特效
 */
const LyricLine: React.FC<LyricLineProps> = ({ timeMs, text, translation, state, onClick }) => {
  const isCurrent = state === 'current'
  const isPast = state === 'past'

  // 將文字中的 **粗體** 轉換為 <strong>
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
    <div 
      className={`transition-all duration-500 ease-out cursor-pointer py-2 my-1 origin-left ${
        isCurrent 
          ? 'scale-[1.05] drop-shadow-lg opacity-100 blur-none' 
          : isPast 
            ? 'scale-[0.98] opacity-40 hover:opacity-70 blur-[0.5px]' 
            : 'scale-[0.98] opacity-30 hover:opacity-70 blur-[1px]'
      }`}
      onClick={() => onClick(timeMs)}
    >
      <p className={`text-xl sm:text-2xl tracking-wide transition-colors duration-300 ${
        isCurrent ? 'text-white font-medium' : 'text-white/80'
      }`}>
        {renderTextWithBold(text)}
      </p>
      {translation && (
        <p className={`text-base sm:text-lg mt-2 transition-colors duration-300 ${
          isCurrent ? 'text-spotify-green font-medium' : 'text-spotify-green/60'
        }`}>
          {renderTextWithBold(translation)}
        </p>
      )}
    </div>
  )
}

export default LyricLine
