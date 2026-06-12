// @ts-check
/**
 * Health / Readiness 路由 — liveness 與含依賴狀態的 readiness 報告。
 * readyz 語意：ok（全部 companion 可達）/ degraded（核心 ready、companion 掛）/ not_ready（503）。
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { socialClient } from '../services/social-client.js';
import { lyricsClient } from '../services/lyrics-client.js';

const dashboardIndexPath = path.join(process.cwd(), 'dashboard/dist/index.html');
const mockDataPath = path.join(process.cwd(), 'data/mock-releases.json');
const cacheDataPath = path.join(process.cwd(), 'data/spotify-cache.json');

async function pathAccessible(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export async function buildReadinessReport() {
  const isDev = process.env.NODE_ENV === 'development';
  const [dashboardBuilt, mockDataAvailable, cacheAvailable, socialReachable, lyricsReachable] = await Promise.all([
    pathAccessible(dashboardIndexPath),
    pathAccessible(mockDataPath),
    pathAccessible(cacheDataPath),
    // companion 健康檢查失敗只代表降級（degraded），不應讓 Promise.all 崩潰回傳 500
    socialClient.isHealthy().catch(() => false),
    lyricsClient.isHealthy().catch(() => false)
  ]);

  // 開發環境放寬 dashboard build 的要求，方便本地測試
  const coreReady = (isDev || dashboardBuilt) && mockDataAvailable;
  const allCompanionsReachable = socialReachable && lyricsReachable;
  const status = coreReady ? (allCompanionsReachable ? 'ok' : 'degraded') : 'not_ready';

  return {
    status,
    coreReady,
    checks: {
      dashboardBuilt,
      mockDataAvailable,
      cacheAvailable,
      socialPostService: socialReachable ? 'reachable' : 'unreachable',
      lyricsVaultService: lyricsReachable ? 'reachable' : 'unreachable'
    },
    ports: {
      app: Number(process.env.PORT || 3011),
      socialServiceUrl: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3012',
      lyricsServiceUrl: process.env.LYRICS_SERVICE_URL || 'http://localhost:3013'
    },
    timestamp: new Date().toISOString()
  };
}

export function healthRoutes() {
  const router = Router();

  router.get('/healthz', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  router.get('/readyz', async (_req, res) => {
    const report = await buildReadinessReport();
    res.status(report.coreReady ? 200 : 503).json(report);
  });

  return router;
}
