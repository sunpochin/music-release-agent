/**
 * =====================================================================
 * 🎵 Spotify Web API 外觀相容客戶端 (Spotify Client Facade Adapter)
 * =====================================================================
 * [技術] 本檔案已重構為外觀模式 (Facade Pattern) 作為向下相容層。
 *        內部整合 CacheService, SystemStateService, SpotifyApiClient, PlaybackService
 *        與 ReleaseScanner (策略模式降級鏈)，確保外部舊代碼無痛調用。
 * =====================================================================
 */
import { CacheService } from './services/cache-service.js';
import { SystemStateService } from './services/system-state-service.js';
import { SpotifyApiClient } from './services/spotify-api-client.ts';
import { PlaybackService } from './services/playback-service.js';
import { SpotifyDiscoveryStrategy } from './strategies/spotify-strategy.js';
import { MusicBrainzDiscoveryStrategy } from './strategies/musicbrainz-strategy.js';
import { ReleaseScanner } from './scanner/release-scanner.js';
import { getMusicBrainzAlbumTracks } from './musicbrainz-client.js';

// 初始化預設儲存路徑
const CACHE_FILE = 'data/spotify-cache.json';
const SYSTEM_STATE_FILE = 'data/system-state.json';
const SCANNER_STATE_FILE = 'data/scanner-state.json';

// 建立實例
const cacheService = new CacheService(CACHE_FILE);
const stateService = new SystemStateService(SYSTEM_STATE_FILE, SCANNER_STATE_FILE);
const apiClient = new SpotifyApiClient(stateService);

/**
 * 測試專用 seam：讓測試把 minIntervalMs 歸零、sleep 換成 no-op，
 * 使限速與 429 重試測試不消耗真實時鐘（確定性、毫秒級完成）。
 * 生產程式碼不應 import 此符號。
 */
export const __spotifyApiClientTestSeam = apiClient;
const playbackService = new PlaybackService(apiClient);

const spotifyStrategy = new SpotifyDiscoveryStrategy(apiClient);
const musicBrainzStrategy = new MusicBrainzDiscoveryStrategy();
const releaseScanner = new ReleaseScanner(stateService, cacheService, [spotifyStrategy, musicBrainzStrategy]);

// === 系統狀態相關向下相容導出 ===
export async function readSystemState() {
  return await stateService.readSystemState();
}

export async function writeSystemState(state) {
  return await stateService.writeSystemState(state);
}

export async function isSpotifyCooldownActive() {
  return await stateService.isSpotifyCooldownActive();
}

export async function recordSpotify429() {
  return await stateService.recordSpotify429();
}

// === 播放控制相關向下相容導出 ===
export async function searchSpotifyTracks(query, limit = 5) {
  return await playbackService.searchTracks(query, limit);
}

export async function getSpotifyDevices() {
  return await playbackService.getDevices();
}

export async function getSpotifyPlaybackState() {
  return await playbackService.getPlaybackState();
}

export async function playSpotifyTrack(trackUri, deviceId = null) {
  return await playbackService.playTrack(trackUri, deviceId);
}

export async function addSpotifyTrackToQueue(trackUri, deviceId = null) {
  return await playbackService.addTrackToQueue(trackUri, deviceId);
}

export async function skipSpotifyToNext(deviceId = null) {
  return await playbackService.skipToNext(deviceId);
}

export async function setSpotifyPlaybackVolume(volumePercent, deviceId = null) {
  return await playbackService.setVolume(volumePercent, deviceId);
}

// === 關注藝人與專輯相關向下相容導出 ===
export async function getSpotifyFollowedArtists() {
  const bypass = process.env.SPOTIFY_BYPASS_CACHE === 'true';
  const cache = await cacheService.read();
  const now = Date.now();

  if (!bypass && cache.followed_artists && cacheService.isValid(cache.followed_artists.timestamp)) {
    console.log('[Spotify/Client] 💾 從本地快取載入關注藝人清單...');
    return cache.followed_artists.data;
  }

  let artists = [];
  let after = null;
  let hasMore = true;

  console.log('[Spotify/Client] 🔍 正在獲取您關注的藝人清單...');

  while (hasMore) {
    const params = { type: 'artist', limit: 50 };
    if (after) params.after = after;
    const data = await apiClient.request('me/following', 'GET', null, params);
    const items = data.artists?.items || [];
    artists = artists.concat(items);

    if (items.length > 0 && data.artists?.next) {
      after = items[items.length - 1].id;
    } else {
      hasMore = false;
    }
  }

  const mappedArtists = artists.map(item => ({
    id: item.id,
    name: item.name,
    genres: item.genres || [],
    uri: item.uri,
    url: item.external_urls?.spotify || ''
  }));

  cache.followed_artists = { timestamp: now, data: mappedArtists };
  await cacheService.write(cache);

  console.log(`[Spotify/Client] ✅ 成功獲取 ${mappedArtists.length} 位關注的藝人！`);
  return mappedArtists;
}

export async function getSpotifyArtistAlbums(artistId, days = 30) {
  const artist = { id: artistId };
  const bypass = process.env.SPOTIFY_BYPASS_CACHE === 'true';
  const cache = await cacheService.read();
  // 防禦性程式設計：若舊版快取缺少 artist_albums 欄位，預設為空物件
  cache.artist_albums = cache.artist_albums || {};
  const now = Date.now();

  if (!bypass && cache.artist_albums[artistId] && cacheService.isValid(cache.artist_albums[artistId].timestamp)) {
    console.log(`[Spotify/Client] 💾 從本地快取載入藝人 [${artistId}] 的專輯清單...`);
    return cache.artist_albums[artistId].data;
  }

  const mappedAlbums = await spotifyStrategy.execute(artist, days);

  cache.artist_albums[artistId] = { timestamp: now, data: mappedAlbums };
  await cacheService.write(cache);

  return mappedAlbums;
}

// 輔助函式：從快取中尋找專輯名稱與藝人名稱
async function findAlbumMetadataFromCache(albumId, cache) {
  for (const artistId in cache.artist_albums) {
    const albums = cache.artist_albums[artistId]?.data || [];
    const album = albums.find(a => a.id === albumId);
    if (album) {
      let artistName = '';
      if (cache.followed_artists && cache.followed_artists.data) {
        const artist = cache.followed_artists.data.find(a => a.id === artistId);
        if (artist) artistName = artist.name;
      }
      if (!artistName) {
        const scannerState = await stateService.readScannerState();
        if (scannerState[artistId]) {
          artistName = scannerState[artistId].name;
        }
      }
      return {
        albumName: album.name,
        artistName: artistName || 'Unknown Artist',
        totalTracks: album.total_tracks || 1
      };
    }
  }
  return null;
}

/**
 * 背景非同步預載專輯內所有歌曲的歌詞原文，不影響 API 反應時間。
 * 歌詞抓取與快取已拆至 lyrics-vault-service companion —
 * 這裡只發 fire-and-forget 請求；companion 不在線時靜默略過（核心不依賴歌詞功能）。
 */
function triggerLyricsPreFetch(albumId, tracks, cache) {
  if (!tracks || tracks.length === 0) return;
  findAlbumMetadataFromCache(albumId, cache).then(async (meta) => {
    const artistName = meta?.artistName;
    if (!artistName || artistName === 'Unknown Artist') return;

    const { lyricsClient } = await import('./services/lyrics-client.js');
    if (!(await lyricsClient.isHealthy())) return; // companion 不在線 → 跳過預載，不報錯

    console.log(`[Spotify/Client] 🚀 開始背景預載《${artistName}》專輯 [${albumId}] 的 ${tracks.length} 首歌詞原文...`);
    // 順序觸發；節流與來源禮節由 lyrics-vault-service 負責
    for (const track of tracks) {
      // 忽略測試/模擬的 Demo 曲目與降級的預設 Track 曲目，避免無謂的 API 請求
      if (track.name.startsWith('Demo Track') || /^Track \d+$/.test(track.name)) continue;
      lyricsClient.fetchLyrics({ artistName, trackName: track.name, translate: false }).catch(() => {});
    }
  }).catch(() => {});
}

/**
 * 獲取特定專輯的所有歌曲，具備本地快取機制以防止 429 頻率限制，並在失敗時降級使用 MusicBrainz
 * @param {string} albumId - Spotify 專輯 ID
 * @returns {Promise<Array<object>>} 曲目清單
 */
export async function getSpotifyAlbumTracks(albumId) {
  const bypass = process.env.SPOTIFY_BYPASS_CACHE === 'true';
  const cache = await cacheService.read();
  // 初始化專輯歌曲快取結構
  cache.album_tracks = cache.album_tracks || {};
  const now = Date.now();

  if (!bypass && cache.album_tracks[albumId] && cacheService.isValid(cache.album_tracks[albumId].timestamp)) {
    console.log(`[Spotify/Client] 💾 從本地快取載入專輯 [${albumId}] 的歌曲清單...`);
    const cachedData = cache.album_tracks[albumId].data;
    
    // 檢查快取中是否有舊版的「降級保護」或「Demo Track」字樣，並在運行時進行清洗以保證 UI 質感
    let needsCacheUpdate = false;
    const sanitizedData = cachedData.map(track => {
      if (track.name && (track.name.includes('降級保護') || track.name.startsWith('Demo Track'))) {
        needsCacheUpdate = true;
        // 將舊版降級提示字樣清洗為符合唱片工業標準的「Track X」
        return {
          ...track,
          name: `Track ${track.track_number}`
        };
      }
      return track;
    });

    if (needsCacheUpdate) {
      cache.album_tracks[albumId].data = sanitizedData;
      await cacheService.write(cache);
      console.log(`[Spotify/Client] 🧹 已成功清洗並更新專輯 [${albumId}] 的舊版降級快取曲目。`);
    }

    // 取消背景預載，改為延遲載入 (Lazy Load)
    return sanitizedData;
  }

  try {
    console.log(`[Spotify/Client] 📡 正在透過 Spotify API 獲取專輯 [${albumId}] 的歌曲清單...`);
    const data = await apiClient.request(`albums/${albumId}/tracks`, 'GET', null, { limit: 50 });
    const items = data.items || [];

    const mappedTracks = items.map(item => ({
      id: item.id,
      name: item.name,
      track_number: item.track_number,
      duration_ms: item.duration_ms,
      uri: item.uri,
      url: item.external_urls?.spotify || ''
    }));

    cache.album_tracks[albumId] = { timestamp: now, data: mappedTracks };
    await cacheService.write(cache);
    // 取消背景預載，改為延遲載入 (Lazy Load)

    console.log(`[Spotify/Client] ✅ 成功獲取專輯 [${albumId}] 的 ${mappedTracks.length} 首歌曲！`);
    return mappedTracks;
  } catch (err) {
    console.warn(`[Spotify/Client] 🚨 無法透過 Spotify API 獲取專輯 [${albumId}] 的曲目: ${err.message}。嘗試使用 MusicBrainz 降級保護...`);

    // 尋找快取中的專輯與藝人名稱
    const meta = await findAlbumMetadataFromCache(albumId, cache);
    if (meta) {
      const mbTracks = await getMusicBrainzAlbumTracks(meta.artistName, meta.albumName);
      if (mbTracks && mbTracks.length > 0) {
        cache.album_tracks[albumId] = { timestamp: now, data: mbTracks };
        await cacheService.write(cache);
        triggerLyricsPreFetch(albumId, mbTracks, cache);
        console.log(`[Spotify/Client] ✅ 成功透過 MusicBrainz 載入並快取專輯 [${albumId}] 的 ${mbTracks.length} 首歌曲。`);
        return mbTracks;
      }
    }

    // 最後防線：回傳優雅的 mock 預設曲目列表，避免前端崩潰
    const totalTracksCount = meta?.totalTracks || 1;
    const fallbackTracks = Array.from({ length: totalTracksCount }, (_, i) => ({
      id: `fallback-${albumId}-${i + 1}`,
      name: `Track ${i + 1}`,
      track_number: i + 1,
      duration_ms: 180000,
      uri: `spotify:track:fallback-${albumId}-${i + 1}`,
      url: ''
    }));

    console.warn(`[Spotify/Client] ⚠️ MusicBrainz 降級也失敗，啟用最後防線：回傳 ${fallbackTracks.length} 首 Mock 曲目。`);
    return fallbackTracks;
  }
}

// === 協調器掃描相關向下相容導出 ===
export async function scanRecentNewReleases(days = 30, batchSize = null) {
  let followedArtists = [];
  let isSpotifyBlocked = false;

  console.log('[Spotify/Scanner] 🔍 正在獲取您關注的藝人清單...');
  try {
    followedArtists = await getSpotifyFollowedArtists();
  } catch (err) {
    if (err.message.includes('429') || err.message.includes('Too many requests') || err.message.includes('頻率')) {
      console.warn(`[Spotify/Scanner] 🚨 Spotify 獲取關注藝人時遭遇 429 鎖定！降級使用本地快取的藝人清單...`);
      isSpotifyBlocked = true;
    } else {
      throw err;
    }
  }

  if (isSpotifyBlocked || followedArtists.length === 0) {
    const scannerState = await stateService.readScannerState();
    followedArtists = Object.entries(scannerState).map(([id, val]) => ({
      id: id,
      name: val.name,
      genres: [],
      uri: `spotify:artist:${id}`,
      url: `https://open.spotify.com/artist/${id}`
    }));

    if (followedArtists.length === 0) {
      throw new Error('Spotify 遭到 429 限制，且本地狀態庫沒有 any 歷史藝人紀錄！無法啟動降級探索。');
    }
    console.log(`[Spotify/Scanner] 💾 成功自本地狀態庫載入 ${followedArtists.length} 位歷史藝人進行降級掃描。`);
  }

  // 透過事件監聽動態列印以保證向下相容控制台日誌輸出
  const onScanStart = ({ totalArtists }) => {
    console.log(`[Spotify/Scanner] 📦 本次分批掃描藝人數量: ${totalArtists} 位。`);
    const remaining = followedArtists.length - totalArtists;
    if (remaining > 0) {
      console.log(`[Spotify/Scanner] 🕒 剩餘未掃描或較早掃描藝人: ${remaining} 位，將於後續批次逐步推進。`);
    }
    console.log(`[Spotify/Scanner] 🚀 開始掃描近 ${days} 天內的新發行專輯與單曲...`);
  };

  const onArtistScanStart = ({ name }) => {
    if (isSpotifyBlocked) {
      console.log(`[Spotify/Scanner] 🎼 正在透過 MusicBrainz 探索藝人: ${name}...`);
    } else {
      console.log(`[Spotify/Scanner] 📡 正在透過 Spotify 掃描藝人: ${name}...`);
    }
  };

  const onArtistFallback = ({ name, strategyName }) => {
    if (strategyName === 'Spotify') {
      console.warn(`[Spotify/Scanner] 🚨 藝人 ${name} 觸發 Spotify 429 限流！自動降級切換至 MusicBrainz 進行掃描...`);
    }
  };

  releaseScanner.on('scan:start', onScanStart);
  releaseScanner.on('artist:scan_start', onArtistScanStart);
  releaseScanner.on('artist:scan_fallback', onArtistFallback);

  try {
    const results = await releaseScanner.scan(followedArtists, days, batchSize);
    console.log(`[Spotify/Scanner] 💾 成功更新並保存掃描狀態至 ${stateService.scannerStatePath}`);
    console.log(`[Spotify/Scanner] 🎉 本批次掃描完成！尋獲 ${results.length} 個近 ${days} 天內的新發行！`);
    return results;
  } finally {
    releaseScanner.off('scan:start', onScanStart);
    releaseScanner.off('artist:scan_start', onArtistScanStart);
    releaseScanner.off('artist:scan_fallback', onArtistFallback);
  }
}
