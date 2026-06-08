import { useState, useEffect, useRef, useCallback } from 'react'
import { Music } from 'lucide-react'
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
  
  const shareCardRef = useRef(null)

  useEffect(() => {
    fetch('/api/albums')
      .then(res => res.json())
      .then(data => setAlbums(data))
      .catch(err => console.error("Failed to fetch albums", err))
  }, [])

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

  // 當選取專輯、歌詞或本地樂評更新時，在背景非同步預先產生圖卡檔案
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
  }, [selectedAlbum, lyricsData, albumReview, generateShareFile])

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
      const file = new File([blob], `share-${selectedAlbum.name}.png`, { type: 'image/png' })
      setShareFile(file)
    } catch (err) {
      console.error("Failed to pre-generate share file", err)
    }
  }, [selectedAlbum])

  // 僅選取專輯並重設歌詞與載入狀態，不自動執行 AI 歌詞搜尋
  const handleSelectAlbum = (album) => {
    setSelectedAlbum(album)
    setLyricsData('')
    setIsLoading(false)
  }

  // 手動觸發 AI 歌詞搜尋與翻譯
  const handleFetchLyrics = async () => {
    if (!selectedAlbum) return
    setIsLoading(true)
    setLyricsData('')
    
    try {
      const res = await fetch('/api/lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          artistName: selectedAlbum.artistName || 'Unknown Artist', 
          trackName: selectedAlbum.name 
        })
      })
      const result = await res.json()
      if (result.text) {
        setLyricsData(result.text)
      } else {
        setLyricsData("無法取得歌詞翻譯。")
      }
    } catch (err) {
      setLyricsData("翻譯過程發生錯誤。")
    } finally {
      setIsLoading(false)
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
              setSelectedAlbum={setSelectedAlbum}
            />

            {/* AI 面板與本地元數據 */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8 lg:pt-4">
              <div className="max-w-6xl flex flex-col lg:flex-row gap-6">
                
                {/* 專輯與系統診斷資訊面板 */}
                <MetadataPanel 
                  selectedAlbum={selectedAlbum}
                  albumReview={albumReview}
                  shareFile={shareFile}
                />

                {/* AI 雙語歌詞與圖卡導出面板 */}
                <AILyricsPanel 
                  selectedAlbum={selectedAlbum}
                  lyricsData={lyricsData}
                  isLoading={isLoading}
                  isExporting={isExporting}
                  handleFetchLyrics={handleFetchLyrics}
                  exportShareCard={exportShareCard}
                />

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
            artistName={selectedAlbum?.artistName || 'Featured Artist'} 
            lyrics={lyricsData} 
            introduction={albumReview?.introduction}
         />
      </div>
    </div>
  )
}

export default App
