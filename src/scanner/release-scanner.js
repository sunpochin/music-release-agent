import EventEmitter from 'events';

/**
 * 新發行掃描協調器 (ReleaseScanner)
 * 繼承 Node.js 的 EventEmitter (觀察者模式)，解耦掃描邏輯與控制台輸出。
 */
export class ReleaseScanner extends EventEmitter {
  /**
   * @param {SystemStateService} stateService - 系統狀態服務
   * @param {CacheService} cacheService - 快取服務
   * @param {Array<ReleaseDiscoveryStrategy>} strategies - 策略鏈清單 (如 [Spotify, MusicBrainz])
   */
  constructor(stateService, cacheService, strategies = []) {
    super();
    this.stateService = stateService;
    this.cacheService = cacheService;
    this.strategies = strategies;
  }

  /**
   * 掃描最近發行的專輯與單曲
   * @param {Array<object>} followedArtists - 關注的藝人清單
   * @param {number} days - 追溯天數 (預設 30 天)
   * @param {number|null} batchSize - 本次掃描藝人數量上限。若為 null 則自動依週期天數計算。
   * @returns {Promise<Array<object>>} 正規化且去重後的新發行清單
   */
  async scan(followedArtists, days = 30, batchSize = null) {
    const scannerState = await this.stateService.readScannerState();

    // 1. 依照最後掃描時間對藝人進行排序，最久未掃描者優先
    const sortedArtists = [...followedArtists].sort((a, b) => {
      const dateA = scannerState[a.id]?.last_scanned_at ? new Date(scannerState[a.id].last_scanned_at) : null;
      const dateB = scannerState[b.id]?.last_scanned_at ? new Date(scannerState[b.id].last_scanned_at) : null;
      const timeA = dateA && !isNaN(dateA.getTime()) ? dateA.getTime() : 0;
      const timeB = dateB && !isNaN(dateB.getTime()) ? dateB.getTime() : 0;
      return timeA - timeB;
    });

    // 2. 計算批次大小 (預設最低 15 人，若無指定則依週期分配)
    let finalBatchSize = batchSize;
    if (finalBatchSize === null) {
      const scanCycleDays = parseInt(process.env.SCAN_CYCLE_DAYS, 10) || 7;
      const totalRuns = scanCycleDays * 8; // 一天執行 8 次 (每 3 小時一次)
      finalBatchSize = Math.max(15, Math.ceil(followedArtists.length / totalRuns));
    }

    const targetArtists = sortedArtists.slice(0, finalBatchSize);
    this.emit('scan:start', { totalArtists: targetArtists.length });

    const newReleases = [];
    const seenAlbumIds = new Set();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let successCount = 0;

    // 3. 逐一探索藝人的作品
    for (const artist of targetArtists) {
      this.emit('artist:scan_start', { name: artist.name });
      let artistAlbums = [];
      let scanSuccessful = false;

      // 依序嘗試每一種探索策略 (OCP 降級鏈)
      for (const strategy of this.strategies) {
        try {
          // 注入已記錄的 mbid 做為快取，減少外部搜尋
          const artistWithCachedMbid = {
            ...artist,
            musicbrainz_mbid: scannerState[artist.id]?.musicbrainz_mbid || artist.musicbrainz_mbid
          };

          const albums = await strategy.execute(artistWithCachedMbid, days);
          artistAlbums = albums || [];
          scanSuccessful = true;
          
          // 如果策略執行成功，便跳出策略鏈，不繼續向後退化
          break;
        } catch (err) {
          this.emit('artist:scan_fallback', {
            name: artist.name,
            strategyName: strategy.name,
            error: err.message || err
          });
        }
      }

      if (scanSuccessful) {
        successCount++;
        // 處理與去重
        let count = 0;
        for (const album of artistAlbums) {
          if (seenAlbumIds.has(album.id)) continue;

          let releaseDate;
          if (album.release_date_precision === 'day') {
            releaseDate = new Date(album.release_date);
          } else if (album.release_date_precision === 'month') {
            releaseDate = new Date(`${album.release_date}-01`);
          } else {
            releaseDate = new Date(`${album.release_date}-01-01`);
          }

          if (releaseDate >= cutoffDate) {
            seenAlbumIds.add(album.id);
            newReleases.push({
              ...album,
              primary_artist: artist.name,
              artist_genres: artist.genres || []
            });
            count++;
          }
        }

        this.emit('artist:scan_success', { name: artist.name, albumsCount: count });

        // 更新此藝人的掃描狀態與 MBID 快取
        if (!scannerState[artist.id]) {
          scannerState[artist.id] = { name: artist.name };
        }
        scannerState[artist.id].last_scanned_at = new Date().toISOString();
        
        // 如果此批次取得的專輯中帶有 mbid，可予以儲存 (例如 MusicBrainz 策略傳回的 uri 中含 UUID)
        const mbUri = artistAlbums.find(a => a.uri && a.uri.startsWith('musicbrainz:'));
        if (mbUri) {
          const uuid = mbUri.uri.split(':').pop();
          if (uuid) {
            scannerState[artist.id].musicbrainz_mbid = uuid;
          }
        }
      } else {
        this.emit('artist:scan_failure', {
          name: artist.name,
          error: '所有探索策略皆已失效。'
        });
      }
    }

    // 4. 保存最新的掃描狀態
    await this.stateService.writeScannerState(scannerState);

    this.emit('scan:complete', {
      totalArtists: targetArtists.length,
      successCount: successCount,
      releasesCount: newReleases.length
    });

    return newReleases;
  }
}
