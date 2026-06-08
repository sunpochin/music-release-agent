import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpotifyDiscoveryStrategy } from '../src/strategies/spotify-strategy.js';
import { MusicBrainzDiscoveryStrategy } from '../src/strategies/musicbrainz-strategy.js';

describe('Discovery Strategies 單元測試 (TDD)', () => {
  describe('SpotifyDiscoveryStrategy', () => {
    let mockApiClient;
    let strategy;

    beforeEach(() => {
      mockApiClient = {
        request: vi.fn()
      };
      strategy = new SpotifyDiscoveryStrategy(mockApiClient);
    });

    it('應該正確呼叫 Spotify API 並回傳正規化後的專輯格式', async () => {
      mockApiClient.request.mockResolvedValue({
        items: [
          {
            id: 'sp-album-1',
            name: 'Salsa Fire',
            release_date: '2026-06-01',
            release_date_precision: 'day',
            album_type: 'album',
            total_tracks: 10,
            uri: 'spotify:album:sp-album-1',
            external_urls: { spotify: 'sp-url' },
            images: [{ url: 'sp-img' }]
          }
        ]
      });

      const artist = { id: 'artist-1', name: 'Bobby Valentin', genres: ['salsa'] };
      const albums = await strategy.execute(artist, 30);

      expect(mockApiClient.request).toHaveBeenCalledWith('artists/artist-1/albums', 'GET', null, expect.any(Object));
      expect(albums.length).toBe(1);
      expect(albums[0]).toEqual({
        id: 'sp-album-1',
        name: 'Salsa Fire',
        release_date: '2026-06-01',
        release_date_precision: 'day',
        total_tracks: 10,
        type: 'album',
        uri: 'spotify:album:sp-album-1',
        url: 'sp-url',
        image: 'sp-img'
      });
    });
  });

  describe('MusicBrainzDiscoveryStrategy', () => {
    let mockMbClient;
    let strategy;

    beforeEach(() => {
      mockMbClient = {
        getMusicBrainzArtistMBID: vi.fn(),
        getMusicBrainzArtistAlbums: vi.fn()
      };
      strategy = new MusicBrainzDiscoveryStrategy(mockMbClient);
    });

    it('應該利用歌手名稱查找 MBID，獲取 Release-Groups 並回傳正規化格式', async () => {
      mockMbClient.getMusicBrainzArtistMBID.mockResolvedValue('mb-artist-uuid');
      mockMbClient.getMusicBrainzArtistAlbums.mockResolvedValue([
        {
          id: 'mb-group-1',
          name: 'La Malanga',
          release_date: '2026-06-02',
          release_date_precision: 'day',
          total_tracks: 1,
          type: 'single',
          uri: 'musicbrainz:release-group:mb-group-1',
          url: 'mb-url',
          image: ''
        }
      ]);

      const artist = { id: 'artist-1', name: 'Bobby Valentin', genres: ['salsa'] };
      const albums = await strategy.execute(artist, 30);

      expect(mockMbClient.getMusicBrainzArtistMBID).toHaveBeenCalledWith('Bobby Valentin');
      expect(mockMbClient.getMusicBrainzArtistAlbums).toHaveBeenCalledWith('mb-artist-uuid', 30);
      expect(albums.length).toBe(1);
      expect(albums[0].name).toBe('La Malanga');
      expect(albums[0].uri).toBe('musicbrainz:release-group:mb-group-1');
    });
  });
});
