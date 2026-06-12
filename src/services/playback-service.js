/**
 * 職責單一的播放控制服務 (PlaybackService)
 */
export class PlaybackService {
  /**
   * @param {SpotifyApiClient} spotifyApiClient - Spotify API 客戶端
   */
  constructor(spotifyApiClient) {
    this.client = spotifyApiClient;
  }

  /**
   * 在 Spotify 上搜尋歌曲軌跡
   * @param {string} query - 搜尋關鍵字
   * @param {number} limit - 限制回傳數量
   * @returns {Promise<Array<object>>} 格式化後的歌曲陣列
   */
  async searchTracks(query, limit = 5) {
    console.log(`[PlaybackService] 🔍 正在搜尋歌曲：「${query}」...`);
    const data = await this.client.request('search', 'GET', null, {
      q: query,
      type: 'track',
      limit: limit
    });

    if (!data.tracks || !data.tracks.items) {
      return [];
    }

    return data.tracks.items.map(item => ({
      id: item.id,
      name: item.name,
      artist: item.artists.map(a => a.name).join(', '),
      album: item.album.name,
      uri: item.uri,
      duration_ms: item.duration_ms,
      image: item.album.images?.[0]?.url || ''
    }));
  }

  /**
   * 獲取當前用戶的所有可用播放設備列表
   * @returns {Promise<Array<object>>} 設備陣列
   */
  async getDevices() {
    const data = await this.client.request('me/player/devices');
    return data.devices || [];
  }

  /**
   * 獲取當前播放狀態與進程
   * @returns {Promise<object|null>} 播放狀態
   */
  async getPlaybackState() {
    try {
      const data = await this.client.request('me/player');
      if (!data || !data.item) return null;
      
      return {
        isPlaying: data.is_playing,
        progressMs: data.progress_ms,
        deviceName: data.device?.name || '未知設備',
        track: {
          id: data.item.id,
          name: data.item.name,
          artist: data.item.artists.map(a => a.name).join(', '),
          uri: data.item.uri,
          durationMs: data.item.duration_ms
        }
      };
    } catch {
      return null;
    }
  }

  /**
   * 播放指定的 Spotify 歌曲
   * @param {string} trackUri - 歌曲 URI
   * @param {string|null} deviceId - 設備 ID
   */
  async playTrack(trackUri, deviceId = null) {
    console.log(`[PlaybackService] ▶️ 正在播放歌曲 URI: ${trackUri}`);
    return await this.client.request('me/player/play', 'PUT', {
      uris: [trackUri]
    }, deviceId ? { device_id: deviceId } : null);
  }

  /**
   * 將歌曲加入 Spotify 原生播放隊列
   * @param {string} trackUri - 歌曲 URI
   * @param {string|null} deviceId - 設備 ID
   */
  async addTrackToQueue(trackUri, deviceId = null) {
    console.log(`[PlaybackService] ➕ 正在將歌曲加入播放隊列 URI: ${trackUri}`);
    return await this.client.request('me/player/queue', 'POST', null, {
      uri: trackUri,
      device_id: deviceId
    });
  }

  /**
   * 跳過當前歌曲，播放下一首
   * @param {string|null} deviceId - 設備 ID
   */
  async skipToNext(deviceId = null) {
    console.log('[PlaybackService] ⏭️ 正在跳過當前歌曲，播放下一首...');
    return await this.client.request('me/player/next', 'POST', null, deviceId ? { device_id: deviceId } : null);
  }

  /**
   * 調整設備播放音量
   * @param {number} volumePercent - 音量百分比 (0-100)
   * @param {string|null} deviceId - 設備 ID
   */
  async setVolume(volumePercent, deviceId = null) {
    console.log(`[PlaybackService] 🔊 正在調整音量為 ${volumePercent}%...`);
    return await this.client.request('me/player/volume', 'PUT', null, {
      volume_percent: volumePercent,
      device_id: deviceId
    });
  }
}
