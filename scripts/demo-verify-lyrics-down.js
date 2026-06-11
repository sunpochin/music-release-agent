/**
 * ✅ demo:verify:lyrics:down — lyrics-vault-service 不可達時的降級驗證
 *
 * 驗證：companion 掛掉時核心服務不崩、/api/lyrics 穩定回 502、
 * /api/lyrics/health 回報 reachable:false、/readyz 顯示 degraded。
 */
import { spawn } from 'child_process';
import path from 'path';

const musicRepoDir = path.resolve('.');
const musicPort = 3441;
const unreachableLyricsUrl = 'http://127.0.0.1:3442';
const musicUrl = `http://127.0.0.1:${musicPort}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnMusicServer() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: musicRepoDir,
    env: {
      ...process.env,
      PORT: String(musicPort),
      LYRICS_SERVICE_URL: unreachableLyricsUrl,
      NODE_ENV: 'development'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.stdout.on('data', (chunk) => process.stdout.write(`[music-release-agent] ${chunk}`));
  child.stderr.on('data', (chunk) => process.stderr.write(`[music-release-agent] ${chunk}`));
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

let musicChild;

try {
  musicChild = spawnMusicServer();
  await waitForJson(`${musicUrl}/healthz`);
  console.log('✓ 核心服務啟動（lyrics 服務故意指向不存在的位址）');

  // 1. /api/lyrics/health 回報 reachable: false
  const health = await waitForJson(`${musicUrl}/api/lyrics/health`, {
    validate: (json) => json.reachable === false
  });
  console.log(`✓ /api/lyrics/health 回報 reachable: false（${health.url}）`);

  // 2. /api/lyrics 穩定回 502，核心不崩
  const lyricsResponse = await fetch(`${musicUrl}/api/lyrics`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ artistName: 'A', trackName: 'B', translate: false })
  });
  if (lyricsResponse.status !== 502) {
    throw new Error(`lyrics 服務不可達時 /api/lyrics 應回 502，實際為 ${lyricsResponse.status}`);
  }
  const errorBody = await lyricsResponse.json();
  if (!errorBody.error) {
    throw new Error('502 回應應包含 error 欄位');
  }
  console.log('✓ /api/lyrics 穩定回 502（含 error 訊息）');

  // 3. /readyz 顯示 degraded 且標明 lyricsVaultService unreachable
  const readyzResponse = await fetch(`${musicUrl}/readyz`);
  const readyz = await readyzResponse.json();
  if (readyz.status !== 'degraded') {
    throw new Error(`/readyz 應顯示 degraded，實際為 ${readyz.status}`);
  }
  if (readyz.checks?.lyricsVaultService !== 'unreachable') {
    throw new Error(`/readyz checks.lyricsVaultService 應為 unreachable，實際為 ${readyz.checks?.lyricsVaultService}`);
  }
  console.log('✓ /readyz 顯示 degraded，lyricsVaultService: unreachable');

  // 4. 核心服務本體仍健康
  await waitForJson(`${musicUrl}/healthz`);
  console.log('✓ 核心服務未崩潰');

  console.log('\ndemo:verify:lyrics:down passed');
} catch (error) {
  console.error(`\ndemo:verify:lyrics:down FAILED: ${error.message}`);
  process.exitCode = 1;
} finally {
  await terminate(musicChild);
}
