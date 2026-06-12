import fs from 'fs/promises';
import path from 'path';

/**
 * 職責單一的快取管理服務 (CacheService)
 */
export class CacheService {
  /**
   * @param {string} cacheFilePath - 快取檔案路徑
   * @param {number} ttlMs - 快取存活時間 (毫秒)
   */
  constructor(cacheFilePath, ttlMs = 24 * 60 * 60 * 1000) {
    this.cacheFilePath = path.resolve(cacheFilePath);
    this.ttlMs = ttlMs;
  }

  /**
   * 讀取本地快取內容，若檔案不存在或毀損則返回預設空白快取
   * @returns {Promise<object>} 快取物件
   */
  async read() {
    try {
      const data = await fs.readFile(this.cacheFilePath, 'utf8');
      return JSON.parse(data);
    } catch {
      // 檔案不存在或損毀，回傳預設結構
      return {
        followed_artists: null,
        artist_albums: {}
      };
    }
  }

  /**
   * 寫入快取內容至本地檔案
   * @param {object} cache - 欲儲存的快取物件
   */
  async write(cache) {
    try {
      await fs.mkdir(path.dirname(this.cacheFilePath), { recursive: true });
      await fs.writeFile(this.cacheFilePath, JSON.stringify(cache, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[CacheService] ⚠️ 無法寫入快取檔:`, err.message || err);
    }
  }

  /**
   * 判斷給定的時間戳記是否仍在快取有效期內
   * @param {number} timestamp - 待判定的時間戳記
   * @returns {boolean} 是否有效
   */
  isValid(timestamp) {
    if (!timestamp) return false;
    return (Date.now() - timestamp) < this.ttlMs;
  }
}
