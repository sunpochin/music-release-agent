import { useState, useEffect, useRef, useCallback } from 'react'
import { Music } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import html2canvas from 'html2canvas'
import ShareCard from './components/ShareCard'
import Sidebar from './components/Sidebar'
import HeaderBanner from './components/HeaderBanner'
import AlbumPanel from './components/AlbumPanel'
import SongPage from './components/SongPage'
import { useAlbumTracks } from './hooks/useAlbumTracks'
import { useTrackAi } from './hooks/useTrackAi'
import { useTrackKeyboardNav } from './hooks/useTrackKeyboardNav'

// 【小朋友解釋法】：
// App.jsx 以前是「什麼家具都堆在裡面的大客廳」。
// 現在歌單送貨員（useAlbumTracks）、AI 翻譯員（useTrackAi）
// 和單曲房間的管家（SongPage）都搬進自己的房間，
// 客廳只負責：路由同步、專輯選取、分享圖卡、社群發文。
function App() {
  const [albums, setAlbums] = useState([])
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [isExporting, setIsExporting] = useState(false)
  // 儲存預先產生的圖卡檔案，以利 iOS Safari 進行同步分享
  const [shareFile, setShareFile] = useState(null)
  // 儲存本地 AI 樂評之介紹與總結
  const [albumReview, setAlbumReview] = useState({ introduction: '', summary: '' })

  const [selectedTrack, setSelectedTrack] = useState(null)

  const shareCardRef = useRef(null)

  // 專輯曲目清單（三態：loading / error / data）
  const { tracks, tracksLoading, tracksError, retryTracks } = useAlbumTracks(selectedAlbum)

  // 單曲 AI 歌詞翻譯與賞析（含防舊蓋新與換歌擦黑板）
  const {
    lyricsData,
    lyricsSource,
    rawLoading,
    isTranslated,
    isTranslating,
    handleFetchLyrics,
    handleTranslate,
    handleRedownloadRaw,
    handleClearCache
  } = useTrackAi(selectedAlbum, selectedTrack)

  // 鍵盤導航：j/↓ 下一首、k/↑ 上一首（打字時自動停用）
  useTrackKeyboardNav({ selectedAlbum, tracks, selectedTrack })

  // 社群自動發文狀態
  const [isPublishing, setIsPublishing] = useState(false)
  const [publishResult, setPublishResult] = useState(null)

  const navigate = useNavigate()
  const { albumId, trackId } = useParams()

  useEffect(() => {
    fetch('/api/albums')
      .then(res => res.json())
      .then(data => setAlbums(data))
      .catch(err => console.error("Failed to fetch albums", err))
  }, [])

  // 根據 URL 中的 albumId 參數同步選取的專輯狀態
  useEffect(() => {
    if (albums.length > 0) {
      if (albumId) {
        const matchedAlbum = albums.find(a => a.id === albumId)
        if (matchedAlbum) {
          setSelectedAlbum(matchedAlbum)
        } else {
          // 如果找不到對應的專輯，重設為未選取狀態
          setSelectedAlbum(null)
        }
      } else {
        setSelectedAlbum(null)
      }
    }
  }, [albumId, albums])

  // 當選取專輯時，自後端 API 取得本地 AI 樂評的介紹與總結
  useEffect(() => {
    if (selectedAlbum) {
      setAlbumReview({ introduction: '', summary: '' }) // 先清空舊資料
      fetch(`/api/review?artistName=${encodeURIComponent(selectedAlbum.artistName || '')}&albumName=${encodeURIComponent(selectedAlbum.name || '')}`)
        .then(res => res.json())
        .then(data => setAlbumReview(data))
        .catch(err => console.error("Failed to fetch album review", err))
    } else {
      setAlbumReview({ introduction: '', summary: '' })
    }
  }, [selectedAlbum])

  // 根據 URL 中的 trackId 參數同步選取的單曲狀態
  // 【小朋友解釋法】：
  // 我們裝了一個「導航監聽器」(useEffect 監聽 trackId 與 tracks)。
  // 每當網址列的單曲 ID 改變，或是歌單剛好載入完成時，我們就從歌單中找到對應的歌，並把它設定為選中狀態！
  useEffect(() => {
    if (trackId && tracks.length > 0) {
      const matchedTrack = tracks.find(t => t.id === trackId)
      if (matchedTrack) {
        setSelectedTrack(matchedTrack)
      } else {
        setSelectedTrack(null)
      }
    } else if (!trackId) {
      setSelectedTrack(null)
    }
  }, [trackId, tracks])

  // 切換歌曲時重設社群發佈狀態（歌詞/分析的「擦黑板」已由 useTrackAi 處理）
  useEffect(() => {
    setPublishResult(null)
  }, [selectedTrack])

  // 背景預先產生圖片檔以解決 Safari 必須同步呼叫 navigator.share 的安全限制
  const generateShareFile = useCallback(async () => {
    if (!shareCardRef.current || !selectedAlbum) return
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        backgroundColor: '#121212',
        useCORS: true
      })
      // 優化：直接使用 HTML5 Canvas toBlob API，避免 Base64 序列化的記憶體與 CPU 開銷
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
      if (!blob) throw new Error('Canvas to Blob conversion failed')
      const file = new File([blob], `share-${selectedTrack ? selectedTrack.name : selectedAlbum.name}.png`, { type: 'image/png' })
      setShareFile(file)
    } catch (err) {
      console.error("Failed to pre-generate share file", err)
    }
  }, [selectedAlbum, selectedTrack])

  // 當選取專輯、歌曲、歌詞、歌曲分析或頁籤更新時，在背景非同步預先產生圖卡檔案
  useEffect(() => {
    if (selectedAlbum) {
      setShareFile(null) // 先清空舊檔案
      const timer = setTimeout(() => {
        generateShareFile()
      }, 600) // 延遲 600ms 確保 ShareCard DOM 已渲染完畢
      return () => clearTimeout(timer)
    } else {
      setShareFile(null)
    }
  }, [selectedAlbum, selectedTrack, lyricsData, albumReview, generateShareFile])

  // 僅選取專輯，使用 react-router 的 navigate 進行 URL 轉換
  // （歌詞與載入狀態的重設由 useTrackAi 的「換歌擦黑板」機制處理）
  const handleSelectAlbum = (album) => {
    if (album) {
      navigate(`/album/${album.id}`)
    } else {
      navigate('/')
    }
  }

  // 原生分享與導出控制
  const exportShareCard = async () => {
    if (!selectedAlbum) return

    const spotifyLink = selectedTrack?.url || `https://open.spotify.com/album/${selectedAlbum.id}`
    const shareText = `🎵 ${selectedTrack ? selectedTrack.name : selectedAlbum.name} - ${selectedAlbum.artistName || '未知藝人'}
${spotifyLink}

${lyricsData ? lyricsData.replace(/[#*_\-`]/g, '').trim() : (albumReview?.summary || '')}`

    // --- 完全同步的剪貼簿複製 (繞過 iOS 嚴格的非同步安全限制) ---
    const textArea = document.createElement("textarea")
    textArea.value = shareText
    textArea.style.position = "fixed"
    textArea.style.left = "-9999px"
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    try {
      document.execCommand('copy')
      // 提示使用者已成功複製，可以直接貼到 IG Reels
      setTimeout(() => alert("✅ 包含 Spotify 歌曲連結與翻譯歌詞的文案已為您複製到剪貼簿！\n\n您可以直接貼上到 Instagram Reels！"), 100);
    } catch (e) {
      console.warn("execCommand copy failed", e)
    }
    document.body.removeChild(textArea)

    // --- 自動背景發布到 Threads (僅發送單一發行連結以防字數超限) ---
    const releaseUrl = selectedTrack
      ? `https://release.sunpochin.xyz/album/${selectedAlbum.id}/song/${selectedTrack.id}`
      : `https://release.sunpochin.xyz/album/${selectedAlbum.id}`

    fetch('/api/social/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption: releaseUrl,
        platforms: ['threads'],
        imageBase64: null // 不包含圖片以節省字數與流量，僅分享純連結
      })
    }).catch(err => {
      console.error("Auto publish to Threads failed", err)
    })

    // --- 以下為圖卡匯出邏輯 ---
    // 如果預先產生的檔案已經在背景準備妥當，則「完全同步」呼叫 Web Share API
    if (shareFile) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
          await navigator.share({
            files: [shareFile],
            title: `分享《${selectedAlbum.name}》`,
            text: shareText
          })
          return // 成功分享直接返回
        }
      } catch (err) {
        if (err.name === 'AbortError') {
          // 使用者主動取消分享，直接忽略
          return
        }
        console.error("Native share failed, falling back to download", err)
      }
    }

    // 備用降級方案 (Fallback)：如果背景圖片還在產生中，或是電腦版不支援原生分享，則執行畫布編譯下載
    setIsExporting(true)
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        backgroundColor: '#121212',
        useCORS: true
      })
      const image = canvas.toDataURL("image/png")
      
      const link = document.createElement('a')
      link.href = image
      link.download = `share-${selectedAlbum.name || 'card'}.png`
      link.click()
    } catch (err) {
      console.error("Export failed", err)
      alert("匯出失敗，請稍後再試。")
    } finally {
      setIsExporting(false)
    }
  }

  // 自動發文到社群平台（Facebook / X / Threads）
  const handlePublishToSocial = async () => {
    if (!selectedAlbum || isPublishing) return
    setIsPublishing(true)
    setPublishResult(null)

    try {
      // 將 ShareCard 渲染為 base64 圖片
      let imageBase64 = null
      if (shareCardRef.current) {
        const canvas = await html2canvas(shareCardRef.current, {
          scale: 2,
          backgroundColor: '#121212',
          useCORS: true
        })
        imageBase64 = canvas.toDataURL('image/png')
      }

      // 組裝文案：優先使用 AI 樂評摘要
      const caption = albumReview?.summary
        || albumReview?.introduction
        || `🎵 新專輯推薦！來自 ${selectedAlbum.artistName || '未知藝人'} 的《${selectedAlbum.name}》\n\n#MusicRelease #NewMusic`

      const res = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caption,
          platforms: ['threads', 'facebook'],
          imageBase64
        })
      })

      const result = await res.json()

      if (res.ok) {
        setPublishResult({ success: true, jobId: result.jobId })
      } else {
        setPublishResult({ success: false, error: result.error })
      }
    } catch (err) {
      setPublishResult({ success: false, error: err.message })
    } finally {
      setIsPublishing(false)
    }
  }

  return (
    <div className="flex h-screen bg-spotify-dark text-white overflow-hidden font-sans selection:bg-spotify-green selection:text-black">
      {/* Sidebar 側邊欄 */}
      <Sidebar 
        albums={albums}
        selectedAlbum={selectedAlbum}
        handleSelectAlbum={handleSelectAlbum}
      />

      {/* Main Content 主內容區 */}
      <main className={`flex-1 relative flex flex-col bg-gradient-to-b from-[#1e1e1e] to-spotify-dark ${selectedAlbum ? 'flex' : 'hidden lg:flex'}`}>
        {selectedAlbum ? (
          <>
            {/* Header Banner 頂部專輯資訊橫幅（手機返回鍵：歌曲頁先回專輯頁，再回清單） */}
            <HeaderBanner
              selectedAlbum={selectedAlbum}
              selectedTrack={selectedTrack}
              backLabel={trackId ? '返回專輯' : '返回列表'}
              onBack={() => {
                if (trackId) {
                  navigate(`/album/${selectedAlbum.id}`)
                } else {
                  handleSelectAlbum(null)
                }
              }}
            />

            {/* 主內容：mobile-first 全螢幕專注模式
                - 專輯頁（未選歌）：AlbumPanel 全版顯示
                - 歌曲頁（已選歌）：SongPanel 獨佔全幅，底部「返回專輯資訊」可導回 */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8 lg:pt-4">
              {(trackId || selectedTrack) ? (
                <div className="max-w-3xl mx-auto">
                  {/* 歌曲頁：SongPanel 單欄全幅，不再與 AlbumPanel 並排 */}
                  <SongPage
                    trackId={trackId}
                    tracks={tracks}
                    tracksLoading={tracksLoading}
                    tracksError={tracksError}
                    retryTracks={retryTracks}
                    selectedAlbum={selectedAlbum}
                    selectedTrack={selectedTrack}
                    lyricsData={lyricsData}
                    lyricsSource={lyricsSource}
                    rawLoading={rawLoading}
                    isTranslated={isTranslated}
                    isTranslating={isTranslating}
                    isExporting={isExporting}
                    isPublishing={isPublishing}
                    publishResult={publishResult}
                    handleFetchLyrics={handleFetchLyrics}
                    handleTranslate={handleTranslate}
                    handleRedownloadRaw={handleRedownloadRaw}
                    handleClearCache={handleClearCache}
                    exportShareCard={exportShareCard}
                    handlePublishToSocial={handlePublishToSocial}
                    onBackToAlbum={() => navigate(`/album/${selectedAlbum.id}`)}
                  />
                </div>
              ) : (
                <AlbumPanel
                  variant="full"
                  selectedAlbum={selectedAlbum}
                  albumReview={albumReview}
                  tracks={tracks}
                  selectedTrack={selectedTrack}
                  tracksLoading={tracksLoading}
                  tracksError={tracksError}
                  retryTracks={retryTracks}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <Music size={64} className="mb-6 opacity-20" />
            <h2 className="text-2xl font-bold text-gray-400">請從左側選擇一張最新專輯</h2>
            <p className="mt-2 text-sm">AI 將為您生成雙語翻譯並製作社群分享卡</p>
          </div>
        )}
      </main>

      {/* 隱藏的 offscreen ShareCard 用於渲染導出圖片 */}
      <div className="fixed -left-[9999px] -top-[9999px]">
         <ShareCard 
            ref={shareCardRef} 
            album={selectedAlbum} 
            track={selectedTrack}
            artistName={selectedAlbum?.artistName || 'Featured Artist'} 
            lyrics={lyricsData} 
            introduction={albumReview?.introduction}
         />
      </div>
    </div>
  )
}

export default App
