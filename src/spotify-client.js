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
import { SpotifyApiClient } from './services/spotify-api-client.js';
import { PlaybackService } from './services/playback-service.js';
import { SpotifyDiscoveryStrategy } from './strategies/spotify-strategy.js';
import { MusicBrainzDiscoveryStrategy } from './strategies/musicbrainz-strategy.js';
import { ReleaseScanner } from './scanner/release-scanner.js';

// 初始化預設儲存路徑
const CACHE_FILE = 'data/spotify-cache.json';
const SYSTEM_STATE_FILE = 'data/system-state.json';
const SCANNER_STATE_FILE = 'data/scanner-state.json';

// 建立實例
const cacheService = new CacheService(CACHE_FILE);
const stateService = new SystemStateService(SYSTEM_STATE_FILE, SCANNER_STATE_FILE);
const apiClient = new SpotifyApiClient(stateService);
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
