/**
 * =====================================================================
 * 🎭 Mock lyrics-vault-service（零依賴、單檔、純 Node http）
 * =====================================================================
 * 目的：讓 `npm run demo:verify:lyrics` 在沒有姊妹 repo
 * `../lyrics-vault-service` 的環境（例如 evaluator 只 clone 本 repo）
 * 也能完整驗證「核心服務 → 歌詞服務」的 handoff 契約。
 *
 * 實作的契約（與真實 lyrics-vault-service 對齊）：
 *   GET    /healthz     → 200 { status: 'ok', service: 'lyrics-vault-service' }
 *   POST   /api/lyrics  → 200 { text, cached, provider, source, translated }
 *                         （第二次同曲請求回 cached: true，模擬 vault hit）
 *   DELETE /api/lyrics  → 200 { success, clearedCount }
 * 回應送出前以 contracts/lyrics-handoff.schema.json 自我檢查 —
 * mock 與真實服務漂移在此被抓到。
 * =====================================================================
 */
import http from 'http';
import {
  loadLyricsHandoffSchema,
  validateAgainstDefinition,
  assertMatchesDefinition
} from '../../src/services/contract-validator.js';

const PORT = Number(process.env.PORT || 3413);
const handoffSchema = loadLyricsHandoffSchema();

// 模擬 vault：記住處理過的曲目，第二次請求回 cached: true
const vault = new Map();

function sendJson(res, statusCode, body) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

/** 自我檢查：mock 自己的回應若違反契約，立刻大聲失敗（500），而非默默漂移 */
function sendContractJson(res, statusCode, definitionName, body) {
  try {
    assertMatchesDefinition(handoffSchema, definitionName, body, '[mock-lyrics-service] 回應');
  } catch (error) {
    console.error(error.message);
    return sendJson(res, 500, { error: `mock contract self-check failed: ${error.message}` });
  }
  sendJson(res, statusCode, body);
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
    return sendContractJson(res, 200, 'healthResponse', {
      status: 'ok',
      service: 'lyrics-vault-service',
      mode: 'bundled-mock'
    });
  }

  if (req.method === 'POST' && url.pathname === '/api/lyrics') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'invalid JSON body' });
    }

    const requestCheck = validateAgainstDefinition(handoffSchema, 'lyricsRequest', body);
    if (!requestCheck.valid) {
      return sendJson(res, 400, { error: `請求違反 lyrics handoff 契約: ${requestCheck.errors.join('; ')}` });
    }

    const key = `${body.artistName}::${body.trackName}`;
    const cached = vault.has(key) && !body.refresh;
    vault.set(key, true);

    return sendContractJson(res, 200, 'lyricsResponse', {
      text: body.translate
        ? `### 歌詞對照\nMock lyric line\n模擬翻譯行（${body.trackName}）`
        : `### 歌詞原文\n\nMock lyric line for ${body.trackName}`,
      cached,
      provider: body.translate ? 'mock-provider' : 'raw',
      source: 'lrclib',
      translated: Boolean(body.translate)
    });
  }

  if (req.method === 'DELETE' && url.pathname === '/api/lyrics') {
    let body;
    try {
      body = await readJsonBody(req);
    } catch {
      return sendJson(res, 400, { error: 'invalid JSON body' });
    }

    const key = `${body.artistName}::${body.trackName}`;
    const existed = vault.delete(key);
    return sendContractJson(res, 200, 'clearResponse', {
      success: true,
      clearedCount: existed ? 2 : 0
    });
  }

  sendJson(res, 404, { error: 'not found' });
});

server.listen(PORT, () => {
  console.log(`[mock-lyrics-service] listening on http://localhost:${PORT}`);
});
