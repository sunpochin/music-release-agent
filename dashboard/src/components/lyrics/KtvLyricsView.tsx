import React, { useEffect } from 'react'
import { createTranslationMap, getTranslation } from '../../utils/translationMatcher'

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
  // Memoize translation map to avoid recreating it on every render
  const translationMap = React.useMemo(() => createTranslationMap(lyricsData || ''), [lyricsData]);

  return (
    <div className="flex flex-col gap-6 py-32 transition-all duration-500">
      {lrcData.map((line: any, idx: number) => {
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
        const translatedText = getTranslation(line.timeMs, translationMap);

        return (
          <div 
            key={idx} 
            id={`lrc-line-${idx}`}
            onClick={() => {
              if (playerControls) {
                if (!playerControls.currentTrack && songUri && playerControls.playUri) {
                  playerControls.playUri(songUri, line.timeMs);
                } else if (playerControls.seek) {
                  playerControls.seek(line.timeMs);
                }
              }
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
      })}
    </div>
  )
}

export default KtvLyricsView
