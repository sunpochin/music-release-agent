import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { loadHandoffSchema, assertMatchesDefinition } from '../src/services/contract-validator.js';

// 不論對面是真實 companion 還是內建 mock，回應都必須通過同一份契約 schema —
// 這就是「mock 與真實服務悄悄漂移」的偵測點。
const handoffSchema = loadHandoffSchema();

const musicRepoDir = path.resolve('.');
const socialRepoDir = path.resolve('..', 'social-post-service');
const bundledMockScript = path.join(musicRepoDir, 'tests', 'fixtures', 'mock-social-service.js');

// 優先使用真實的姊妹 repo；不存在時退回內建 mock，讓本 repo 可以獨立驗證 handoff 契約
const externalSocialServer = path.join(socialRepoDir, 'server.js');
// 若設定 FORCE_MOCK_SOCIAL 環境變數，則強制使用內建的 mock 服務
const useExternalSocialService = process.env.FORCE_MOCK_SOCIAL === 'true' ? false : fs.existsSync(externalSocialServer);
const musicPort = 3411;
const socialPort = 3412;
const socialUrl = `http://127.0.0.1:${socialPort}`;
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

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[${name}] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[${name}] ${chunk}`);
  });

  return child;
}

async function waitForJson(url, { timeoutMs = 15000, intervalMs = 250, validate } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        const json = await response.json();
        if (!validate || validate(json)) {
          return json;
        }
      }
    } catch {}

    await sleep(intervalMs);
  }

  throw new Error(`timed out waiting for ${url}`);
}

async function waitForJobCompletion(jobId, { timeoutMs = 20000, intervalMs = 500 } = {}) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    try {
      // 【小朋友解釋法】：
      // 輪詢狀態打電話 (fetch) 時，如果遇到短暫的收訊不好（網路瞬斷），不要直接大哭崩潰（腳本當機）。
      // 我們加上防摔保護殼 (try-catch)，這次沒問成功就等一下下再打，直到時間超時為止！
      const response = await fetch(`${musicUrl}/api/social/status/${jobId}`);
      if (response.ok) {
        const job = await response.json();
        if (job.status === 'completed') {
          return job;
        }
        if (job.status === 'failed') {
          throw new Error('social job ended in failed status');
        }
      }
    } catch (err) {
      // 忽略輪詢期間的暫時性網路錯誤或伺服器回應異常，等待下一次輪詢
      if (err.message === 'social job ended in failed status') {
        throw err;
      }
    }

    await sleep(intervalMs);
  }

  throw new Error(`timed out waiting for job completion: ${jobId}`);
}

async function terminate(child, name) {
  if (!child || child.killed) {
    return;
  }

  child.kill('SIGTERM');
  await new Promise((resolve) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      resolve();
    }, 3000);

    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });

  console.log(`[cleanup] stopped ${name}`);
}

async function main() {
  let socialServer;
  let musicServer;

  try {
    console.log('== demo:verify:social ==');
    if (useExternalSocialService) {
      console.log(`Using external companion repo: ${socialRepoDir}`);
    } else {
      console.log('External ../social-post-service not found — falling back to bundled mock');
      console.log(`(${path.relative(musicRepoDir, bundledMockScript)} implements the same handoff contract)`);
    }
    console.log('Spawning social-post-service and music-release-agent for handoff verification...\n');

    socialServer = spawnServer({
      cwd: useExternalSocialService ? socialRepoDir : musicRepoDir,
      script: useExternalSocialService ? 'server.js' : bundledMockScript,
      env: {
        PORT: String(socialPort),
        STRATEGY: 'mock'
      },
      name: useExternalSocialService ? 'social-post-service' : 'social-post-service(mock)'
    });

    await waitForJson(`${socialUrl}/healthz`, {
      validate: (json) => json.status === 'ok' && json.service === 'social-post-service'
    });

    musicServer = spawnServer({
      cwd: musicRepoDir,
      script: 'server.js',
      env: {
        PORT: String(musicPort),
        SOCIAL_SERVICE_URL: socialUrl
      },
      name: 'music-release-agent'
    });

    await waitForJson(`${musicUrl}/healthz`, {
      validate: (json) => json.status === 'ok'
    });

    const readyReport = await waitForJson(`${musicUrl}/readyz`, {
      validate: (json) => json.coreReady === true
    });

    // 本驗證只起 social companion；lyrics companion 不在線會讓整體 status 為 degraded，
    // 這是正確語義 — 此處斷言的是「social 這條依賴」的可達性，而非全部 companion
    if (readyReport.status !== 'ok' && readyReport.status !== 'degraded') {
      throw new Error(`expected readyz status "ok" or "degraded", got "${readyReport.status}"`);
    }

    if (readyReport.checks.socialPostService !== 'reachable') {
      throw new Error('expected readyz to report reachable social-post-service');
    }

    const publishResponse = await fetch(`${musicUrl}/api/social/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption: 'Integration proof from music-release-agent to social-post-service',
        platforms: ['threads'],
        // 本驗證以 STRATEGY=mock 拉起 companion，必須明示 mock 模式 —
        // 未指定時 companion 預設 live 並拒絕 mock strategy（503）
        mode: 'mock'
      })
    });

    if (publishResponse.status !== 202) {
      const body = await publishResponse.text();
      throw new Error(`publish endpoint returned ${publishResponse.status}: ${body}`);
    }

    const queuedJob = await publishResponse.json();
    // 契約驗證：202 回應必須符合 contracts/social-handoff.schema.json 的 acceptedResponse
    assertMatchesDefinition(handoffSchema, 'acceptedResponse', queuedJob, '202 publish');

    console.log(`Queued job ${queuedJob.jobId}; polling status through music-release-agent...`);

    const completedJob = await waitForJobCompletion(queuedJob.jobId);
    // 契約驗證：狀態回應必須符合 statusResponse（含 results 內每筆 postResult 的結構）
    assertMatchesDefinition(handoffSchema, 'statusResponse', completedJob, 'job status');
    if (completedJob.results.length === 0) {
      throw new Error('completed job did not include posting results');
    }

    const firstResult = completedJob.results[0];
    if (!firstResult.success || firstResult.platform !== 'threads') {
      throw new Error('completed job result was missing success proof for threads');
    }

    console.log('\nIntegration proof passed:');
    console.log('- social-post-service became healthy on a dedicated test port');
    console.log('- readyz reported coreReady with reachable social-post-service');
    console.log('- music-release-agent forwarded publish requests to the companion service');
    console.log('- publish endpoint returned 202 Accepted matching the handoff contract schema');
    console.log('- status polling observed job completion matching the handoff contract schema');
    console.log('\ndemo:verify:social passed');
  } finally {
    await terminate(musicServer, 'music-release-agent');
    await terminate(socialServer, 'social-post-service');
  }
}

main().catch((error) => {
  console.error(`\ndemo:verify:social failed: ${error.message}`);
  process.exit(1);
});
