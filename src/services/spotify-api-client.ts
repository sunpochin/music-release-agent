import { fetch } from 'undici';
import { getSpotifyAccessToken } from '../spotify-auth.ts';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 職責單一的 Spotify API 通訊客戶端 (SpotifyApiClient)
 */
export class SpotifyApiClient {
  stateService: any;
  tokenProvider: any;
  minIntervalMs: number;
  sleep: (ms: number) => Promise<void>;
  lastSpotifyRequestTime: number;
  spotifyLock: Promise<void>;

  /**
   * @param {SystemStateService} stateService - 系統狀態服務
   * @param {object} options - 其他設定
   * @param {function} [options.tokenProvider] - 獲取 Access Token 的函式
   * @param {number} [options.minIntervalMs] - 請求最小間隔限制 (毫秒)
   * @param {function} [options.sleep] - 延遲函式注入點。測試時注入 no-op
   *        即可把「等了多久」變成「有沒有呼叫、參數是多少」的確定性斷言，
   *        測試不再消耗真實時鐘（429 重試與限速測試從秒級降到毫秒級）
   */
  constructor(stateService: any, options: any = {}) {
    this.stateService = stateService;
    this.tokenProvider = options.tokenProvider || getSpotifyAccessToken;
    this.minIntervalMs = options.minIntervalMs !== undefined ? options.minIntervalMs : 1000;
    this.sleep = options.sleep || sleep;
    this.lastSpotifyRequestTime = 0;
    this.spotifyLock = Promise.resolve();
  }

  /**
   * 執行全域瓶頸限速，確保每次請求間隔不低於限制值
   */
  async enforceRateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastSpotifyRequestTime;
    if (elapsed < this.minIntervalMs) {
      const delay = this.minIntervalMs - elapsed;
      await this.sleep(delay);
    }
    this.lastSpotifyRequestTime = Date.now();
  }

  /**
   * 帶有排隊互斥鎖的全域請求包裝器，負責處理降級冷卻與 Mutex 佇列
   * @param {string} endpoint - API 子端點
   * @param {string} method - HTTP 方法
   * @param {object|null} body - 請求 Body 物件
   * @param {object|null} params - 查詢參數物件
   * @param {number} retries - 429 發生時重試次數
   * @returns {Promise<any>}
   */
  async request(endpoint, method = 'GET', body = null, params = null, retries = 3) {
    // 檢查 Spotify 是否正處於冷卻禁用保護中
    if (this.stateService && await this.stateService.isSpotifyCooldownActive()) {
      throw new Error('Spotify API 處於自動降級冷卻保護中，已強制切換至 MusicBrainz 管道。');
    }

    const currentLock = this.spotifyLock;
    let release;
    this.spotifyLock = new Promise(resolve => { release = resolve; });

    await currentLock;
    try {
      await this.enforceRateLimit();
      return await this.requestDirect(endpoint, method, body, params, retries);
    } finally {
      release();
    }
  }

  /**
   * 實際發送 HTTP 請求與處理 429 限流之主調度邏輯
   */
  async requestDirect(endpoint, method = 'GET', body = null, params = null, retries = 3) {
    const token = await this.tokenProvider();
    if (!token) {
      const authPort = process.env.PORT || 3011;
      throw new Error(`未取得有效的 Spotify 授權！請先登入 http://localhost:${authPort}/login/spotify 進行認證。`);
    }

    let url = endpoint.startsWith('http') ? endpoint : `https://api.spotify.com/v1/${endpoint}`;
    if (params) {
      const urlParams = new URLSearchParams();
      Object.entries(params).forEach(([key, val]) => {
        if (val !== null && val !== undefined) {
          urlParams.append(key, val as string);
        }
      });
      url += `?${urlParams.toString()}`;
    }

    const options: any = {
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MusicReleaseAgent/1.0.0 (sunpochin@gmail.com)'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    // 處理 429 限流防禦
    if (response.status === 429) {
      if (this.stateService) {
        await this.stateService.recordSpotify429();
      }

      const retryAfterHeader = response.headers.get('retry-after');
      let retryAfter = parseInt(retryAfterHeader, 10);
      if (isNaN(retryAfter)) {
        retryAfter = retryAfterHeader ? Math.max(1, Math.ceil((new Date(retryAfterHeader).getTime() - Date.now()) / 1000)) : 2;
        if (isNaN(retryAfter) || retryAfter < 0) {
          retryAfter = 2;
        }
      }

      if (retryAfter > 10) {
        console.warn(`[SpotifyApiClient] 🚨 觸發重度頻率限制 (HTTP 429)，等待時間 ${retryAfter} 秒超過閥值！拋出錯誤以觸發降級...`);
        throw new Error(`Spotify 伺服器重度頻率限制 (HTTP 429): Retry-After ${retryAfter}s`);
      }
      
      console.warn(`[SpotifyApiClient] 🚨 觸發微量頻率限制 (HTTP 429)，將依照指示等待 ${retryAfter} 秒後進行重試... (剩餘重試次數: ${retries})`);
      if (retries > 0) {
        await this.sleep(retryAfter * 1000);
        return this.requestDirect(endpoint, method, body, params, retries - 1);
      }
      throw new Error(`Spotify 伺服器頻率限制 (HTTP 429) 且已耗盡重試次數，請稍後再試。`);
    }

    const text = await response.text();

    if (!response.ok) {
      let errorDetail = text;
      try {
        const errJson = JSON.parse(text);
        errorDetail = errJson.error?.message || text;
      } catch {}
      
      if (response.status === 403 && errorDetail.includes('NO_ACTIVE_DEVICE')) {
        throw new Error('找不到可用的 Spotify 播放設備！請先在手機、電腦或 iPad 開啟 Spotify App 並播放任意歌曲。');
      }
      
      throw new Error(`Spotify 伺服器拒絕 (HTTP ${response.status}): ${errorDetail}`);
    }

    if (response.status === 204 || response.status === 202 || !text.trim()) {
      return { success: true };
    }

    return JSON.parse(text);
  }
}
