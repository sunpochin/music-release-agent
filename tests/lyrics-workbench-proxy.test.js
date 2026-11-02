/**
 * 檔案用途：驗證獨立歌詞頁跨服務轉發、錯誤保留與契約防漂移。
 * 所在層：tests；主要關聯：src/routes/lyrics.js、contracts/lyrics-handoff.schema.json。
 */
import express from 'express';
import { beforeAll, afterAll, describe, it, expect, vi, afterEach } from 'vitest';
import { lyricsRoutes } from '../src/routes/lyrics.js';

let server, url;
const realFetch = globalThis.fetch;
beforeAll(async () => {
  const app = express(); app.use(express.json()); app.use(lyricsRoutes());
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}/api/lyrics`;
});
afterEach(() => vi.unstubAllGlobals());
afterAll(() => new Promise(resolve => server.close(resolve)));
const post = (path, data) => realFetch(`${url}/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });

describe('獨立歌詞頁 thin proxy', () => {
  it('不合法請求在核心先擋下，不打 companion', async () => {
    const upstream = vi.fn(); vi.stubGlobal('fetch', upstream);
    expect((await post('search', {})).status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
  it('轉發查歌與來源錯誤，不把來源失敗冒充沒有結果', async () => {
    const upstream = vi.fn().mockResolvedValueOnce(new Response('{"results":[]}', { status: 200 }))
      .mockResolvedValueOnce(new Response('{"error":"來源離線"}', { status: 502 }));
    vi.stubGlobal('fetch', upstream);
    expect(await (await post('search', { trackName: 'Fixture' })).json()).toEqual({ results: [] });
    const failed = await post('search', { trackName: 'Fixture' });
    expect(failed.status).toBe(502); expect(await failed.json()).toEqual({ error: '來源離線' });
  });
  it('回傳格式壞掉或服務離線時，回安全且可恢復的錯誤', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response('{"results":"wrong"}', { status: 200 })).mockRejectedValueOnce(new Error('private provider detail')));
    for (let i = 0; i < 2; i++) {
      const res = await post('search', { trackName: 'Fixture' });
      expect(res.status).toBe(502); expect((await res.json()).error).not.toContain('private');
    }
  });
});
