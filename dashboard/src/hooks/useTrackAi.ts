import { useEffect, useRef, useState } from 'react'
import { parseLrc } from '../utils/lrcParser'

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
 *
 * ⚠️ 重要：「歌詞閃兩次」的根本原因與修法
 * React 執行順序永遠是「render → effect」，不是「effect → render」。
 * 所以當 selectedTrack 改變時：
 *   步驟1 (render)：React 先用「新 track + 舊 lyricsData」畫一幀 → 舊歌詞短暫閃現
 *   步驟2 (effect)：才清掉 lyricsData、設 rawLoading=true → spinner
 *   步驟3：API 回來 → 新歌詞
 * 光靠 effect 清 state 永遠無法避免步驟1的閃爍，這是 React 架構本質。
 *
 * 修法：用 lyricsForTrackId state 追蹤「目前畫面上的歌詞屬於哪首歌」。
 * 在 render 階段直接算出 isStale = selectedTrack.id !== lyricsForTrackId。
 * 只要 isStale，就把 lyricsData 當空字串、rawLoading 當 true，直接顯示 spinner。
 * 這樣第一幀 render 時就能正確顯示 spinner，不需要等 effect。
 */
export function useTrackAi(selectedAlbum, selectedTrack) {
  const [lyricsData, setLyricsData] = useState('')
  const [rawLoading, setRawLoading] = useState(false)
  const [isTranslated, setIsTranslated] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  // 歌詞來源（provenance）：lrclib / spotify / llm-recall / none …
  // 攤在 UI 上，讓用戶看得到可信度，而不是只躺在 cache frontmatter
  const [lyricsSource, setLyricsSource] = useState(undefined)
  // 目前畫面上的歌詞屬於哪首歌的 id
  // 【小朋友解釋法】：React render 比 effect 先跑，所以光靠 effect 清歌詞還是會
  // 先渲染一幀「新歌 + 舊歌詞」的組合，造成第一次閃爍。
  // 我們改用這個 state 在 render 時直接比對：
  // 只要 lyricsForTrackId !== selectedTrack.id，就當作「正在載入」，直接顯示 spinner。
  const [lyricsForTrackId, setLyricsForTrackId] = useState(null)

  const [lrcData, setLrcData] = useState<{ timeMs: number; text: string }[] | null>(null)

  // 隨時追蹤當前選中的單曲，以防異步請求結束時選取已改變
  const selectedTrackRef = useRef(selectedTrack)
  useEffect(() => {
    selectedTrackRef.current = selectedTrack
  }, [selectedTrack])

  // 🪄 選歌即自動載入歌詞（產品決策）：
  const autoFetchedRef = useRef(null)
  useEffect(() => {
    // 只清除「翻譯狀態」，不清除歌詞內容（交給 fetchLyricsFor 處理）
    setIsTranslated(false)
    setIsTranslating(false)
    setLyricsSource(undefined)
    setLrcData(null)

    if (!selectedAlbum || !selectedTrack) {
      setRawLoading(false)
      return
    }

    if (autoFetchedRef.current === selectedTrack.id) {
      return
    }

    setRawLoading(true)

    const timer = setTimeout(() => {
      autoFetchedRef.current = selectedTrack.id
      // fetchLyricsFor 會負責設置 rawLoading=true 和清空歌詞
      fetchLyricsFor(selectedTrack, { translate: false })
    }, 400)
    return () => {
      clearTimeout(timer)
    }
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
      setLrcData(null)
      setIsTranslated(false)
    }

    try {
      // 並行抓取 LRCLIB 與自家的 API
      const lrclibPromise = !translate ? fetch(`https://lrclib.net/api/search?track_name=${encodeURIComponent(track.name)}&artist_name=${encodeURIComponent(selectedAlbum.artistName || '')}`)
        // 確保 API 狀態碼是 OK 才解析 JSON，否則回傳 null 避免壞檔
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.length > 0 && data[0].syncedLyrics) {
            // 直接使用靜態 import 的 parseLrc (效能更好且不會產生非同步競態)
            if (selectedTrackRef.current?.id === trackIdAtStart) {
              setLrcData(parseLrc(data[0].syncedLyrics));
            }
          }
        }).catch(() => null) : Promise.resolve();

      const apiPromise = fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selectedAlbum.artistName || 'Unknown Artist',
          trackName: track.name,
          trackId: track.id,
          translate: Boolean(translate),
          refresh: Boolean(refresh)
        })
      });

      const [res] = await Promise.all([apiPromise, lrclibPromise]);
      
      // 502 = 歌詞翻譯 companion 不可達（核心服務的明確降級回應）
      // 顯示可行動的訊息而非通用錯誤 — 音樂庫等核心功能不受影響
      if (res.status === 502) {
        if (selectedTrackRef.current?.id === trackIdAtStart) {
          setLyricsData('### 歌詞服務暫時離線\n\n歌詞翻譯服務目前暫時離線。\n\n音樂庫瀏覽與其他功能不受影響；服務恢復後點擊「重新載入歌詞」即可。')
          setIsTranslated(false)
          setLyricsSource('service-down')
        }
        return
      }

      const result = await res.json()
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setLyricsData(result?.text || '無法取得歌詞。')
        setLyricsForTrackId(trackIdAtStart)
        setIsTranslated(Boolean(result?.translated))
        setLyricsSource(result?.source)
      }
    } catch {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setLyricsData('載入過程發生錯誤。')
        setLyricsForTrackId(trackIdAtStart)
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

  // 隨選翻譯入口（可選擇是否強制刷新快取）
  const handleTranslate = (forceRefresh = false) => {
    const isRefresh = typeof forceRefresh === 'boolean' ? forceRefresh : false;
    return fetchLyricsFor(selectedTrack, { translate: true, refresh: isRefresh });
  }

  // 強制重新下載原文入口
  const handleRedownloadRaw = () => fetchLyricsFor(selectedTrack, { translate: false, refresh: true })

  // 清除快取並重新下載
  const handleClearCache = async () => {
    if (!selectedAlbum || !selectedTrack) return
    const trackIdAtStart = selectedTrack.id
    setRawLoading(true)
    try {
      const res = await fetch('/api/lyrics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          artistName: selectedAlbum.artistName || 'Unknown Artist',
          trackName: selectedTrack.name
        })
      })
      if (!res.ok) {
        throw new Error('Failed to clear cache on the server')
      }
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

  // render 時直接算出「是否正在等待新歌詞」
  // isStale=true 代表畫面上的歌詞屬於上一首歌，render 階段就擋掉，不等 effect
  const isStale = selectedTrack != null && lyricsForTrackId !== selectedTrack.id
  const effectiveLoading = rawLoading || isStale

  // ✨ 進場動畫「只播一次」防閃爍
  // 【小朋友解釋法】：歌詞逐行淡入的進場動畫（ai-stagger）很漂亮，但有個陷阱——
  // 只要歌詞那塊 DOM 被 React「重新蓋一次房子」(remount)，CSS 動畫就會從頭再播一次，
  // 看起來就像「同一份歌詞閃了兩次」。
  // 什麼時候會偷偷重蓋房子？例如專輯樂評（/api/review 那個慢慢生成的 AI 回應）晚個幾秒
  // 才送到，觸發整個面板重畫，歌詞那塊就被連帶重蓋 → 動畫重播 → 閃第二次。
  // 解法：拿一本「點名簿」(animatedTracksRef) 記住哪幾首歌的動畫已經播過了。
  // 這本簿子放在 App 層的這個 hook 裡，就算下面的歌詞面板被重蓋，簿子也不會被燒掉。
  // 第一次顯示某首歌的歌詞 → 簿子上沒名字 → 帶動畫；之後任何重蓋 → 簿子上有名字 → 不帶動畫，
  // 瞬間顯示、絕不重播。換到「真正的新歌」時，新歌不在簿子上，動畫照常播一次。
  const animatedTracksRef = useRef(new Set())
  const currentId = selectedTrack?.id
  const lyricsReady = !effectiveLoading && lyricsForTrackId === currentId && Boolean(lyricsData)
  const shouldAnimateLyrics = lyricsReady && currentId != null && !animatedTracksRef.current.has(currentId)
  useEffect(() => {
    // 歌詞上畫後「等動畫播完」再記進點名簿（不是立刻記）。
    // 為什麼要等？因為一記進去，shouldAnimateLyrics 立刻變 false，緊接著任何一次
    // re-render（例如歌詞來源徽章 lyricsSource 更新）就會把 ai-stagger class 從還在
    // 動畫中的元素上拔掉，連「第一次」的進場動畫都被砍斷。
    // 等 1.5s（> 動畫總長 0.45s + 最後一行 0.69s 延遲）讓首播完整跑完，
    // 之後那個罕見的父層 remount（如 /api/review 晚幾秒落地）才會讀到 false → 不重播。
    if (lyricsReady && currentId != null && !animatedTracksRef.current.has(currentId)) {
      const timer = setTimeout(() => {
        animatedTracksRef.current.add(currentId)
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [lyricsReady, currentId])

  return {
    lyricsData: isStale ? '' : lyricsData,
    lrcData: isStale ? null : lrcData,
    lyricsSource,
    rawLoading: effectiveLoading,
    isTranslated,
    isTranslating,
    shouldAnimateLyrics,
    handleFetchLyrics,
    handleTranslate,
    handleRedownloadRaw,
    handleClearCache
  }
}
