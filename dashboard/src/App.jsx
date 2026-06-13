import { useState, useEffect, useRef, useCallback } from 'react'
import { Music } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import HeaderBanner from './components/HeaderBanner'
import AlbumPanel from './components/AlbumPanel'
import SongPage from './components/SongPage'
import { useAlbumTracks } from './hooks/useAlbumTracks'
import { useSpotifyPlayer } from './hooks/useSpotifyPlayer'
import { useTrackAi } from './hooks/useTrackAi'
import { useTrackKeyboardNav } from './hooks/useTrackKeyboardNav'
import SpotifyPlayer from './components/SpotifyPlayer'

// 【小朋友解釋法】：
// App.jsx 以前是「什麼家具都堆在裡面的大客廳」。
// 現在歌單送貨員（useAlbumTracks）、AI 翻譯員（useTrackAi）
// 和單曲房間的管家（SongPage）都搬進自己的房間，
// 客廳只負責：路由同步、專輯選取、分享圖卡、社群發文。
function App() {
  const [albums, setAlbums] = useState([])
  const [selectedAlbum, setSelectedAlbum] = useState(null)
  // 儲存本地 AI 樂評之介紹與總結
  const [albumReview, setAlbumReview] = useState({ introduction: '', summary: '' })

  const [selectedTrack, setSelectedTrack] = useState(null)

  // 專輯曲目清單（三態：loading / error / data）
  const { tracks, tracksLoading, tracksError, retryTracks } = useAlbumTracks(selectedAlbum)

  // 單曲 AI 歌詞翻譯與賞析（含防舊蓋新與換歌擦黑板）
  const {
    lyricsData,
    lrcData,
    lyricsSource,
    rawLoading,
    isTranslated,
    isTranslating,
    shouldAnimateLyrics,
    handleFetchLyrics,
    handleTranslate,
    handleRedownloadRaw,
    handleClearCache
  } = useTrackAi(selectedAlbum, selectedTrack)

  const navigate = useNavigate()
  const { albumId, trackId } = useParams()

  // 鍵盤導航：j/↓ 下一首、k/↑ 上一首（打字時自動停用）
  useTrackKeyboardNav({ selectedAlbum, tracks, selectedTrack })

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

  // Web Playback SDK 播放器狀態與控制，提升到 App 層讓 SongPanel 也能取得進度來做 KTV 同步
  const playerControls = useSpotifyPlayer()

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

  // 當選取的歌曲或專輯改變時，通知播放器播放
  // (2026-06-13) 用戶要求取消自動播放，改為手動點擊 Spotify 的 Play 按鈕
  useEffect(() => {
    /*
    if (playerControls.isReady) {
      if (selectedTrack) {
        playerControls.playUri(`spotify:track:${selectedTrack.id}`)
      } else if (selectedAlbum) {
        playerControls.playUri(`spotify:album:${selectedAlbum.id}`)
      }
    }
    */
  }, [selectedTrack, selectedAlbum, playerControls.isReady, playerControls.playUri])

  // 僅選取專輯，使用 react-router 的 navigate 進行 URL 轉換
  // （歌詞與載入狀態的重設由 useTrackAi 的「換歌擦黑板」機制處理）
  const handleSelectAlbum = (album) => {
    if (album) {
      navigate(`/album/${album.id}`)
    } else {
      navigate('/')
    }
  }

  // Simple hash to generate a consistent hue for each album
  const getAlbumHue = (id) => {
    if (!id) return 150;
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % 360;
  }
  const albumHue = selectedAlbum ? getAlbumHue(selectedAlbum.id) : 200;

  return (
    <div className="flex h-screen bg-spotify-dark text-white overflow-hidden font-sans selection:bg-spotify-green selection:text-black">
      {/* Sidebar 側邊欄 */}
      <Sidebar 
        albums={albums}
        selectedAlbum={selectedAlbum}
        handleSelectAlbum={handleSelectAlbum}
      />

      {/* Main Content 主內容區 */}
      <main className={`flex-1 relative flex flex-col bg-transparent z-0 overflow-hidden transition-colors duration-1000 ${selectedAlbum ? 'flex' : 'hidden lg:flex'}`}>
        {/* ✨ Ambient Background Orbs */}
        <div className="absolute inset-0 pointer-events-none transition-all duration-1000 z-[-1] overflow-hidden">
          <div 
            className="absolute top-[-20%] left-[-10%] w-[60%] h-[70%] rounded-full mix-blend-screen filter blur-[120px] opacity-40 animate-ambient-pulse transition-colors duration-1000"
            style={{ backgroundColor: `hsl(${albumHue}, 70%, 40%)` }}
          />
          <div 
            className="absolute top-[30%] right-[-10%] w-[50%] h-[60%] rounded-full mix-blend-screen filter blur-[140px] opacity-30 animate-ambient-pulse transition-colors duration-1000"
            style={{ backgroundColor: `hsl(${(albumHue + 50) % 360}, 80%, 30%)`, animationDelay: '3s' }}
          />
        </div>

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
                    lrcData={lrcData}
                    playerControls={playerControls}
                    lyricsSource={lyricsSource}
                    rawLoading={rawLoading}
                    shouldAnimateLyrics={shouldAnimateLyrics}
                    isTranslated={isTranslated}
                    isTranslating={isTranslating}
                    albumReview={albumReview}
                    handleFetchLyrics={handleFetchLyrics}
                    handleTranslate={handleTranslate}
                    handleRedownloadRaw={handleRedownloadRaw}
                    handleClearCache={handleClearCache}
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
                  onPlayTrack={playerControls.playUri}
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

      {/* 懸浮式 Spotify Web Playback SDK 播放器：手動播放控制，顯示備用元資料 */}
      {(selectedTrack || selectedAlbum) && (
        <SpotifyPlayer
          uri={selectedTrack ? `spotify:track:${selectedTrack.id}` : `spotify:album:${selectedAlbum.id}`}
          fallbackTrackName={selectedTrack?.name}
          fallbackArtistName={selectedTrack?.artists?.map(a => a.name).join(', ') ?? selectedAlbum?.artistName}
          playerControls={playerControls}
        />
      )}
    </div>
  )
}

export default App
