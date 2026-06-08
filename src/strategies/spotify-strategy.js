import { ReleaseDiscoveryStrategy } from './discovery-strategy.js';

/**
 * Spotify 新發行探索策略 (SpotifyDiscoveryStrategy)
 */
export class SpotifyDiscoveryStrategy extends ReleaseDiscoveryStrategy {
  /**
   * @param {SpotifyApiClient} spotifyApiClient - Spotify API 客戶端
   */
  constructor(spotifyApiClient) {
    super();
    this.name = 'Spotify';
    this.client = spotifyApiClient;
  }

  /**
   * 探索特定藝人的近期發行，分頁爬取直至超出時間範圍
   * @param {object} artist - 藝人物件
   * @param {number} days - 追溯天數
   * @returns {Promise<Array<object>>} 正規化後的專輯陣列
   */
  async execute(artist, days = 30) {
    let albums = [];
    let limit = 10;
    let offset = 0;
    let hasMore = true;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    while (hasMore) {
      const data = await this.client.request(`artists/${artist.id}/albums`, 'GET', null, {
        include_groups: 'album,single',
        limit: limit,
        offset: offset
      });

      const items = data.items || [];
      if (items.length === 0) {
        break;
      }

      albums = albums.concat(items);

      // 檢查這一頁最舊的專輯是否仍在指定天數內
      const oldestItem = items[items.length - 1];
      let oldestDate;
      if (oldestItem.release_date_precision === 'day') {
        oldestDate = new Date(oldestItem.release_date);
      } else if (oldestItem.release_date_precision === 'month') {
        oldestDate = new Date(`${oldestItem.release_date}-01`);
      } else {
        oldestDate = new Date(`${oldestItem.release_date}-01-01`);
      }

      if (oldestDate >= cutoffDate && data.next && items.length === limit) {
        offset += limit;
      } else {
        hasMore = false;
      }
    }

    // 正規化輸出 (LSP: 里氏代換原則)
    return albums.map(item => ({
      id: item.id,
      name: item.name,
      release_date: item.release_date,
      release_date_precision: item.release_date_precision,
      total_tracks: item.total_tracks,
      type: item.album_type,
      uri: item.uri,
      url: item.external_urls?.spotify || '',
      image: item.images?.[0]?.url || ''
    }));
  }
}
