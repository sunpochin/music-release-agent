import { AlertCircle, RotateCw, Music4 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import SongPanel from './SongPanel'

/**
 * 🎤 SongPage — 單曲頁容器（三態 + 404 的決策中心）
 *
 * 【小朋友解釋法】：
 * 以前單曲頁是「大客廳的一個角落」，現在它有自己的房間，
 * 而且門口有一位管家依序檢查四件事：
 * 1. 送貨員摔倒了嗎？（tracksError）→ 給「再試一次」的門鈴，不是一片空白
 * 2. 歌單還在路上嗎？（tracksLoading）→ 掛「整理中」的骨架屏，預告內容的形狀
 * 3. 客人拿的門票是不是過期的？（trackId 有值但歌單裡找不到）→
 *    友善地說「這首歌不在這張專輯裡」，並推薦同專輯其他歌，舊連結永遠不會死
 * 4. 都沒問題 → 請進，AI 歌詞面板上菜
 */

/** 骨架屏：載入時預告內容形狀，避免畫面跳動 */
const SongPageSkeleton = () => (
  <div
    data-testid="song-page-skeleton"
    className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-xl min-h-[400px] animate-pulse"
    aria-busy="true"
    aria-label="歌曲內容載入中"
  >
    <div className="h-6 w-2/5 bg-white/10 rounded-lg mb-6" />
    <div className="h-4 w-1/4 bg-white/10 rounded-lg mb-8" />
    <div className="space-y-3">
      <div className="h-3 w-full bg-white/10 rounded" />
      <div className="h-3 w-5/6 bg-white/10 rounded" />
      <div className="h-3 w-4/6 bg-white/10 rounded" />
    </div>
    <div className="h-10 w-40 bg-white/10 rounded-xl mt-10" />
  </div>
)

/** 載入失敗：給出原因與重試按鈕，而不是默默顯示「無曲目資料」 */
const TracksError = ({ error, onRetry }) => (
  <div className="flex-1 bg-white/5 border border-red-400/20 rounded-2xl p-8 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center text-center min-h-[400px]">
    <div className="w-16 h-16 rounded-full bg-red-400/10 flex items-center justify-center mb-4 text-red-400">
      <AlertCircle size={32} />
    </div>
    <h3 className="text-base font-bold text-white mb-2">曲目清單載入失敗</h3>
    <p className="text-xs text-gray-400 mb-6 font-mono">{error}</p>
    <button
      onClick={onRetry}
      className="bg-spotify-green hover:bg-spotify-green/80 transition-all text-black px-5 py-2.5 rounded-xl font-bold text-sm flex items-center gap-2"
    >
      <RotateCw size={16} /> 再試一次
    </button>
  </div>
)

const TrackNotFound = ({ albumId, tracks, playerControls }) => {
  const navigate = useNavigate()
  return (
    <div
      data-testid="track-not-found"
      className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-xl shadow-xl flex flex-col items-center justify-center text-center min-h-[400px]"
    >
      <div className="w-16 h-16 rounded-full bg-yellow-400/10 flex items-center justify-center mb-4 text-yellow-400">
        <Music4 size={32} />
      </div>
      <h3 className="text-base font-bold text-white mb-2">找不到這首歌</h3>
      <p className="text-xs text-gray-400 max-w-sm leading-relaxed mb-6">
        這個連結指向的歌曲不在這張專輯裡（可能已下架或連結有誤）。
        試試同專輯的其他曲目：
      </p>
      <div className="w-full max-w-xs space-y-2">
        {tracks.slice(0, 5).map((track) => (
          <button
            key={track.id}
            onClick={() => {
              navigate(`/album/${albumId}/song/${track.id}`);
              playerControls?.playUri?.(`spotify:track:${track.id}`);
            }}
            className="w-full text-left px-4 py-2.5 rounded-xl bg-white/5 hover:bg-spotify-green/20 transition-all text-xs text-gray-300 hover:text-white flex items-center gap-2"
          >
            <span className="text-spotify-green font-mono w-4 text-center">{track.track_number}</span>
            <span className="truncate">{track.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

const SongPage = ({
  trackId,
  tracks,
  tracksLoading,
  tracksError,
  retryTracks,
  ...panelProps
}) => {
  // 1. 送貨員摔倒 → 錯誤卡 + 重試
  if (tracksError) {
    return <TracksError error={tracksError} onRetry={retryTracks} />
  }

  // 2. 歌單還在路上 → 骨架屏
  if (tracksLoading) {
    return <SongPageSkeleton />
  }

  // 3. 門票過期：URL 有 trackId、歌單已載入、但找不到對應的歌 → 友善 404
  if (trackId && !panelProps.selectedTrack && tracks.length > 0) {
    return <TrackNotFound albumId={panelProps.selectedAlbum?.id} tracks={tracks} playerControls={panelProps.playerControls} />
  }

  // 4. 有選中的歌 → 歌詞面板
  if (panelProps.selectedTrack) {
    return <SongPanel {...panelProps} />
  }

  // 5. 未選歌的情況由 App 層的專輯頁（AlbumInfo variant="full"）處理，這裡不渲染
  return null
}

export default SongPage
