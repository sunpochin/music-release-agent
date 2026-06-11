/**
 * =====================================================================
 * 🤝 Contract Tests — handoff 契約單一事實來源的可執行證明
 * =====================================================================
 * 兩個層次：
 *   1. Schema 層：contracts/social-handoff.schema.json + 零依賴驗證器
 *      對「合法/非法」樣本的判定（正常、模糊、失敗三類情境）
 *   2. 實作層：把內建 mock 真的跑起來，驗證其「活的」HTTP 回應
 *      逐一通過同一份 schema — mock 若與契約漂移，這裡會先抓到
 * 全部離線、確定性執行。
 * =====================================================================
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  loadHandoffSchema,
  validateAgainstDefinition,
  assertMatchesDefinition
} from '../../src/services/contract-validator.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const mockScript = path.join(repoRoot, 'tests', 'fixtures', 'mock-social-service.js');

const schema = loadHandoffSchema();

describe('契約 Schema：publishRequest（正常/模糊/失敗）', () => {
  it('合法請求通過（含可選欄位）', () => {
    const result = validateAgainstDefinition(schema, 'publishRequest', {
      caption: 'hello',
      image: null,
      platforms: ['threads', 'bluesky']
    });
    expect(result.valid).toBe(true);
  });

  it('最小合法請求通過（只有 caption）', () => {
    expect(validateAgainstDefinition(schema, 'publishRequest', { caption: 'x' }).valid).toBe(true);
  });

  it('缺 caption 失敗，錯誤訊息含欄位路徑', () => {
    const result = validateAgainstDefinition(schema, 'publishRequest', { platforms: ['threads'] });
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('caption');
  });

  it('caption 為空字串失敗（minLength）', () => {
    expect(validateAgainstDefinition(schema, 'publishRequest', { caption: '' }).valid).toBe(false);
  });

  it('platforms 為空陣列失敗（minItems）', () => {
    const result = validateAgainstDefinition(schema, 'publishRequest', { caption: 'x', platforms: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('platforms');
  });

  it('platforms 含非字串元素失敗，錯誤訊息含索引', () => {
    const result = validateAgainstDefinition(schema, 'publishRequest', { caption: 'x', platforms: ['threads', 42] });
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('platforms[1]');
  });

  it('image 同時允許 string 與 null（union type）', () => {
    expect(validateAgainstDefinition(schema, 'publishRequest', { caption: 'x', image: 'base64data' }).valid).toBe(true);
    expect(validateAgainstDefinition(schema, 'publishRequest', { caption: 'x', image: null }).valid).toBe(true);
    expect(validateAgainstDefinition(schema, 'publishRequest', { caption: 'x', image: 123 }).valid).toBe(false);
  });
});

describe('契約 Schema：回應格式（accepted/status/health）', () => {
  it('合法 202 回應通過；status 非 "queued" 失敗', () => {
    expect(validateAgainstDefinition(schema, 'acceptedResponse', { jobId: 'abc', status: 'queued' }).valid).toBe(true);
    expect(validateAgainstDefinition(schema, 'acceptedResponse', { jobId: 'abc', status: 'done' }).valid).toBe(false);
  });

  it('合法狀態回應通過（含巢狀 postResult $ref 驗證）', () => {
    const result = validateAgainstDefinition(schema, 'statusResponse', {
      jobId: 'abc',
      status: 'completed',
      results: [{ platform: 'threads', success: true, postedAt: '2026-06-11T00:00:00Z' }]
    });
    expect(result.valid).toBe(true);
  });

  it('results 內缺 success 失敗，錯誤路徑指向巢狀欄位', () => {
    const result = validateAgainstDefinition(schema, 'statusResponse', {
      jobId: 'abc',
      status: 'completed',
      results: [{ platform: 'threads' }]
    });
    expect(result.valid).toBe(false);
    expect(result.errors.join()).toContain('results[0]');
    expect(result.errors.join()).toContain('success');
  });

  it('未知 status 枚舉值失敗', () => {
    const result = validateAgainstDefinition(schema, 'statusResponse', {
      jobId: 'abc',
      status: 'in_flight',
      results: []
    });
    expect(result.valid).toBe(false);
  });

  it('assertMatchesDefinition 失敗時丟出含逐欄位明細的錯誤', () => {
    expect(() => assertMatchesDefinition(schema, 'acceptedResponse', {}, 'test')).toThrow(/jobId/);
  });
});

describe('契約實作層：內建 mock 的活回應必須通過同一份 schema', () => {
  let mockProcess;
  let baseUrl;

  beforeAll(async () => {
    const port = 3500 + Math.floor(Math.random() * 400);
    baseUrl = `http://127.0.0.1:${port}`;
    mockProcess = spawn(process.execPath, [mockScript], {
      env: { ...process.env, PORT: String(port), MOCK_JOB_DELAY_MS: '50' },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    // 等待 mock ready
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try {
        const response = await fetch(`${baseUrl}/healthz`);
        if (response.ok) return;
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    throw new Error('mock-social-service did not become healthy in time');
  }, 15000);

  afterAll(() => {
    mockProcess?.kill('SIGTERM');
  });

  it('GET /healthz 回應符合 healthResponse', async () => {
    const body = await (await fetch(`${baseUrl}/healthz`)).json();
    expect(validateAgainstDefinition(schema, 'healthResponse', body).valid).toBe(true);
  });

  it('POST /api/posts 合法請求 → 202 且符合 acceptedResponse', async () => {
    const response = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: 'contract test', platforms: ['threads'] })
    });
    expect(response.status).toBe(202);
    const body = await response.json();
    expect(validateAgainstDefinition(schema, 'acceptedResponse', body).valid).toBe(true);
  });

  it('違約請求（caption 空字串）→ 400 且錯誤回應符合 errorResponse', async () => {
    const response = await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: '' })
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(validateAgainstDefinition(schema, 'errorResponse', body).valid).toBe(true);
    expect(body.error).toContain('caption');
  });

  it('任務完成後 GET /api/posts/:jobId 回應符合 statusResponse', async () => {
    const publishBody = await (await fetch(`${baseUrl}/api/posts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: 'lifecycle test', platforms: ['threads', 'bluesky'] })
    })).json();

    // 輪詢直到完成（mock 延遲 50ms）
    let job;
    const deadline = Date.now() + 5000;
    while (Date.now() < deadline) {
      job = await (await fetch(`${baseUrl}/api/posts/${publishBody.jobId}`)).json();
      if (job.status === 'completed') break;
      await new Promise((r) => setTimeout(r, 50));
    }

    expect(job.status).toBe('completed');
    const result = validateAgainstDefinition(schema, 'statusResponse', job);
    expect(result.errors).toEqual([]);
    expect(job.results.map((r) => r.platform)).toEqual(['threads', 'bluesky']);
  });

  it('未知 jobId → 404 且符合 errorResponse', async () => {
    const response = await fetch(`${baseUrl}/api/posts/nonexistent-id`);
    expect(response.status).toBe(404);
    const body = await response.json();
    expect(validateAgainstDefinition(schema, 'errorResponse', body).valid).toBe(true);
  });
});
