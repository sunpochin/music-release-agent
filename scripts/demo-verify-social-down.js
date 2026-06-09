import { spawn } from 'child_process';
import path from 'path';

const musicRepoDir = path.resolve('.');
const musicPort = 3421;
const unreachableSocialUrl = 'http://127.0.0.1:3422';
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
      SOCIAL_SERVICE_URL: unreachableSocialUrl
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  child.stdout.on('data', (chunk) => {
    process.stdout.write(`[music-release-agent] ${chunk}`);
  });

  child.stderr.on('data', (chunk) => {
    process.stderr.write(`[music-release-agent] ${chunk}`);
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

async function terminate(child) {
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

  console.log('[cleanup] stopped music-release-agent');
}

async function main() {
  let musicServer;

  try {
    console.log('== demo:verify:social:down ==');
    console.log('Spawning music-release-agent without social-post-service to verify degraded behavior...\n');

    musicServer = spawnMusicServer();

    const health = await waitForJson(`${musicUrl}/api/social/health`, {
      validate: (json) => json.service === 'social-post-service' && json.reachable === false
    });

    if (health.url !== unreachableSocialUrl) {
      throw new Error(`health endpoint returned unexpected social URL: ${health.url}`);
    }

    const readyReport = await waitForJson(`${musicUrl}/readyz`, {
      validate: (json) => json.coreReady === true && json.checks.socialPostService === 'unreachable'
    });

    if (readyReport.status !== 'degraded') {
      throw new Error(`expected degraded readyz status when social service is down, got "${readyReport.status}"`);
    }

    const publishResponse = await fetch(`${musicUrl}/api/social/publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        caption: 'This request should fail cleanly because the companion service is down.',
        platforms: ['threads']
      })
    });

    if (publishResponse.status !== 502) {
      const body = await publishResponse.text();
      throw new Error(`expected 502 when social service is down, got ${publishResponse.status}: ${body}`);
    }

    const errorPayload = await publishResponse.json();
    if (typeof errorPayload.error !== 'string' || !errorPayload.error.includes('社群發文服務不可達')) {
      throw new Error('expected publish failure payload to include 社群發文服務不可達');
    }

    console.log('\nFailure-mode proof passed:');
    console.log('- health endpoint reported the companion service as unreachable');
    console.log('- readyz reported the app as core-ready but dependency-degraded');
    console.log('- publish proxy returned 502 instead of hanging or crashing');
    console.log('- error payload clearly explained that social-post-service was unavailable');
    console.log('\ndemo:verify:social:down passed');
  } finally {
    await terminate(musicServer);
  }
}

main().catch((error) => {
  console.error(`\ndemo:verify:social:down failed: ${error.message}`);
  process.exit(1);
});
