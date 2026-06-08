import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ReleaseScanner } from '../src/scanner/release-scanner.js';

describe('ReleaseScanner 協調器單元測試 (TDD)', () => {
  let mockStateService;
  let mockCacheService;
  let mockStrategy1;
  let mockStrategy2;
  let scanner;

  beforeEach(() => {
    mockStateService = {
      readScannerState: vi.fn().mockResolvedValue({
        'artist-1': { name: 'Artist A', last_scanned_at: '2026-06-01T00:00:00.000Z' },
        'artist-2': { name: 'Artist B', last_scanned_at: '2026-06-03T00:00:00.000Z' }
      }),
      writeScannerState: vi.fn().mockResolvedValue(undefined)
    };

    mockCacheService = {};

    mockStrategy1 = {
      name: 'Strategy1',
      execute: vi.fn()
    };

    mockStrategy2 = {
      name: 'Strategy2',
      execute: vi.fn()
    };

    scanner = new ReleaseScanner(
      mockStateService,
      mockCacheService,
      [mockStrategy1, mockStrategy2]
    );
  });

  it('應依照最後掃描時間排序藝人（最久沒掃描的優先）並限制 batchSize', async () => {
    const followedArtists = [
      { id: 'artist-2', name: 'Artist B' }, // 較晚掃描
      { id: 'artist-1', name: 'Artist A' }, // 較早掃描 (應排首位)
      { id: 'artist-3', name: 'Artist C' }  // 未曾掃描 (最優先)
    ];

    mockStrategy1.execute.mockResolvedValue([]);

    // 限制掃描批次大小為 2
    const result = await scanner.scan(followedArtists, 30, 2);

    // 應只掃描 artist-3 與 artist-1
    expect(mockStrategy1.execute).toHaveBeenCalledTimes(2);
    expect(mockStrategy1.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'artist-3' }), 30);
    expect(mockStrategy1.execute).toHaveBeenCalledWith(expect.objectContaining({ id: 'artist-1' }), 30);
    expect(mockStrategy1.execute).not.toHaveBeenCalledWith(expect.objectContaining({ id: 'artist-2' }), 30);
  });

  it('策略鏈降級：如果第一個策略失敗，應嘗試第二個策略並發送 fallback 事件', async () => {
    const followedArtists = [{ id: 'artist-1', name: 'Artist A' }];
    
    // 第一策略失敗，第二策略成功
    mockStrategy1.execute.mockRejectedValue(new Error('Rate Limit'));
    mockStrategy2.execute.mockResolvedValue([
      { id: 'album-1', name: 'Fallback Hit', release_date: '2026-06-05', release_date_precision: 'day', type: 'album' }
    ]);

    const events = [];
    scanner.on('artist:scan_fallback', (e) => events.push(e));
    scanner.on('artist:scan_success', (e) => events.push(e));

    const result = await scanner.scan(followedArtists, 30, 1);

    expect(result.length).toBe(1);
    expect(result[0].name).toBe('Fallback Hit');
    expect(mockStrategy1.execute).toHaveBeenCalledTimes(1);
    expect(mockStrategy2.execute).toHaveBeenCalledTimes(1);

    // 驗證事件廣播
    expect(events).toContainEqual(expect.objectContaining({ name: 'Artist A', strategyName: 'Strategy1' }));
    expect(events).toContainEqual(expect.objectContaining({ name: 'Artist A', albumsCount: 1 }));
  });
});
