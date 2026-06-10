import { useState, useEffect, useRef, useCallback } from 'react'
import { Disc3, Music, Sparkles, Share2, Download, AlertCircle, Info, Calendar, Layers, ExternalLink, Send } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import html2canvas from 'html2canvas'
import ShareCard from './components/ShareCard'
import Sidebar from './components/Sidebar'
import HeaderBanner from './components/HeaderBanner'
import MetadataPanel from './components/MetadataPanel'
import AILyricsPanel from './components/AILyricsPanel'

function App() {
  const [albums, setAlbums] = useState([])
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [lyricsData, setLyricsData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  // 儲存預先產生的圖卡檔案，以利 iOS Safari 進行同步分享
  const [shareFile, setShareFile] = useState(null)
  // 儲存本地 AI 樂評之介紹與總結
  const [albumReview, setAlbumReview] = useState({ introduction: '', summary: '' })
  
  // 專輯曲目與單曲 AI 分析狀態
  const [tracks, setTracks] = useState([])
  const [selectedTrack, setSelectedTrack] = useState(null)
  const [tracksLoading, setTracksLoading] = useState(false)
  const [analysisData, setAnalysisData] = useState('')
  const [analysisLoading, setAnalysisLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('lyrics') // 'lyrics' | 'analysis'
  
  const shareCardRef = useRef(null)
  // 隨時追蹤當前選中的單曲，以防異步請求結束時選取已改變
  const selectedTrackRef = useRef(selectedTrack)
  useEffect(() => {
    selectedTrackRef.current = selectedTrack
  }, [selectedTrack])

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

  // 當選取專輯時，自後端 API 取得專輯歌曲清單 (動態隨選載入)
  // 【小朋友解釋法】：
  // 當快速切換專輯時，舊的送貨員（舊的異步請求）可能會比較慢把歌單送來，不小心蓋掉最新點的歌單。
  // 我們加一個「有效標記」(active)。每當切換專輯時，就把上一次的標記設成失效 (false)；
  // 這樣就算舊的歌單送到了，我們也會因為它失效而直接丟掉，只留最新點的歌單！
  useEffect(() => {
    let active = true
    if (selectedAlbum) {
      setTracks([])
      setSelectedTrack(null)
      setLyricsData('')
      setAnalysisData('')
      setTracksLoading(true)
      fetch(`/api/albums/${selectedAlbum.id}/tracks`)
        .then(res => res.json())
        .then(data => {
          if (!active) return
          if (Array.isArray(data)) {
            setTracks(data)
          } else {
            setTracks([])
          }
        })
        .catch(err => {
          if (active) console.error("Failed to fetch album tracks", err)
        })
        .finally(() => {
          if (active) setTracksLoading(false)
        })
    } else {
      setTracks([])
      setSelectedTrack(null)
      setLyricsData('')
      setAnalysisData('')
    }
    return () => {
      active = false
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

  // 當選取單曲改變時，重設歌詞與分析狀態以防顯示舊單曲的資料
  // 【小朋友解釋法】：
  // 當換歌曲時，為了不讓螢幕上還殘留著上一首歌的歌詞或分析，
  // 我們一感應到換歌，就立刻「擦黑板」把舊內容擦乾淨，讓畫面呈現空白等待新內容！
  useEffect(() => {
    setLyricsData('')
    setAnalysisData('')
    setPublishResult(null) // 切換歌曲時一併重設社群發佈狀態
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
  }, [selectedAlbum, selectedTrack, lyricsData, analysisData, albumReview, activeTab, generateShareFile])

  // 僅選取專輯並重設歌詞與載入狀態，使用 react-router 的 navigate 進行 URL 轉換
  const handleSelectAlbum = (album) => {
    if (album) {
      navigate(`/album/${album.id}`)
    } else {
      navigate('/')
    }
    setLyricsData('')
    setIsLoading(false)
  }

// 手動觸發 AI 歌詞搜尋與翻譯 (綁定選中的單曲)
  // 【小朋友解釋法】：
  // 當我們去搜尋並翻譯歌詞時，如果翻譯期間使用者換了歌，
  // 歌詞送來後就會不小心蓋掉新歌的歌詞！
  // 所以我們在開始時用小紙條記下歌曲編號 (trackIdAtStart)，
  // 翻譯送達後比對「監視器」(selectedTrackRef) 是否還是同一首，一樣才更新畫面！
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
        if (result.text) {
          setLyricsData(result.text)
        } else {
          setLyricsData("無法取得歌詞翻譯。")
        }
      }
    } catch (err) {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setLyricsData("翻譯過程發生錯誤。")
      }
    } finally {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setIsLoading(false)
      }
    }
  }

  // 手動觸發單曲 AI 賞析與分析
  // 【小朋友解釋法】：
  // 當我們叫倉庫（API）去寫某一首歌的分析時，如果寫報告期間使用者換了歌，
  // 報告送來後就會不小心蓋掉新歌的分析內容！
  // 所以我們要在開始時拿小紙條記下開始時的歌曲編號 (trackIdAtStart)，
  // 報告送達後看一下「監視器」(selectedTrackRef) 當前顯示的歌是不是同一首，一模一樣才更新畫面！
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
        if (result.text) {
          setAnalysisData(result.text)
        } else {
          setAnalysisData("無法取得歌曲分析。")
        }
      }
    } catch (err) {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setAnalysisData("分析過程發生錯誤。")
      }
    } finally {
      if (selectedTrackRef.current?.id === trackIdAtStart) {
        setAnalysisLoading(false)
      }
    }
  }

  // 原生分享與導出控制
  const exportShareCard = async () => {
    if (!selectedAlbum) return

    // 如果預先產生的檔案已經在背景準備妥當，則「完全同步」呼叫 Web Share API 繞過 Safari 的 transient user activation 限制
    if (shareFile) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
          await navigator.share({
            files: [shareFile],
            title: `分享《${selectedAlbum.name}》`,
            // 優先使用本地 AI 樂評之精選總結或介紹作為分享推薦文案
            text: albumReview?.summary || albumReview?.introduction || `推薦這首好歌！這是來自 ${selectedAlbum.artistName || '未知藝人'} 的作品。`
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
      
      if (!navigator.canShare) {
        alert("圖卡已成功下載！由於您使用的是電腦，請手動將下載的圖片上傳至 Instagram/TikTok 限時動態分享。")
      }
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
            {/* Header Banner 頂部專輯資訊橫幅 */}
            <HeaderBanner 
              selectedAlbum={selectedAlbum}
              setSelectedAlbum={() => handleSelectAlbum(null)}
            />

            {/* AI 面板與本地元數據 */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8 lg:pt-4">
              <div className="max-w-6xl flex flex-col lg:flex-row gap-6">
                
                {/* 專輯、曲目列表與系統診斷資訊面板 */}
                <MetadataPanel 
                  selectedAlbum={selectedAlbum}
                  albumReview={albumReview}
                  shareFile={shareFile}
                  tracks={tracks}
                  selectedTrack={selectedTrack}
                  setSelectedTrack={setSelectedTrack}
                  tracksLoading={tracksLoading}
                />

                {/* 當有選中歌曲時，顯示 AI 雙語歌詞與圖卡導出面板；否則顯示導引選擇歌曲的精緻佔位卡 */}
                {selectedTrack ? (
                  <AILyricsPanel 
                    selectedAlbum={selectedAlbum}
                    selectedTrack={selectedTrack}
                    lyricsData={lyricsData}
                    isLoading={isLoading}
                    isExporting={isExporting}
                    isPublishing={isPublishing}
                    publishResult={publishResult}
                    handleFetchLyrics={handleFetchLyrics}
                    exportShareCard={exportShareCard}
                    analysisData={analysisData}
                    analysisLoading={analysisLoading}
                    handleAnalyzeTrack={handleAnalyzeTrack}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    handlePublishToSocial={handlePublishToSocial}
                  />
                ) : (
                  <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center text-center min-h-[400px] hover:border-white/20 transition-all duration-300">
                    <div className="w-16 h-16 rounded-full bg-spotify-green/10 flex items-center justify-center mb-6 text-spotify-green animate-pulse">
                      <Music size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">探索單曲的 AI 靈魂</h3>
                    <p className="text-xs text-gray-400 max-w-sm leading-relaxed mb-6">
                      請從左側曲目清單中點選任何一首歌曲。AI 將即時為您尋找原文歌詞、編寫優雅的雙語翻譯，並提供深度的音樂風格與意境剖析。
                    </p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 bg-white/5 px-3 py-1.5 rounded-full font-mono">
                      <Sparkles size={12} className="text-spotify-green" />
                      <span>Gemini 1.5 Pro AI Engine Active</span>
                    </div>
                  </div>
                )}

              </div>
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
            lyrics={activeTab === 'lyrics' ? lyricsData : analysisData} 
            introduction={albumReview?.introduction}
         />
      </div>
    </div>
  )
}

export default App
