import React, { useEffect } from 'react'
import { Play, Pause, AlertCircle, Music } from 'lucide-react'

interface SpotifyPlayerProps {
  /** 要播放的 Spotify URI (e.g. 'spotify:track:xxx' 或 'spotify:album:xxx') */
  uri?: string
  playerControls: any
  fallbackTrackName?: string
  fallbackArtistName?: string
}

/**
 * SpotifyPlayer — 懸浮式 Spotify Web Playback SDK 播放器元件
 *
 * 接受 playerControls 作為 prop，不自己呼叫 hook，避免多重初始化。
 * 當 uri prop 改變時不再自動播放，而是等待使用者按下 Play。
 * 降級處理：非 Premium 帳號顯示引導訊息而非崩潰。
 */
const SpotifyPlayer: React.FC<SpotifyPlayerProps> = ({ uri, playerControls, fallbackTrackName, fallbackArtistName }) => {
  const { isReady, isPlaying, currentTrack, position, duration, error, playUri, togglePlay } = playerControls

  // (2026-06-13) 用戶要求取消自動播放，故移除此處的 useEffect 自動 playUri 邏輯

  // 處理播放/暫停按鈕點擊
  const handlePlayClick = () => {
    const isDifferentTrack = uri && currentTrack?.uri !== uri
    if (!currentTrack || isDifferentTrack) {
      // 如果目前播放器內無曲目，或者選擇了另一首歌，則主動加載選取的 uri
      if (uri) playUri(uri)
    } else {
      togglePlay()
    }
  }

  // 格式化毫秒為 mm:ss 顯示
  const formatTime = (ms: number): string => {
    const totalSecs = Math.floor(ms / 1000)
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // 處理進度條點擊跳轉 (Seek)
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerControls.seek || duration === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percent = clickX / rect.width
    const newPosition = Math.floor(percent * duration)
    playerControls.seek(newPosition)
  }

  // 計算進度條百分比（0–100）
  const progress = duration > 0 ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0

  // 非 Premium 帳號的降級提示
  if (error === 'not_premium') {
    return (
      <div className="w-full bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 flex items-center gap-3">
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
      <div className="w-full bg-black/60 backdrop-blur-2xl border border-white/10 rounded-2xl p-4 flex items-center gap-3">
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
      <div className="w-full h-20 bg-black/20 backdrop-blur-xl border border-white/10 rounded-3xl flex items-center justify-center">
        <Music size={20} className="text-spotify-green animate-pulse" />
      </div>
    )
  }

  // 主播放器 UI
  return (
    <div className="w-full bg-black/40 backdrop-blur-[60px] border border-white/10 rounded-[28px] p-3 transition-all duration-700 ease-out group">
      <div className="flex items-center gap-4 px-2">
        {/* 專輯封面 */}
        {currentTrack?.album.images[0]?.url ? (
          <img
            src={currentTrack.album.images[0].url}
            alt={currentTrack.album.name}
            className="w-12 h-12 rounded-xl object-cover shadow-lg shrink-0 scale-100 transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
            <Music size={20} className="text-white/40" />
          </div>
        )}

        {/* 曲名與藝人 */}
        <div className="flex-1 overflow-hidden flex flex-col justify-center">
          <p className="text-white/90 text-[15px] font-semibold truncate tracking-wide">
            {currentTrack?.name ?? fallbackTrackName ?? '尚未播放'}
          </p>
          <p className="text-white/50 text-[13px] truncate font-medium mt-0.5">
            {currentTrack?.artists.map((a: { name: string }) => a.name).join(', ') ?? fallbackArtistName ?? '請在左側選擇歌曲'}
          </p>
        </div>

        {/* 播放 / 暫停按鈕 */}
        <button
          onClick={handlePlayClick}
          className="w-12 h-12 bg-white text-black hover:scale-105 hover:bg-spotify-green rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_20px_rgba(255,255,255,0.2)] shrink-0"
          aria-label={isPlaying ? '暫停' : '播放'}
        >
          {isPlaying
            ? <Pause size={20} fill="currentColor" className="text-current" />
            : <Play size={20} fill="currentColor" className="text-current ml-1" />
          }
        </button>
      </div>

      {/* 進度條 */}
      <div className="mt-3 px-2 pb-1 group-hover:opacity-100 opacity-80 transition-opacity duration-300">
        <div 
          className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden cursor-pointer hover:h-2.5 transition-all duration-300 relative"
          onClick={handleProgressClick}
        >
          <div
            className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-1000 ease-linear pointer-events-none shadow-[0_0_10px_rgba(255,255,255,0.5)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1.5 px-0.5">
          <span className="text-white/40 text-[10px] font-mono tracking-wider">{formatTime(position)}</span>
          <span className="text-white/40 text-[10px] font-mono tracking-wider">{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  )
}

export default SpotifyPlayer
