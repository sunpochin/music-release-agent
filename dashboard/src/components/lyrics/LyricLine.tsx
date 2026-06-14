import React from 'react'

export interface LyricLineProps {
  timeMs: number
  text: string
  translation?: string
  distance: number // 0 = current, negative = past, positive = future
  onClick: (timeMs: number) => void
}

/**
 * 共用的單句歌詞元件
 * 封裝了 Apple Music 風格的 3D 景深模糊與縮放特效
 */
const LyricLine: React.FC<LyricLineProps> = ({ timeMs, text, translation, distance, onClick }) => {
  const isCurrent = distance === 0
  const absDistance = Math.abs(distance)

  // 動態計算 Apple Music 風格的 3D 景深效果
  // 距離越遠，模糊度越高，透明度越低
  const blurAmount = isCurrent ? 0 : Math.min(absDistance * 1.5, 12) // 離越遠越模糊，最高 12px
  const opacityAmount = isCurrent ? 1 : Math.max(0.6 - (absDistance * 0.1), 0.1) // 未播放的最高透明度 0.6，離越遠越暗
  const scaleAmount = isCurrent ? 1.05 : 0.98

  const dynamicStyle = {
    filter: `blur(${blurAmount}px)`,
    opacity: opacityAmount,
    transform: `scale(${scaleAmount})`,
  }

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
      className="transition-all duration-[800ms] ease-[cubic-bezier(0.2,0.8,0.2,1)] cursor-pointer py-3 my-2 origin-left hover:opacity-100"
      style={dynamicStyle}
      onClick={() => onClick(timeMs)}
    >
      <p className={`text-xl sm:text-3xl tracking-wide transition-colors duration-[800ms] ${
        isCurrent ? 'text-white font-bold drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]' : 'text-white/70 font-medium'
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
