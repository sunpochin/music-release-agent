/**
 * Spotify Web Playback SDK 全域型別聲明
 * SDK 透過 <script> tag 載入，全域注入 window.Spotify
 */

export interface SpotifyTrack {
  id: string
  uri: string
  name: string
  duration_ms: number
  artists: Array<{ name: string; uri: string }>
  album: {
    uri: string
    name: string
    images: Array<{ url: string; height: number; width: number }>
  }
}

export interface SpotifyPlayerState {
  paused: boolean
  position: number
  duration: number
  track_window: {
    current_track: SpotifyTrack
    previous_tracks: SpotifyTrack[]
    next_tracks: SpotifyTrack[]
  }
}

interface SpotifyPlayerOptions {
  name: string
  volume?: number
  getOAuthToken: (cb: (token: string) => void) => void
}

interface SpotifyPlayer {
  connect(): Promise<boolean>
  disconnect(): void
  addListener(event: 'ready' | 'not_ready', cb: (data: { device_id: string }) => void): void
  addListener(event: 'player_state_changed', cb: (state: SpotifyPlayerState | null) => void): void
  addListener(event: 'initialization_error' | 'authentication_error' | 'account_error', cb: (data: { message: string }) => void): void
  removeListener(event: string, cb?: (...args: unknown[]) => void): void
  togglePlay(): Promise<void>
  seek(position_ms: number): Promise<void>
  setVolume(volume: number): Promise<void>
  getCurrentState(): Promise<SpotifyPlayerState | null>
}

interface SpotifyPlayerConstructor {
  new (options: SpotifyPlayerOptions): SpotifyPlayer
}

declare global {
  interface Window {
    Spotify: {
      Player: SpotifyPlayerConstructor
    }
    onSpotifyWebPlaybackSDKReady: () => void
  }
}

export {}
