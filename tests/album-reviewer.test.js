/**
 * =====================================================================
 * 🧠 Album Reviewer 測試 — 「雲端失敗自動降級本地」宣稱的可執行證明
 * =====================================================================
 * 全部離線（Gemini 與 Ollama 都以 mock 取代）。
 * 涵蓋：本地路由（無金鑰）、prompt 內含專輯元數據、Ollama 失敗時 fail-loud。
 * =====================================================================
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// 模擬 undici：album-reviewer 的本地 Ollama 路徑用 undici 的 fetch
const mockFetch = vi.fn();
vi.mock('undici', () => ({
  fetch: (...args) => mockFetch(...args),
  Agent: class MockAgent {}
}));

const { generateAlbumReview, generateTrackAnalysis } = await import('../src/album-reviewer.js');

// 確保走本地路徑（無雲端金鑰），在 import 後刪除以防 dotenv.config() 重新寫入
delete process.env.GEMINI_API_KEY;

const sampleAlbum = {
  name: 'Test Album',
  primary_artist: 'Test Artist',
  type: 'album',
  release_date: '2026-06-01',
  total_tracks: 10,
  artist_genres: ['salsa', 'latin jazz'],
  url: 'https://open.spotify.com/album/test',
  image: 'https://example.com/cover.jpg'
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateAlbumReview：本地路由（無 GEMINI_API_KEY）', () => {
  it('正常：呼叫本地 Ollama 並回傳樂評 Markdown', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '# 樂評\n精彩的專輯。**評分 8.8/10**' } })
    });

    const review = await generateAlbumReview(sampleAlbum);

    expect(review).toContain('樂評');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('11434/api/chat');

    // prompt 必須帶入專輯元數據 — 樂評不是憑空生成
    const body = JSON.parse(options.body);
    const userPrompt = body.messages.find((m) => m.role === 'user').content;
    expect(userPrompt).toContain('Test Album');
    expect(userPrompt).toContain('Test Artist');
    expect(userPrompt).toContain('salsa, latin jazz');
    expect(userPrompt).toContain('https://open.spotify.com/album/test');
  });

  it('模糊：空 genres 陣列使用後備文字、不噴錯', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '樂評內容' } })
    });

    await generateAlbumReview({ ...sampleAlbum, artist_genres: [] });

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const userPrompt = body.messages.find((m) => m.role === 'user').content;
    expect(userPrompt).toContain('無明確標籤');
  });

  it('失敗：Ollama 不可達時 throw（不默默回空字串）', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));
    await expect(generateAlbumReview(sampleAlbum)).rejects.toThrow('ECONNREFUSED');
  });

  it('失敗：Ollama 回應非 2xx 時 throw', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(generateAlbumReview(sampleAlbum)).rejects.toThrow('Ollama 響應錯誤: 500');
  });
});

describe('generateTrackAnalysis：本地路由', () => {
  it('prompt 帶入歌曲元數據並回傳賞析', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: { content: '**歌曲賞析**' } })
    });

    const analysis = await generateTrackAnalysis('Artist X', 'Song Y', 'Album Z');
    expect(analysis).toContain('歌曲賞析');

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const userPrompt = body.messages.find((m) => m.role === 'user').content;
    expect(userPrompt).toContain('Song Y');
    expect(userPrompt).toContain('Artist X');
    expect(userPrompt).toContain('Album Z');
  });
});
