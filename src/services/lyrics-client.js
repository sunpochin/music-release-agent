/**
 * 🎼 LyricsClient — lyrics-vault-service 客戶端
 *
 * 與獨立的 lyrics-vault-service 微服務通訊（歌詞翻譯 + Obsidian vault 落盤）。
 * 模式與 social-client.js 一致：核心服務只轉發與降級，不持有歌詞邏輯。
 * 契約：contracts/lyrics-handoff.schema.json（lyrics-vault-service 為單一事實來源，
 * 本 repo 持有副本並以 drift test 比對）。
 */

import { requestStore } from './logger.js';

const LYRICS_SERVICE_URL = process.env.LYRICS_SERVICE_URL || 'http://localhost:3013';

export class LyricsClient {
  constructor(baseUrl = LYRICS_SERVICE_URL) {
    this.baseUrl = baseUrl;
  }

  buildHeaders() {
    const headers = { 'Content-Type': 'application/json' };
    const requestId = requestStore.getStore()?.requestId;
    if (requestId) headers['x-request-id'] = requestId;
    return headers;
  }

  /**
   * 取得歌詞（翻譯或原文，快取邏輯在 companion 內）。
   * @returns {Promise<{text: string, cached: boolean, provider: string, source?: string, translated?: boolean}>}
   */
  async fetchLyrics({ artistName, trackName, trackId, translate = false, refresh = false }) {
    const response = await fetch(`${this.baseUrl}/api/lyrics`, {
      method: 'POST',
      headers: this.buildHeaders(),
      body: JSON.stringify({ artistName, trackName, trackId: trackId ?? null, translate, refresh })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`歌詞服務回應異常 (${response.status}): ${errorBody}`);
    }

    return response.json();
  }

  /** 清除單曲所有快取檔 */
  async clearCache({ artistName, trackName }) {
    const response = await fetch(`${this.baseUrl}/api/lyrics`, {
      method: 'DELETE',
      headers: this.buildHeaders(),
      body: JSON.stringify({ artistName, trackName })
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`歌詞快取清除失敗 (${response.status}): ${errorBody}`);
    }

    return response.json();
  }

  /** 健康檢查 — 確認 lyrics-vault-service 是否可達 */
  async isHealthy() {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`, {
        signal: AbortSignal.timeout(3000)
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export const lyricsClient = new LyricsClient();
