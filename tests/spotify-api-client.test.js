import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SpotifyApiClient } from '../src/services/spotify-api-client.js';

// 模擬 undici.fetch
const mockFetch = vi.fn();
vi.mock('undici', () => ({
  fetch: (...args) => mockFetch(...args)
}));

describe('SpotifyApiClient 單元測試', () => {
  let mockStateService;
  let client;

  beforeEach(() => {
    vi.clearAllMocks();

    mockStateService = {
      isSpotifyCooldownActive: vi.fn().mockResolvedValue(false),
      recordSpotify429: vi.fn().mockResolvedValue(undefined)
    };

    client = new SpotifyApiClient(mockStateService, {
      tokenProvider: async () => 'fake-token',
      minIntervalMs: 0 // 測試時關閉時間延遲以加快執行速度
    });
  });

  it('應正確發送請求並附帶 Authorization 標頭', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ data: 'hello' })
    });

    const res = await client.request('me');
    expect(res).toEqual({ data: 'hello' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.spotify.com/v1/me',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer fake-token'
        })
      })
    );
  });

  it('如果狀態為降級冷卻保護，應直接拋出錯誤', async () => {
    mockStateService.isSpotifyCooldownActive.mockResolvedValue(true);

    await expect(client.request('me')).rejects.toThrow('Spotify API 處於自動降級冷卻保護中');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('遭遇輕微 429 時，應記錄 429 並嘗試在 Retry-After 後重試', async () => {
    // 第一次回傳 429，第二次回傳 200
    mockFetch
      .mockResolvedValueOnce({
        status: 429,
        headers: {
          get: (name) => {
            if (name === 'retry-after') return '1';
            return null;
          }
        },
        text: async () => 'Too many requests'
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ success: true })
      });

    const res = await client.request('me', 'GET', null, null, 1);
    expect(res).toEqual({ success: true });
    expect(mockStateService.recordSpotify429).toHaveBeenCalled();
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('遭遇重度 429 (Retry-After > 10s) 時，應直接拋出錯誤以觸發降級，不進行重試', async () => {
    mockFetch.mockResolvedValue({
      status: 429,
      headers: {
        get: (name) => {
          if (name === 'retry-after') return '15'; // 15 秒，大於 10 秒
          return null;
        }
      },
      text: async () => 'Too many requests'
    });

    await expect(client.request('me', 'GET', null, null, 1)).rejects.toThrow('Spotify 伺服器重度頻率限制');
    expect(mockStateService.recordSpotify429).toHaveBeenCalled();
    // 應該只呼叫一次，直接拋出，不進行重試
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
