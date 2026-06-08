import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// 模擬 fs/promises 模組以避免寫入真實的快取檔案
vi.mock('fs/promises', () => {
  let mockState = {};
  return {
    default: {
      readFile: vi.fn().mockImplementation(async (filePath) => {
        if (filePath.includes('scanner-state.json') || filePath.includes('system-state.json')) {
          return JSON.stringify(mockState[filePath] || {});
        }
        if (filePath.includes('spotify-cache.json')) {
          return JSON.stringify({ followed_artists: null, artist_albums: {} });
        }
        throw new Error('File not found');
      }),
      writeFile: vi.fn().mockImplementation(async (filePath, content) => {
        try {
          mockState[filePath] = JSON.parse(content);
        } catch (e) {
          mockState[filePath] = content;
        }
        return Promise.resolve();
      }),
      mkdir: vi.fn().mockResolvedValue(undefined)
    }
  };
});

// 模擬 spotify-auth 模組以直接回傳假 token
vi.mock('../src/spotify-auth.js', () => ({
  getSpotifyAccessToken: vi.fn().mockResolvedValue('fake-access-token')
}));

// 模擬 musicbrainz-client 模組以測試降級探索
vi.mock('../src/musicbrainz-client.js', () => ({
  getMusicBrainzArtistMBID: vi.fn().mockResolvedValue('fake-mbid'),
  getMusicBrainzArtistAlbums: vi.fn().mockResolvedValue([
    {
      id: 'mb-album-1',
      name: 'MusicBrainz Album',
      release_date: new Date().toISOString().split('T')[0],
      release_date_precision: 'day',
      total_tracks: 1,
      type: 'album',
      uri: 'musicbrainz:release-group:mb-album-1',
      url: 'https://musicbrainz.org/release-group/mb-album-1',
      image: ''
    }
  ])
}));

// 模擬 undici.fetch 以攔截低階 HTTP 請求
const mockFetch = vi.fn();
vi.mock('undici', () => ({
  fetch: (...args) => mockFetch(...args)
}));

// 載入待測模組
import { scanRecentNewReleases } from '../src/spotify-client.js';

describe('scanRecentNewReleases 基準測試', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 設定環境變數避免快取影響測試
    process.env.SPOTIFY_BYPASS_CACHE = 'true';
    process.env.SCAN_CYCLE_DAYS = '7';
  });

  afterEach(() => {
    delete process.env.SPOTIFY_BYPASS_CACHE;
  });

  it('正常路徑：成功從 Spotify 獲取關注藝人與新發行專輯', async () => {
    // 模擬 Spotify 關注藝人 API 的回傳值
    mockFetch.mockImplementation(async (url) => {
      if (url.includes('me/following')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            artists: {
              items: [
                { id: 'artist-1', name: 'Salsa King', genres: ['salsa'], uri: 'spotify:artist:artist-1', external_urls: { spotify: 'url' } }
              ],
              next: null
            }
          })
        };
      }
      if (url.includes('artists/artist-1/albums')) {
        return {
          ok: true,
          status: 200,
          text: async () => JSON.stringify({
            items: [
              {
                id: 'album-1',
                name: 'Salsa Storm',
                release_date: new Date().toISOString().split('T')[0],
                release_date_precision: 'day',
                album_type: 'album',
                total_tracks: 10,
                uri: 'spotify:album:album-1',
                external_urls: { spotify: 'url' },
                images: [{ url: 'image-url' }]
              }
            ],
            next: null
          })
        };
      }
      return { ok: true, status: 200, text: async () => '{}' };
    });

    const result = await scanRecentNewReleases(30, 5);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Salsa Storm');
    expect(result[0].primary_artist).toBe('Salsa King');
  });

  it('防禦路徑：當 Spotify 發生 429 時，自動降級至 MusicBrainz 進行掃描', async () => {
    // 模擬 Spotify 回傳 429 限流，並隨後成功由 MusicBrainz 提供資料
    mockFetch.mockImplementation(async (url) => {
      if (url.includes('me/following')) {
        return {
          ok: false,
          status: 429,
          headers: {
            get: (name) => {
              if (name === 'retry-after') return '1';
              return null;
            }
          },
          text: async () => 'Too Many Requests'
        };
      }
      return { ok: true, status: 200, text: async () => '{}' };
    });

    // 呼叫測試，因為 Spotify 封鎖，將使用 Mock 的 MusicBrainz 資料
    const result = await scanRecentNewReleases(30, 5);
    expect(result.length).toBe(1);
    expect(result[0].name).toBe('MusicBrainz Album');
    expect(result[0].uri).toContain('musicbrainz:');
  });
});
