import { useState, useEffect, useRef } from 'react'
import { Disc3, Music, Sparkles, Share2, Download, AlertCircle, Info, Calendar, Layers, ExternalLink } from 'lucide-react'
import html2canvas from 'html2canvas'
import ShareCard from './components/ShareCard'

function App() {
  const [albums, setAlbums] = useState([])
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  const [lyricsData, setLyricsData] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isExporting, setIsExporting] = useState(false)
  // 儲存預先產生的圖卡檔案，以利 iOS Safari 進行同步分享
  const [shareFile, setShareFile] = useState(null)
  
  const shareCardRef = useRef(null)

  useEffect(() => {
    fetch('/api/albums')
      .then(res => res.json())
      .then(data => setAlbums(data))
      .catch(err => console.error("Failed to fetch albums", err))
  }, [])

  // 當選取專輯或歌詞更新時，在背景非同步預先產生圖卡檔案
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
  }, [selectedAlbum, lyricsData])

  // 背景預先產生圖片檔以解決 Safari 必須同步呼叫 navigator.share 的安全限制
  const generateShareFile = async () => {
    if (!shareCardRef.current || !selectedAlbum) return
    try {
      const canvas = await html2canvas(shareCardRef.current, {
        scale: 2,
        backgroundColor: '#121212',
        useCORS: true
      })
      const image = canvas.toDataURL("image/png")
      const response = await fetch(image)
      const blob = await response.blob()
      const file = new File([blob], `share-${selectedAlbum.name}.png`, { type: 'image/png' })
      setShareFile(file)
    } catch (err) {
      console.error("Failed to pre-generate share file", err)
    }
  }

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

  const exportShareCard = async () => {
    if (!selectedAlbum) return

    // 如果預先產生的檔案已經在背景準備妥當，則「完全同步」呼叫 Web Share API 繞過 Safari 的 transient user activation 限制
    if (shareFile) {
      try {
        if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
          await navigator.share({
            files: [shareFile],
            title: `分享《${selectedAlbum.name}》`,
            text: `推薦這首好歌！這是來自 ${selectedAlbum.artistName || '未知藝人'} 的作品。`
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
      {/* Sidebar */}
      {/* 行動端與電腦端響應式切換：當選取專輯時，在行動端隱藏側邊欄 */}
      <aside className={`w-full lg:w-80 bg-black flex flex-col border-r border-white/5 z-10 ${selectedAlbum ? 'hidden lg:flex' : 'flex'}`}>
        <div className="p-6 flex items-center gap-3 border-b border-white/5">
          <div className="w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(29,185,84,0.4)]">
            <Music className="text-black" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Music Release</h1>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 px-2">Latest Releases</h2>
          {albums.length === 0 && <p className="text-sm text-gray-500 px-2">Loading albums...</p>}
          {albums.map((album, idx) => (
            <button 
              key={idx}
              onClick={() => handleSelectAlbum(album)}
              // 根據專輯是否被選中來決定按鈕的背景顏色與陰影樣式
              className={`w-full text-left p-3 rounded-xl transition-all duration-300 flex gap-4 items-center group ${selectedAlbum?.id === album.id ? 'bg-white/10 shadow-lg' : 'hover:bg-white/5'}`}
            >
              <img src={album.image} alt="cover" className="w-12 h-12 rounded-md object-cover shadow-md group-hover:scale-105 transition-transform" />
              <div className="flex-1 overflow-hidden">
                <h3 className="font-semibold text-sm truncate text-gray-100 group-hover:text-white">{album.name}</h3>
                <p className="text-xs text-gray-400 truncate mt-1">{album.release_date}</p>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* Main Content */}
      {/* 行動端與電腦端響應式切換：當未選取專輯時，在行動端隱藏主要內容區 */}
      <main className={`flex-1 relative flex flex-col bg-gradient-to-b from-[#1e1e1e] to-spotify-dark ${selectedAlbum ? 'flex' : 'hidden lg:flex'}`}>
        {selectedAlbum ? (
          <>
            {/* Header Banner (支援手機直式佈局與置中對齊) */}
            <div className="min-h-[256px] lg:h-64 p-6 lg:p-8 flex flex-col lg:flex-row items-center lg:items-end gap-6 relative overflow-hidden text-center lg:text-left pt-20 lg:pt-8">
              {/* 手機版返回按鈕 (lg 時隱藏) */}
              <button 
                onClick={() => setSelectedAlbum(null)}
                className="absolute top-6 left-6 z-20 lg:hidden bg-black/60 hover:bg-black/80 hover:scale-105 active:scale-95 transition-all px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1 border border-white/10 shadow-lg animate-fade-in"
              >
                ← 返回列表
              </button>

              <div className="absolute inset-0 opacity-20 pointer-events-none">
                 <img src={selectedAlbum.image} alt="blur" className="w-full h-full object-cover blur-3xl scale-150" />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-spotify-dark via-spotify-dark/60 to-transparent"></div>
              
              <img src={selectedAlbum.image} alt="cover" className="w-36 h-36 lg:w-48 lg:h-48 rounded-xl shadow-2xl z-10 border border-white/10 object-cover" />
              <div className="z-10 pb-2 flex flex-col items-center lg:items-start">
                <p className="text-xs lg:text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
                  <Disc3 size={16} className="text-spotify-green" /> 
                  {selectedAlbum.type === 'album' ? 'Album' : 'Single'}
                </p>
                <h1 className="text-3xl lg:text-5xl font-black mb-2 tracking-tight drop-shadow-md">{selectedAlbum.name}</h1>
                <p className="text-lg lg:text-xl font-bold text-spotify-green mb-3 lg:mb-4">{selectedAlbum.artistName || '未知藝人'}</p>
                <p className="text-xs lg:text-sm text-gray-300 font-medium">Released • {selectedAlbum.release_date} • {selectedAlbum.total_tracks}首歌曲</p>
              </div>
            </div>

            {/* AI Panel & Local Metadata (調整手機內邊距) */}
            <div className="flex-1 overflow-y-auto p-4 lg:p-8 lg:pt-4">
              <div className="max-w-6xl flex flex-col lg:flex-row gap-6">
                
                {/* Left Column: Local Metadata & Intro */}
                <div className="w-full lg:w-1/3 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col justify-between">
                  <div>
                    <h2 className="text-xl font-bold flex items-center gap-2 text-spotify-green mb-6 border-b border-white/10 pb-4">
                      <Info size={20} /> 本地資料庫簡介
                    </h2>
                    
                    <div className="space-y-4 text-sm text-gray-300">
                      <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                        <Calendar size={18} className="text-spotify-green" />
                        <div>
                          <p className="text-xs text-gray-400">發行日期</p>
                          <p className="font-semibold">{selectedAlbum.release_date}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl">
                        <Layers size={18} className="text-spotify-green" />
                        <div>
                          <p className="text-xs text-gray-400">曲目總數</p>
                          <p className="font-semibold">{selectedAlbum.total_tracks} 首歌曲</p>
                        </div>
                      </div>

                      <div className="bg-white/5 p-4 rounded-xl space-y-2">
                        <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">作品介紹</p>
                        <p className="leading-relaxed text-gray-200">
                          此發行作品由藝人 <strong className="text-spotify-green">{selectedAlbum.artistName || '未知藝人'}</strong> 創作，類型為 <strong className="text-white">{selectedAlbum.type === 'album' ? '專輯 (Album)' : '單曲 (Single)'}</strong>，共收錄 {selectedAlbum.total_tracks} 首曲目。這張作品於 {selectedAlbum.release_date} 正式發行，已成功自 Spotify 同步至我們的本地快取資料庫。
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-white/10">
                    <a 
                      href={selectedAlbum.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="w-full bg-white/10 hover:bg-white/20 transition-all text-white px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 shadow-md"
                    >
                      <ExternalLink size={16} />
                      在 Spotify 上聆聽
                    </a>
                  </div>
                </div>

                {/* Right Column: AI Lyrics Section */}
                <div className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-xl shadow-xl flex flex-col">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-white/10 pb-4">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-spotify-green">
                      <Sparkles size={20} /> AI 雙語歌詞翻譯與賞析
                    </h2>
                    
                    {/* 匯出按鈕隨時可用 (僅在匯出或 AI 讀取中 disable) */}
                    <button 
                      onClick={exportShareCard}
                      disabled={isExporting || isLoading}
                      className="bg-white text-black hover:bg-spotify-green hover:scale-105 transition-all px-4 py-2 rounded-full font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
                    >
                      {isExporting ? <AlertCircle size={16} className="animate-spin" /> : <Download size={16} />}
                      匯出 IG/TikTok 限動卡
                    </button>
                  </div>

                  <div className="flex-1 flex flex-col justify-center">
                    {isLoading ? (
                      <div className="py-20 flex flex-col items-center justify-center text-gray-400 space-y-4">
                        <div className="w-10 h-10 border-4 border-spotify-green border-t-transparent rounded-full animate-spin"></div>
                        <p className="animate-pulse font-medium text-center">Gemini AI 正在編寫精美的雙語歌詞與樂評...</p>
                      </div>
                    ) : lyricsData ? (
                      <div className="prose prose-invert max-w-none prose-p:leading-relaxed prose-h3:text-spotify-green prose-h3:mt-8 prose-h3:mb-4 overflow-y-auto max-h-[400px] pr-2">
                        <div dangerouslySetInnerHTML={{ __html: lyricsData.replace(/\n/g, '<br/>') }} />
                      </div>
                    ) : (
                      <div className="py-16 flex flex-col items-center justify-center text-center space-y-6">
                        <Sparkles size={48} className="text-gray-500 opacity-40 animate-pulse" />
                        <div className="space-y-2">
                          <h3 className="text-lg font-bold text-gray-300">尚未產生 AI 歌詞</h3>
                          <p className="text-sm text-gray-500 max-w-md">
                            目前僅載入本地庫中存儲的專輯資訊。您可以隨時匯出純淨版限動卡，或者點擊下方按鈕啟動 AI 深入解析這首歌的歌詞意境。
                          </p>
                        </div>
                        <button 
                          onClick={handleFetchLyrics}
                          className="bg-spotify-green text-black hover:scale-105 transition-all px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 shadow-lg shadow-spotify-green/20"
                        >
                          <Sparkles size={16} />
                          尋找歌詞與 AI 翻譯
                        </button>
                      </div>
                    )}
                  </div>
                </div>

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

      {/* Hidden Offscreen ShareCard for html2canvas to render */}
      <div className="fixed -left-[9999px] -top-[9999px]">
         <ShareCard 
            ref={shareCardRef} 
            album={selectedAlbum} 
            artistName={selectedAlbum?.artistName || 'Featured Artist'} 
            lyrics={lyricsData} 
         />
      </div>
    </div>
  )
}

export default App
