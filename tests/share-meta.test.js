/**
 * =====================================================================
 * 🔗 Share Meta 測試 — OG 分享端點的可執行證明
 * =====================================================================
 * 三類情境：
 *   1. 正常：歌曲層級與專輯層級的 OG meta 內容正確
 *   2. 模糊：track 不在快取 → 退回專輯層級；album 不在快取 → 通用 fallback
 *   3. 惡意：專輯/藝人/歌名含 HTML 注入 → 全部轉義（與前端同一套安全哲學）
 * =====================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  escapeHtml,
  findAlbumInCache,
  findTrackName,
  buildShareHtml
} from '../src/services/share-meta.js';

const fixtureCache = {
  followed_artists: {
    data: [{ id: 'artist-1', name: 'Las Migas' }]
  },
  artist_albums: {
    'artist-1': {
      data: [
        {
          id: 'album-1',
          name: 'Chasing the Sun',
          release_date: '2026-06-08',
          total_tracks: 10,
          image: 'https://i.scdn.co/image/cover-1'
        }
      ]
    }
  },
  album_tracks: {
    'album-1': {
      data: [{ id: 'track-1', name: 'Amanecer', track_number: 1 }]
    }
  }
};

describe('Share Meta：快取查找（正常/模糊情境）', () => {
  it('找得到專輯時回傳專輯與藝人名稱', () => {
    const found = findAlbumInCache(fixtureCache, 'album-1');
    expect(found.album.name).toBe('Chasing the Sun');
    expect(found.artistName).toBe('Las Migas');
  });

  it('找不到專輯時回傳 null（模糊：過期連結）', () => {
    expect(findAlbumInCache(fixtureCache, 'nope')).toBeNull();
    expect(findAlbumInCache({}, 'album-1')).toBeNull();
    expect(findAlbumInCache(null, 'album-1')).toBeNull();
  });

  it('找得到/找不到歌曲名稱', () => {
    expect(findTrackName(fixtureCache, 'album-1', 'track-1')).toBe('Amanecer');
    expect(findTrackName(fixtureCache, 'album-1', 'nope')).toBeNull();
    expect(findTrackName(fixtureCache, 'no-album', 'track-1')).toBeNull();
  });
});

describe('Share Meta：HTML 輸出（正常情境）', () => {
  it('歌曲層級：og:title 含歌名與藝人、og:type 為 music.song、含封面圖', () => {
    const html = buildShareHtml({
      album: fixtureCache.artist_albums['artist-1'].data[0],
      artistName: 'Las Migas',
      trackName: 'Amanecer',
      dashboardUrl: 'http://localhost:5173',
      requestPath: '/album/album-1/song/track-1'
    });
    expect(html).toContain('<meta property="og:title" content="Amanecer — Las Migas">');
    expect(html).toContain('<meta property="og:type" content="music.song">');
    expect(html).toContain('og:image" content="https://i.scdn.co/image/cover-1"');
    expect(html).toContain('url=http://localhost:5173/album/album-1/song/track-1');
  });

  it('專輯層級（無 trackName）：og:type 為 music.album、描述含發行日與曲目數', () => {
    const html = buildShareHtml({
      album: fixtureCache.artist_albums['artist-1'].data[0],
      artistName: 'Las Migas',
      trackName: null,
      dashboardUrl: 'http://localhost:5173',
      requestPath: '/album/album-1'
    });
    expect(html).toContain('<meta property="og:type" content="music.album">');
    expect(html).toContain('Chasing the Sun — Las Migas');
    expect(html).toContain('2026-06-08');
    expect(html).toContain('10 首曲目');
  });

  it('找不到專輯：退回通用站台 meta，仍含重導向（過期連結不死）', () => {
    const html = buildShareHtml({
      album: null,
      artistName: '',
      trackName: null,
      dashboardUrl: 'http://localhost:5173',
      requestPath: '/album/gone'
    });
    expect(html).toContain('Music Release Agent');
    expect(html).toContain('<meta property="og:type" content="website">');
    expect(html).toContain('url=http://localhost:5173/album/gone');
    expect(html).not.toContain('og:image');
  });
});

describe('Share Meta：XSS 防護（惡意情境）', () => {
  const evilAlbum = {
    id: 'evil-1',
    name: '<script>alert(1)</script>',
    release_date: '2026-01-01"><img src=x onerror=alert(2)>',
    total_tracks: 3,
    image: 'https://x/cover"><script>alert(3)</script>'
  };

  it('專輯/藝人/歌名/日期/圖片 URL 全部轉義，輸出不含可執行標籤', () => {
    const html = buildShareHtml({
      album: evilAlbum,
      artistName: '<svg onload=alert(4)>',
      trackName: '"><iframe src=evil>',
      dashboardUrl: 'http://localhost:5173',
      requestPath: '/album/evil-1/song/t'
    });
    expect(html).not.toContain('<script>alert');
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<svg onload');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('&lt;script&gt;');
    // 屬性值內的雙引號被轉義，無法跳出屬性
    expect(html).not.toMatch(/content="[^"]*"><(script|img|iframe|svg)/);
  });

  it('escapeHtml 覆蓋五種特殊字元', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(123)).toBe('123');
  });
});
