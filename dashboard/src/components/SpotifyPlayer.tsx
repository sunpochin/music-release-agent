import React, { useEffect } from 'react'
import { Play, Pause, AlertCircle, Music } from 'lucide-react'

interface SpotifyPlayerProps {
  /** 要播放的 Spotify URI (e.g. 'spotify:track:xxx' 或 'spotify:album:xxx') */
  uri?: string
  playerControls: any
}

/**
 * SpotifyPlayer — 懸浮式 Spotify Web Playback SDK 播放器元件
 *
 * 接受 playerControls 作為 prop，不自己呼叫 hook，避免多重初始化。
 * 當 uri prop 改變時自動切換播放目標。
 * 降級處理：非 Premium 帳號顯示引導訊息而非崩潰。
 */
const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({ uri, playerControls }) => {
  const { isReady, isPlaying, currentTrack, position, duration, error, playUri, togglePlay } = playerControls

  // 當 uri 或播放器就緒狀態改變時，自動播放新的曲目
  useEffect(() => {
    if (isReady && uri) {
      playUri(uri)
    }
  }, [uri, isReady, playUri])

  // 格式化毫秒為 mm:ss 顯示
  const formatTime = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000)
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 計算進度條百分比（0–100）
  const progress = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0

  // 非 Premium 帳號的降級提示
  if (error === 'not_premium') {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
        <AlertCircle size={20} className="text-yellow-400 shrink-0" />
        <div>
          <p className="text-white text-sm font-medium">需要 Spotify Premium</p>
          <p className="text-gray-400 text-xs mt-0.5">免費帳號無法使用瀏覽器播放功能</p>
        </div>
      </div>
    )
  }

  // 未授權狀態
  if (error === 'not_authorized') {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-72 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 shadow-2xl flex items-center gap-3">
        <AlertCircle size={20} className="text-red-400 shrink-0" />
        <div>
          <p className="text-white text-sm font-medium">尚未連結 Spotify</p>
          <a href="/api/auth/login/spotify" className="text-spotify-green text-xs hover:underline">
            點此登入授權 →
          </a>
        </div>
      </div>
    )
  }

  // SDK 載入中（isReady = false，無 error）
  if (!isReady) {
    return (
      <div className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-black/40 backdrop-blur-xl border border-white/10 rounded-full flex items-center justify-center shadow-2xl">
        <Music size={20} className="text-spotify-green animate-pulse" />
      </div>
    )
  }

  // 主播放器 UI
  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-black/50 backdrop-blur-3xl border border-white/10 rounded-2xl p-4 shadow-[0_20px_60px_rgba(0,0,0,0.6)] transition-all duration-500">
      <div className="flex items-center gap-3">
        {/* 專輯封面 */}
        {currentTrack?.album.images[0]?.url ? (
          <img
            src={currentTrack.album.images[0].url}
            alt={currentTrack.album.name}
            className="w-12 h-12 rounded-xl object-cover shadow-md shrink-0"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
            <Music size={18} className="text-gray-400" />
          </div>
        )}

        {/* 曲名與藝人 */}
        <div className="flex-1 overflow-hidden">
          <p className="text-white text-sm font-semibold truncate">
            {currentTrack?.name ?? '尚未播放'}
          </p>
          <p className="text-gray-400 text-xs truncate mt-0.5">
            {currentTrack?.artists.map((a: { name: string }) => a.name).join(', ') ?? '請在左側選擇歌曲'}
          </p>
        </div>

        {/* 播放 / 暫停按鈕 */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 bg-spotify-green hover:bg-green-400 rounded-full flex items-center justify-center transition-all duration-200 hover:scale-110 shadow-[0_0_20px_rgba(29,185,84,0.4)] shrink-0"
          aria-label={isPlaying ? '暫停' : '播放'}
        >
          {isPlaying
            ? <Pause size={16} fill="black" className="text-black" />
            : <Play size={16} fill="black" className="text-black ml-0.5" />
          }
        </button>
      </div>

      {/* 進度條 */}
      <div className="mt-3">
        <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
          <div
            className="h-full bg-spotify-green rounded-full transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-gray-500 text-[10px]">{formatTime(position)}</span>
          <span className="text-gray-500 text-[10px]">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  )
}

export default SpotifyPlayer
