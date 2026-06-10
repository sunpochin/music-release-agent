import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

const musicRepoDir = path.resolve('.');
const socialRepoDir = path.resolve('..', 'social-post-service');
const bundledMockScript = path.join(musicRepoDir, 'tests', 'fixtures', 'mock-social-service.js');

// 優先使用真實的姊妹 repo；不存在時退回內建 mock，讓本 repo 可以獨立驗證 handoff 契約
const externalSocialServer = path.join(socialRepoDir, 'server.js');
const useExternalSocialService = fs.existsSync(externalSocialServer);
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

    if (readyReport.status !== 'ok') {
      throw new Error(`expected readyz status "ok", got "${readyReport.status}"`);
    }

    if (readyReport.checks.socialPostService !== 'reachable') {
      throw new Error('expected readyz to report reachable social-post-service');
    }

    const publishResponse = await fetch(`${musicUrl}/api/social/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption: 'Integration proof from music-release-agent to social-post-service',
        platforms: ['threads']
      })
    });

    if (publishResponse.status !== 202) {
      const body = await publishResponse.text();
      throw new Error(`publish endpoint returned ${publishResponse.status}: ${body}`);
    }

    const queuedJob = await publishResponse.json();
    if (!queuedJob.jobId) {
      throw new Error('publish response did not include jobId');
    }

    console.log(`Queued job ${queuedJob.jobId}; polling status through music-release-agent...`);

    const completedJob = await waitForJobCompletion(queuedJob.jobId);
    if (!Array.isArray(completedJob.results) || completedJob.results.length === 0) {
      throw new Error('completed job did not include posting results');
    }

    const firstResult = completedJob.results[0];
    if (!firstResult.success || firstResult.platform !== 'threads') {
      throw new Error('completed job result was missing success proof for threads');
    }

    console.log('\nIntegration proof passed:');
    console.log('- social-post-service became healthy on a dedicated test port');
    console.log('- readyz reported the app as fully ready with reachable dependency state');
    console.log('- music-release-agent forwarded publish requests to the companion service');
    console.log('- publish endpoint returned 202 Accepted with a jobId');
    console.log('- status polling through music-release-agent observed the job complete');
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
