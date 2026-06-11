/**
 * =====================================================================
 * ✅ demo:verify:lyrics — 核心服務 ↔ lyrics-vault-service 的跨服務驗證
 * =====================================================================
 * 優先使用真實姊妹 repo ../lyrics-vault-service；不存在（或 FORCE_MOCK_LYRICS=true）
 * 時退回內建 mock（tests/fixtures/mock-lyrics-service.js）。
 * 不論對面是誰，回應都必須通過 contracts/lyrics-handoff.schema.json —
 * 這是「mock 與真實服務悄悄漂移」的偵測點。
 * =====================================================================
 */
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { loadLyricsHandoffSchema, assertMatchesDefinition } from '../src/services/contract-validator.js';

const handoffSchema = loadLyricsHandoffSchema();

const musicRepoDir = path.resolve('.');
const lyricsRepoDir = path.resolve('..', 'lyrics-vault-service');
const bundledMockScript = path.join(musicRepoDir, 'tests', 'fixtures', 'mock-lyrics-service.js');

const externalLyricsServer = path.join(lyricsRepoDir, 'server.js');
const useExternalService = process.env.FORCE_MOCK_LYRICS === 'true' ? false : fs.existsSync(externalLyricsServer);
const musicPort = 3431;
const lyricsPort = 3432;
const lyricsUrl = `http://127.0.0.1:${lyricsPort}`;
const musicUrl = `http://127.0.0.1:${musicPort}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnServer({ cwd, script, env, name }) {
  const child = spawn(process.execPath, [script], {
    cwd,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[${name}] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[${name}] ${chunk}`));
  return child;
}

async function waitForJson(url, { timeoutMs = 15000, intervalMs = 250, validate } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.json();
        if (!validate || validate(json)) return json;
      }
    } catch {}
    await sleep(intervalMs);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function terminate(child) {
  if (!child || child.killed) return;
  child.kill('SIGTERM');
  await sleep(300);
  if (!child.killed) child.kill('SIGKILL');
}

let lyricsChild;
let musicChild;

try {
  // 1. 拉起 lyrics 服務（真實 repo 或內建 mock）
  if (useExternalService) {
    console.log(`使用真實姊妹 repo: ${lyricsRepoDir}`);
    lyricsChild = spawnServer({
      cwd: lyricsRepoDir,
      script: 'server.js',
      // 翻譯 provider 不需要真的在線：本驗證只打 translate:false 的原文路徑與健康檢查，
      // 並以 LYRICS_VAULT_DIR 指向暫存目錄避免污染真實 vault
      env: { PORT: String(lyricsPort), LYRICS_VAULT_DIR: path.join(musicRepoDir, 'data', 'verify-lyrics-vault') },
      name: 'lyrics-vault-service'
    });
  } else {
    console.log('姊妹 repo 不存在（或 FORCE_MOCK_LYRICS=true）→ 使用內建 mock');
    lyricsChild = spawnServer({
      cwd: musicRepoDir,
      script: bundledMockScript,
      env: { PORT: String(lyricsPort) },
      name: 'mock-lyrics-service'
    });
  }

  const health = await waitForJson(`${lyricsUrl}/healthz`);
  assertMatchesDefinition(handoffSchema, 'healthResponse', health, '[verify] healthz 回應');
  console.log('✓ lyrics 服務健康檢查通過契約驗證');

  // 2. 拉起核心服務並指向 lyrics 服務
  musicChild = spawnServer({
    cwd: musicRepoDir,
    script: 'server.js',
    env: { PORT: String(musicPort), LYRICS_SERVICE_URL: lyricsUrl, NODE_ENV: 'development' },
    name: 'music-release-agent'
  });
  await waitForJson(`${musicUrl}/healthz`);

  // 3. 核心 /api/lyrics/health 應回報 reachable
  const proxyHealth = await waitForJson(`${musicUrl}/api/lyrics/health`, {
    validate: (json) => json.reachable === true
  });
  console.log(`✓ 核心服務回報 lyrics 服務 reachable（${proxyHealth.url}）`);

  // 4. 透過核心 proxy 取得歌詞原文（translate:false → 不需要 LLM 憑證）
  const lyricsResponse = await fetch(`${musicUrl}/api/lyrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artistName: 'Verify Artist', trackName: 'Verify Song', translate: false })
  });
  if (!lyricsResponse.ok) {
    throw new Error(`核心 proxy /api/lyrics 失敗 (${lyricsResponse.status}): ${await lyricsResponse.text()}`);
  }
  const lyricsJson = await lyricsResponse.json();
  assertMatchesDefinition(handoffSchema, 'lyricsResponse', lyricsJson, '[verify] /api/lyrics 回應');
  console.log(`✓ /api/lyrics 回應通過契約驗證（provider=${lyricsJson.provider}, source=${lyricsJson.source}）`);

  // 5. 缺欄位 → 核心服務應在轉發前擋下（400）
  const badResponse = await fetch(`${musicUrl}/api/lyrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artistName: 'No Track Name' })
  });
  if (badResponse.status !== 400) {
    throw new Error(`缺 trackName 應回 400，實際為 ${badResponse.status}`);
  }
  console.log('✓ 缺欄位請求被擋下（400）');

  // 6. 清快取走完整來回
  const clearResponse = await fetch(`${musicUrl}/api/lyrics`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artistName: 'Verify Artist', trackName: 'Verify Song' })
  });
  if (!clearResponse.ok) {
    throw new Error(`DELETE /api/lyrics 失敗 (${clearResponse.status})`);
  }
  assertMatchesDefinition(handoffSchema, 'clearResponse', await clearResponse.json(), '[verify] 清除回應');
  console.log('✓ DELETE /api/lyrics 回應通過契約驗證');

  console.log(`\ndemo:verify:lyrics passed（對面是${useExternalService ? '真實 lyrics-vault-service' : '內建 mock'}）`);
} catch (error) {
  console.error(`\ndemo:verify:lyrics FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  await terminate(musicChild);
  await terminate(lyricsChild);
  fs.rmSync(path.join(musicRepoDir, 'data', 'verify-lyrics-vault'), { recursive: true, force: true });
}
