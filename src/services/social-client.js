/**
 * 📡 SocialClient — 社群發文服務客戶端
 *
 * 負責與獨立的 social-post-service 微服務通訊，
 * 將發文請求轉發到社群平台（Facebook / X / Threads / Bluesky）。
 */

import { requestStore } from './logger.js';

// 社群發文服務的 URL（預設為本地開發環境）
const SOCIAL_SERVICE_URL = process.env.SOCIAL_SERVICE_URL || 'http://localhost:3012';

export class SocialClient {
  constructor(baseUrl = SOCIAL_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * 發送發文請求到社群發文服務
   * @param {Object} params
   * @param {string} [params.imageBase64] - Base64 編碼的圖片資料
   * @param {string} params.caption - 發文文案
   * @param {string[]} params.platforms - 目標平台陣列（如 ['threads', 'facebook']）
   * @returns {Promise<{jobId: string, status: string}>}
   */
  async publishPost({ imageBase64, caption, platforms = ['threads'], mode }) {
    // 自非同步本地儲存空間讀取當前的 Request ID (Correlation ID)
    const store = requestStore.getStore();
    const requestId = store?.requestId;

    const headers = { 'Content-Type': 'application/json' };
    if (requestId) {
      headers['x-request-id'] = requestId;
    }

    const response = await fetch(`${this.baseUrl}/api/posts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        image: imageBase64 || null,
        caption,
        platforms,
        // mode: 'mock'（模擬發佈）| 'live'（預設，需真實平台 strategy）— 透傳給 companion
        ...(mode ? { mode } : {})
      })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`社群發文服務回應異常 (${response.status}): ${errorBody}`);
    }

    return response.json();
  }

  /**
   * 查詢發文任務的處理狀態
   * @param {string} jobId - 任務 ID
   * @returns {Promise<Object>} 任務狀態物件
   */
  async getPostStatus(jobId) {
    const response = await fetch(`${this.baseUrl}/api/posts/${jobId}`);

    if (!response.ok) {
      throw new Error(`查詢發文狀態失敗 (${response.status})`);
    }

    return response.json();
  }

  /**
   * 健康檢查 — 確認社群發文服務是否可達
   * @returns {Promise<boolean>}
   */
  async isHealthy() {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`, {
        signal: AbortSignal.timeout(3000) // 3 秒超時
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// 匯出單例供 server.js 使用
export const socialClient = new SocialClient();
