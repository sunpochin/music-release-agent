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
  const [rawLoading, setRawLoading] = useState(false)
  const [isTranslated, setIsTranslated] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  // 歌詞來源（provenance）：lrclib / spotify / llm-recall / none …
  // 攤在 UI 上，讓用戶看得到可信度，而不是只躺在 cache frontmatter
  const [lyricsSource, setLyricsSource] = useState(undefined)

  // 隨時追蹤當前選中的單曲，以防異步請求結束時選取已改變
  const selectedTrackRef = useRef(selectedTrack)
  useEffect(() => {
    selectedTrackRef.current = selectedTrack
  }, [selectedTrack])

  // 換歌先擦黑板
  useEffect(() => {
    setLyricsData('')
    setIsTranslated(false)
    setIsTranslating(false)
    setLyricsSource(undefined)
  }, [selectedTrack])

  // 🪄 選歌即自動載入歌詞（產品決策）：
  // 歌曲頁的「主菜」就是歌詞 — 客人選中即上菜，載入原始歌詞。
  const autoFetchedRef = useRef(null)
  useEffect(() => {
    if (!selectedAlbum || !selectedTrack) return
    if (autoFetchedRef.current === selectedTrack.id) return

    const timer = setTimeout(() => {
      autoFetchedRef.current = selectedTrack.id
      fetchLyricsFor(selectedTrack, { translate: false })
    }, 400)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAlbum, selectedTrack])

  // AI 歌詞搜尋與隨選翻譯主邏輯
  const fetchLyricsFor = async (track, { translate = false, refresh = false } = {}) => {
    if (!selectedAlbum || !track) return
    const trackIdAtStart = track.id
    
    if (translate) {
      setIsTranslating(true)
    } else {
      setRawLoading(true)
      setLyricsData('')
      setIsTranslated(false)
    }

    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selectedAlbum.artistName || 'Unknown Artist',
          trackName: track.name,
          trackId: track.id,
          translate: Boolean(translate),
          refresh: Boolean(refresh)
        })
      })
      const result = await res.json()
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setLyricsData(result?.text || '無法取得歌詞。')
        setIsTranslated(Boolean(result?.translated))
        setLyricsSource(result?.source)
      }
    } catch {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setLyricsData('載入過程發生錯誤。')
      }
    } finally {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setRawLoading(false)
        setIsTranslating(false)
      }
    }
  }

  // 手動重試與重新載入原文
  const handleFetchLyrics = () => fetchLyricsFor(selectedTrack, { translate: false })

  // 隨選翻譯入口
  const handleTranslate = () => fetchLyricsFor(selectedTrack, { translate: true })

  // 強制重新下載原文入口
  const handleRedownloadRaw = () => fetchLyricsFor(selectedTrack, { translate: false, refresh: true })

  // 清除快取並重新下載
  const handleClearCache = async () => {
    if (!selectedAlbum || !selectedTrack) return
    const trackIdAtStart = selectedTrack.id
    setRawLoading(true)
    try {
      await fetch('/api/lyrics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selectedAlbum.artistName || 'Unknown Artist',
          trackName: selectedTrack.name
        })
      })
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setLyricsData('')
        setIsTranslated(false)
        // 重新獲取最原始的歌詞
        await fetchLyricsFor(selectedTrack, { translate: false })
      }
    } catch (err) {
      console.error('清除快取發生錯誤:', err)
    } finally {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setRawLoading(false)
      }
    }
  }

  return {
    lyricsData,
    lyricsSource,
    rawLoading,
    isTranslated,
    isTranslating,
    handleFetchLyrics,
    handleTranslate,
    handleRedownloadRaw,
    handleClearCache
  }
}
