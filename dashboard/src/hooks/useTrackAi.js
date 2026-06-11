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

  // 🪄 選歌即自動載入歌詞（產品決策）：
  // 【小朋友解釋法】：歌曲頁的「主菜」就是歌詞 — 客人坐下來就上菜，
  // 不要再遞菜單要客人「按一下才出餐」。
  // AI 賞析比較重（像甜點要現做），保留手動觸發，給客人明確的選擇權。
  // autoFetchedRef 確保同一首歌只自動叫一次菜（StrictMode 雙重 effect 也不會重複）。
  // Debounce 400ms：用 j/k 快速逛專輯時，路過的歌不叫菜 —
  // 停下來的那首才真正呼叫 API（不浪費 token、不製造一串被丟棄的請求）。
  const autoFetchedRef = useRef(null)
  useEffect(() => {
    if (!selectedAlbum || !selectedTrack) return
    if (autoFetchedRef.current === selectedTrack.id) return

    const timer = setTimeout(() => {
      autoFetchedRef.current = selectedTrack.id
      fetchLyricsFor(selectedTrack)
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbum, selectedTrack])

  // AI 歌詞搜尋與翻譯（自動載入與手動重試共用同一條路徑）
  const fetchLyricsFor = async (track) => {
    if (!selectedAlbum || !track) return
    const trackIdAtStart = track.id
    setIsLoading(true)
    setLyricsData('')

    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selectedAlbum.artistName || 'Unknown Artist',
          trackName: track.name
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

  // 手動重試入口（自動載入失敗時的「重新載入歌詞」按鈕用）
  const handleFetchLyrics = () => fetchLyricsFor(selectedTrack)

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
