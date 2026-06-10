/**
 * =====================================================================
 * 🎭 Mock social-post-service（零依賴、單檔、純 Node http）
 * =====================================================================
 * 目的：讓 `npm run demo:verify:social` 在沒有姊妹 repo
 * `../social-post-service` 的環境（例如 evaluator 只 clone 本 repo）
 * 也能完整驗證「核心服務 → 發文服務」的 handoff 契約。
 *
 * 實作的契約（與真實 social-post-service 對齊）：
 *   GET  /healthz          → 200 { status: 'ok', service: 'social-post-service' }
 *   POST /api/posts        → 202 { jobId, status: 'queued' }（缺 caption → 400）
 *   GET  /api/posts/:jobId → 200 { jobId, status, results[] }（未知 jobId → 404）
 *
 * 任務以非同步方式在 ~300ms 後轉為 completed，模擬真實佇列行為。
 * =====================================================================
 */
import http from 'http';
import { randomUUID } from 'crypto';

const PORT = Number(process.env.PORT || 3412);
const JOB_COMPLETION_DELAY_MS = Number(process.env.MOCK_JOB_DELAY_MS || 300);

const jobs = new Map();

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/healthz') {
    return sendJson(res, 200, { status: 'ok', service: 'social-post-service', mode: 'bundled-mock' });
  }

  if (req.method === 'POST' && url.pathname === '/api/posts') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'invalid JSON body' });
    }

    if (!body.caption) {
      return sendJson(res, 400, { error: 'missing required field: caption' });
    }

    const jobId = randomUUID();
    const platforms = Array.isArray(body.platforms) && body.platforms.length > 0
      ? body.platforms
      : ['threads'];

    jobs.set(jobId, { jobId, status: 'queued', results: [] });

    // 模擬非同步佇列：稍後將任務標記為完成
    setTimeout(() => {
      jobs.set(jobId, {
        jobId,
        status: 'completed',
        results: platforms.map((platform) => ({
          platform,
          success: true,
          postedAt: new Date().toISOString()
        }))
      });
    }, JOB_COMPLETION_DELAY_MS);

    return sendJson(res, 202, { jobId, status: 'queued' });
  }

  const statusMatch = url.pathname.match(/^\/api\/posts\/([\w-]+)$/);
  if (req.method === 'GET' && statusMatch) {
    const job = jobs.get(statusMatch[1]);
    if (!job) {
      return sendJson(res, 404, { error: `unknown jobId: ${statusMatch[1]}` });
    }
    return sendJson(res, 200, job);
  }

  sendJson(res, 404, { error: `no route for ${req.method} ${url.pathname}` });
});

server.listen(PORT, () => {
  console.log(`[mock-social-service] listening on port ${PORT} (bundled mock, no network needed)`);
});
