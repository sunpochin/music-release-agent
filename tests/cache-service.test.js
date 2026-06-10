import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheService } from '../src/services/cache-service.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 使用每次執行唯一的暫存路徑，避免測試殘留檔案造成順序相依（order-dependent）失敗，
// 也避免污染 repo 的 data/ 目錄
const TEST_CACHE_FILE = path.join(
  os.tmpdir(),
  `test-spotify-cache-${process.pid}-${Date.now()}.json`
);

describe('CacheService 單元測試', () => {
  let cacheService;

  beforeEach(() => {
    cacheService = new CacheService(TEST_CACHE_FILE, 1000); // 設定 1 秒的短 TTL
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_CACHE_FILE);
    } catch (e) {
      // 忽略刪除測試檔失敗
    }
  });

  it('讀取不存在的檔案應回傳預設快取結構', async () => {
    const data = await cacheService.read();
    expect(data).toEqual({
      followed_artists: null,
      artist_albums: {}
    });
  });

  it('寫入快取後應能正確讀取回相同資料', async () => {
    const testData = {
      followed_artists: { timestamp: Date.now(), data: [{ id: '1', name: 'Test' }] },
      artist_albums: {}
    };
    await cacheService.write(testData);
    const data = await cacheService.read();
    expect(data).toEqual(testData);
  });

  it('isValid 應能正確判斷快取存活期與過期', async () => {
    const now = Date.now();
    expect(cacheService.isValid(now)).toBe(true);
    expect(cacheService.isValid(now - 2000)).toBe(false); // 已過期 2 秒
    expect(cacheService.isValid(null)).toBe(false);
  });
});
