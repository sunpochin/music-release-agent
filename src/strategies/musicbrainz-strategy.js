import { ReleaseDiscoveryStrategy } from './discovery-strategy.js';
import * as musicbrainzClient from '../musicbrainz-client.js';

/**
 * MusicBrainz 新發行探索策略 (MusicBrainzDiscoveryStrategy)
 */
export class MusicBrainzDiscoveryStrategy extends ReleaseDiscoveryStrategy {
  /**
   * @param {object} [mbClient] - MusicBrainz 模組接口
   */
  constructor(mbClient = musicbrainzClient) {
    super();
    this.name = 'MusicBrainz';
    this.client = mbClient;
  }

  /**
   * 透過 MusicBrainz API 探索歌手發行
   * @param {object} artist - 歌手物件
   * @param {number} days - 追溯天數
   * @returns {Promise<Array<object>>} 正規化後的統一專輯格式
   */
  async execute(artist, days = 30) {
    let mbid = artist.musicbrainz_mbid;
    if (!mbid) {
      const lookupFn = this.client.getMusicBrainzArtistMBID;
      if (lookupFn) {
        mbid = await lookupFn(artist.name);
      }
    }

    if (!mbid) {
      console.warn(`[MusicBrainzStrategy] ⚠️ 無法獲取 ${artist.name} 的 MBID，跳過策略。`);
      return [];
    }

    const albumsFn = this.client.getMusicBrainzArtistAlbums;
    if (!albumsFn) {
      return [];
    }

    const rawAlbums = await albumsFn(mbid, days);
    
    return rawAlbums.map(album => ({
      id: album.id,
      name: album.name,
      release_date: album.release_date,
      release_date_precision: album.release_date_precision,
      total_tracks: album.total_tracks || 1,
      type: album.type || 'album',
      uri: album.uri || `musicbrainz:release-group:${album.id}`,
      url: album.url || `https://musicbrainz.org/release-group/${album.id}`,
      image: album.image || ''
    }));
  }
}
