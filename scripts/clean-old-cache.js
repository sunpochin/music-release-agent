import fs from 'fs/promises';
import path from 'path';

// 繁體中文註解：定義要清理的快取路徑
const CACHE_FILE = path.resolve('data/spotify-cache.json');
const RETENTION_DAYS = 90;

async function cleanOldCache() {
  try {
    const content = await fs.readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(content);
    
    const now = Date.now();
    const cutoffMs = now - (RETENTION_DAYS * 24 * 60 * 60 * 1000);
    const cutoffDate = new Date(cutoffMs);

    console.log(`🧹 開始清理快取... 保留最近 ${RETENTION_DAYS} 天內（${cutoffDate.toISOString().split('T')[0]} 之後）的發行作品。`);

    let totalAlbumsRemoved = 0;
    let totalTracksRemoved = 0;

    // 1. 清理 artist_albums 快取
    if (cache.artist_albums) {
      for (const artistId in cache.artist_albums) {
        const artistRecord = cache.artist_albums[artistId];
        if (artistRecord && Array.isArray(artistRecord.data)) {
          const originalCount = artistRecord.data.length;
          // 僅保留發行日期大於或等於截止日期的專輯
          artistRecord.data = artistRecord.data.filter(album => {
            const releaseDate = new Date(album.release_date);
            return releaseDate >= cutoffDate;
          });
          const removed = originalCount - artistRecord.data.length;
          totalAlbumsRemoved += removed;
        }
      }
    }

    // 2. 清理 album_tracks 快取中對應已被移除專輯的曲目，或過期的曲目
    // 先收集所有還保留下來的專輯 ID
    const activeAlbumIds = new Set();
    if (cache.artist_albums) {
      for (const artistId in cache.artist_albums) {
        const artistRecord = cache.artist_albums[artistId];
        if (artistRecord && Array.isArray(artistRecord.data)) {
          artistRecord.data.forEach(album => activeAlbumIds.add(album.id));
        }
      }
    }

    if (cache.album_tracks) {
      for (const albumId in cache.album_tracks) {
        if (!activeAlbumIds.has(albumId)) {
          delete cache.album_tracks[albumId];
          totalTracksRemoved++;
        }
      }
    }

    // 3. 寫入回快取檔案
    await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
    console.log(`✅ 清理完成！共移除了 ${totalAlbumsRemoved} 個過期專輯與 ${totalTracksRemoved} 個關聯歌曲列表快取。`);

  } catch (err) {
    console.error('❌ 清理快取時發生錯誤:', err.message);
  }
}

cleanOldCache();
