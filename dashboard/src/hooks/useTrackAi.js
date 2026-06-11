import { useEffect, useRef, useState } from 'react'

/**
 * 🤖 useTrackAi — 單曲 AI 歌詞翻譯與賞析的載入 hook
 *
 * 【小朋友解釋法】：
 * 這是「AI 翻譯員」和「AI 樂評家」的辦公室，從 App.jsx 大客廳搬出來。
 * 守則只有兩條，跟以前一模一樣：
 * 1. 防答非所問：請 AI 翻譯期間如果使用者換了歌，翻譯送回來會蓋掉新歌的內容！
 *    所以開工時先用小紙條記下歌曲編號 (trackIdAtStart)，
 *    成果送回來時比對「監視器」(selectedTrackRef) 還是不是同一首，一樣才更新畫面。
 * 2. 換歌先擦黑板：一感應到換歌，立刻把舊歌詞、舊分析擦乾淨，
 *    不讓上一首歌的內容殘留在螢幕上。
 */
export function useTrackAi(selectedAlbum, selectedTrack) {
  const [lyricsData, setLyricsData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)

  // 隨時追蹤當前選中的單曲，以防異步請求結束時選取已改變
  const selectedTrackRef = useRef(selectedTrack)
  useEffect(() => {
    selectedTrackRef.current = selectedTrack
  }, [selectedTrack])

  // 換歌先擦黑板
  useEffect(() => {
    setLyricsData('')
    setAnalysisData('')
  }, [selectedTrack])

  // 手動觸發 AI 歌詞搜尋與翻譯（綁定選中的單曲）
  const handleFetchLyrics = async () => {
    if (!selectedAlbum || !selectedTrack) return
    const trackIdAtStart = selectedTrack.id
    setIsLoading(true)
    setLyricsData('')

    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selectedAlbum.artistName || 'Unknown Artist',
          trackName: selectedTrack.name
        })
      })
      const result = await res.json()
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setLyricsData(result.text || '無法取得歌詞翻譯。')
      }
    } catch {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setLyricsData('翻譯過程發生錯誤。')
      }
    } finally {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setIsLoading(false)
      }
    }
  }

  // 手動觸發單曲 AI 賞析與分析
  const handleAnalyzeTrack = async () => {
    if (!selectedAlbum || !selectedTrack) return
    const trackIdAtStart = selectedTrack.id
    setAnalysisLoading(true)
    setAnalysisData('')

    try {
      const res = await fetch('/api/tracks/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selectedAlbum.artistName || 'Unknown Artist',
          trackName: selectedTrack.name,
          albumName: selectedAlbum.name
        })
      })
      const result = await res.json()
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setAnalysisData(result.text || '無法取得歌曲分析。')
      }
    } catch {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setAnalysisData('分析過程發生錯誤。')
      }
    } finally {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setAnalysisLoading(false)
      }
    }
  }

  return {
    lyricsData,
    isLoading,
    analysisData,
    analysisLoading,
    handleFetchLyrics,
    handleAnalyzeTrack
  }
}
