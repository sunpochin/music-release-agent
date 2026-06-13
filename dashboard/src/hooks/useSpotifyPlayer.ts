import { useState, useEffect, useRef, useCallback } from 'react'
import type { SpotifyTrack, SpotifyPlayerState } from '../types/spotify'

/**
 * useSpotifyPlayer — Web Playback SDK 封裝 Hook
 *
 * 職責：
 *  1. 向後端 /api/auth/token 取得有效的 Access Token（Client Secret 永不暴露前端）
 *  2. 動態初始化 Spotify Web Playback SDK（Script Tag 載入）
 *  3. 回傳播放狀態供 UI 消費（currentTrack, position, isPlaying）
 *  4. 提供播放控制方法（togglePlay, seek, playUri）
 *
 * 注意：Web Playback SDK 僅支援 Spotify Premium 帳號。
 */

type PlayerError = 'not_premium' | 'not_authorized' | 'sdk_not_loaded' | string

const PLAYER_NAME = 'Music Release Agent'
const VOLUME = 0.8

export interface SpotifyPlayerControls {
  isReady: boolean
  isPlaying: boolean
  currentTrack: SpotifyTrack | null
  position: number   // 毫秒，供 KTV 歌詞同步精準使用
  duration: number   // 毫秒，供進度條使用
  error: PlayerError | null
  playUri: (spotifyUri: string) => Promise<void>
  togglePlay: () => void
  seek: (ms: number) => void
}

export function useSpotifyPlayer(): SpotifyPlayerControls {
  const playerRef = useRef<InstanceType<Window['Spotify']['Player']> | null>(null)
  const deviceIdRef = useRef<string | null>(null)
  const positionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const [isReady, setIsReady] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTrack, setCurrentTrack] = useState<SpotifyTrack | null>(null)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)
  const [error, setError] = useState<PlayerError | null>(null)

  // 向後端安全取得 Access Token（Client Secret 永不離開後端）
  const fetchToken = useCallback(async (): Promise<string | null> => {
    const res = await fetch('/api/auth/token')
    if (res.status === 401) {
      setError('not_authorized')
      return null
    }
    if (!res.ok) {
      setError('Failed to fetch token')
      return null
    }
    const data = await res.json() as { access_token: string }
    return data.access_token
  }, [])

  useEffect(() => {
    const initPlayer = async (): Promise<void> => {
      if (!window.Spotify) {
        setError('sdk_not_loaded')
        return
      }

      const token = await fetchToken()
      if (!token) return

      const player = new window.Spotify.Player({
        name: PLAYER_NAME,
        volume: VOLUME,
        // SDK 每次 Token 過期時回調此函式，向後端刷新並回傳
        getOAuthToken: async (cb) => {
          const freshToken = await fetchToken()
          if (freshToken) cb(freshToken)
        }
      })

      playerRef.current = player

      player.addListener('not_ready', ({ device_id }) => {
        console.warn('[SpotifyPlayer] Device offline:', device_id)
        setIsReady(false)
      })

      player.addListener('initialization_error', ({ message }) => {
        console.error('[SpotifyPlayer] Init error:', message)
        setError(message)
      })

      player.addListener('authentication_error', ({ message }) => {
        console.error('[SpotifyPlayer] Auth error:', message)
        setError('not_authorized')
      })

      player.addListener('account_error', () => {
        // 最常見原因：帳號非 Premium
        setError('not_premium')
      })

      player.addListener('ready', ({ device_id }) => {
        console.log('[SpotifyPlayer] ✅ Ready, device_id:', device_id)
        deviceIdRef.current = device_id
        setIsReady(true)
        setError(null)
      })

      player.addListener('player_state_changed', (state: SpotifyPlayerState | null) => {
        if (!state) return

        setIsPlaying(!state.paused)
        setCurrentTrack(state.track_window?.current_track ?? null)
        setPosition(state.position)
        setDuration(state.duration)

        // 定時器：每秒遞增 position，驅動流暢的 KTV 歌詞高亮動畫
        if (positionTimerRef.current) clearInterval(positionTimerRef.current)
        if (!state.paused) {
          let pos = state.position
          positionTimerRef.current = setInterval(() => {
            pos += 1000
            setPosition(pos)
          }, 1000)
        }
      })

      await player.connect()
    }

    // SDK 載入完後會呼叫 window.onSpotifyWebPlaybackSDKReady
    // 熱重載時 SDK 可能已存在，直接初始化
    if (window.Spotify) {
      initPlayer()
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer
      // 動態載入 SDK script
      if (!document.getElementById('spotify-player-sdk')) {
        const script = document.createElement('script')
        script.id = 'spotify-player-sdk'
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        script.async = true
        document.body.appendChild(script)
      }
    }

    return () => {
      if (positionTimerRef.current) clearInterval(positionTimerRef.current)
      playerRef.current?.disconnect()
      playerRef.current = null
      deviceIdRef.current = null
    }
  }, [fetchToken])

  /**
   * 透過 Spotify Web API 控制此設備播放指定 URI
   * SDK 本身不提供 play(uri)，需呼叫 REST API 並指定 device_id
   */
  const playUri = useCallback(async (spotifyUri: string): Promise<void> => {
    const token = await fetchToken()
    if (!token || !deviceIdRef.current) return

    await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceIdRef.current}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ uris: [spotifyUri] })
    })
  }, [fetchToken])

  const togglePlay = useCallback((): void => {
    playerRef.current?.togglePlay()
  }, [])

  const seek = useCallback((ms: number): void => {
    playerRef.current?.seek(ms)
  }, [])

  return { isReady, isPlaying, currentTrack, position, duration, error, playUri, togglePlay, seek }
}
