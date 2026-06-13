/**
 * 🎤 KtvLyricsView — KTV 動態同步模式
 * 
 * 專門處理帶有精準時間戳記的動態歌詞 (LRC)。
 * 會將正在播放的那一句歌詞放大並置中顯示，同時透過 `translationMatcher`
 * 自動尋找並顯示對應的中文翻譯。點擊任意一句歌詞，可使播放器直接跳轉至該時間點。
 */
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

  // 預先計算當前正在播放的那一句歌詞索引，避免在 map 迴圈內重複計算
  const currentLineIdx = lrcData ? lrcData.findIndex((line: any, idx: number) => {
    return playerControls?.position >= line.timeMs && 
      (idx === lrcData.length - 1 || playerControls?.position < lrcData[idx + 1].timeMs);
  }) : -1;

  // 使用 useEffect 處理自動滾動的副作用 (Side Effect)，避免在 Render 階段直接操作 DOM 導致效能問題
  useEffect(() => {
    if (currentLineIdx !== -1 && lyricsContainerRef.current) {
      const el = document.getElementById(`lrc-line-${currentLineIdx}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [currentLineIdx, lyricsContainerRef]);

  return (
    <div className="flex flex-col gap-6 py-32 transition-all duration-500">
      {lrcData.map((line: any, idx: number) => {
        const isCurrent = idx === currentLineIdx;
        
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
