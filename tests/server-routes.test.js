/**
 * =====================================================================
 * 🌐 API 層測試 — createApp() 以 ephemeral port 啟動，打真實 HTTP
 * =====================================================================
 * 覆蓋 server 路由的三類情境（全部離線、不需任何 companion 或憑證）：
 *   正常：healthz、/api 索引、API 404 行為
 *   模糊：缺欄位請求被擋在轉發之前（400）
 *   失敗：companion 不可達 → 穩定 502 + readyz degraded（降級不是崩潰）
 * =====================================================================
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp } from '../src/app.js';

let server;
let baseUrl;

beforeAll(async () => {
  // 把兩個 companion 指向必然不存在的位址，使「不可達」行為確定性可測
  process.env.SOCIAL_SERVICE_URL = 'http://127.0.0.1:39998';
  process.env.LYRICS_SERVICE_URL = 'http://127.0.0.1:39999';

  server = createApp().listen(0); // ephemeral port，不與其他測試或服務衝突
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => {
  server?.close();
});

describe('API 層：正常路徑', () => {
  it('GET /healthz 回 200 ok（liveness 與依賴無關）', async () => {
    const res = await fetch(`${baseUrl}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeTruthy();
  });

  it('GET /api 回服務索引', async () => {
    const res = await fetch(`${baseUrl}/api`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.endpoints.healthz).toBe('/healthz');
  });

  it('回應帶有 x-request-id correlation header', async () => {
    const res = await fetch(`${baseUrl}/healthz`, { headers: { 'x-request-id': 'test-corr-123' } });
    expect(res.headers.get('x-request-id')).toBe('test-corr-123');
  });

  it('未知 API 路徑回 404 JSON（不吐 SPA HTML）', async () => {
    const res = await fetch(`${baseUrl}/api/no-such-route`);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('API route not found');
  });
});

describe('API 層：模糊輸入（缺欄位在轉發前被擋下）', () => {
  it('POST /api/lyrics 缺 trackName → 400，不打 companion', async () => {
    const res = await fetch(`${baseUrl}/api/lyrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistName: 'Only Artist' })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Missing');
  });

  it('POST /api/social/publish 缺 caption → 400 違反 handoff 契約', async () => {
    const res = await fetch(`${baseUrl}/api/social/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platforms: ['threads'] })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('契約');
  });

  it('GET /api/review 缺參數 → 400', async () => {
    const res = await fetch(`${baseUrl}/api/review`);
    expect(res.status).toBe(400);
  });
});

describe('API 層：companion 不可達的降級（502，不是 crash）', () => {
  it('POST /api/lyrics → 502 + error 欄位', async () => {
    const res = await fetch(`${baseUrl}/api/lyrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ artistName: 'A', trackName: 'B', translate: false })
    });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toContain('歌詞服務不可達');
  });

  it('GET /api/lyrics/health 回 reachable: false', async () => {
    const res = await fetch(`${baseUrl}/api/lyrics/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reachable).toBe(false);
    expect(body.service).toBe('lyrics-vault-service');
  });

  it('POST /api/social/publish（合法請求）→ 502', async () => {
    const res = await fetch(`${baseUrl}/api/social/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: 'hello', platforms: ['threads'], mode: 'mock' })
    });
    expect(res.status).toBe(502);
  });

  it('GET /readyz 回報 degraded 並標明兩個 companion unreachable，核心仍 200', async () => {
    const res = await fetch(`${baseUrl}/readyz`);
    const body = await res.json();
    // coreReady 取決於 mock data 存在（repo 內建），companion 全掛 → degraded
    expect(body.checks.socialPostService).toBe('unreachable');
    expect(body.checks.lyricsVaultService).toBe('unreachable');
    if (body.coreReady) {
      expect(res.status).toBe(200);
      expect(body.status).toBe('degraded');
    } else {
      expect(res.status).toBe(503);
      expect(body.status).toBe('not_ready');
    }
  });
});
