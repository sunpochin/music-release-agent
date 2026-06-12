/**
 * =====================================================================
 * 🎵 App Factory — Express 應用組裝（middleware + 路由掛載）
 * =====================================================================
 * server.js 只負責 listen；本檔負責組裝，讓 API 層可被測試直接 import
 * （tests/server-routes.test.js 以 ephemeral port 啟動並打真實 HTTP）。
 * 路由按服務邊界拆分於 src/routes/：
 *   core   — 音樂庫 API（albums/tracks/review/analyze）
 *   lyrics — lyrics-vault-service companion 代理
 *   social — social-post-service companion 代理
 *   share  — OG meta（社群分享）
 *   auth   — Spotify OAuth
 *   health — healthz / readyz
 * =====================================================================
 */
import express from 'express';
import path from 'path';
import crypto from 'crypto';
import pinoHttp from 'pino-http';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { logger, requestStore } from './services/logger.js';
import { coreRoutes } from './routes/core.js';
import { lyricsRoutes } from './routes/lyrics.js';
import { socialRoutes } from './routes/social.js';
import { shareRoutes } from './routes/share.js';
import { authRoutes } from './routes/auth.js';
import { healthRoutes } from './routes/health.js';

export function createApp() {
  const app = express();
  const isDev = process.env.NODE_ENV === 'development';

  // 1. 關聯識別碼 (Correlation ID) 與 AsyncLocalStorage 中介軟體
  app.use((req, res, next) => {
    const requestId = req.headers['x-request-id'] || crypto.randomUUID();
    req.id = requestId;
    res.setHeader('x-request-id', requestId);

    // 在非同步生命週期中執行，後續所有操作皆可共享此 ID
    requestStore.run({ requestId }, () => {
      next();
    });
  });

  // 2. 整合 pinoHttp 自動日誌
  app.use(pinoHttp({
    logger,
    genReqId: (req) => req.id,
    serializers: {
      req: (req) => ({
        id: req.id,
        method: req.method,
        url: req.url,
        headers: {
          host: req.headers.host,
          'user-agent': req.headers['user-agent'],
          'x-request-id': req.headers['x-request-id']
        }
      })
    }
  }));

  app.use(express.json({ limit: '10mb' })); // 解析 JSON body，允許較大的 base64 圖片

  // 3. 前端資源：開發模式代理 Vite（保留 Cloudflare Tunnel 下的 HMR），生產模式吐靜態檔
  if (isDev) {
    app.use((req, res, next) => {
      // 排除後端 API、登入、健康檢查與 OG 分享 meta 路由，其餘皆代理至 Vite
      const excludes = ['/api', '/login', '/callback', '/healthz', '/readyz', '/album'];
      if (excludes.some((p) => req.path.startsWith(p))) {
        return next();
      }
      createProxyMiddleware({
        target: 'http://localhost:5173',
        changeOrigin: true,
        ws: true // 支援 WebSocket 進行 Vite HMR 熱更新
      })(req, res, next);
    });
  } else {
    app.use(express.static(path.join(process.cwd(), 'dashboard/dist')));
  }

  // 4. 按服務邊界掛載路由
  app.use(shareRoutes());
  app.use(coreRoutes());
  app.use(lyricsRoutes());
  app.use(socialRoutes());
  app.use(healthRoutes());
  app.use(authRoutes());

  // 5. SPA fallback：API 未匹配回 404，其餘交給前端 router
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({ error: 'API route not found' });
    }

    if (isDev) {
      return createProxyMiddleware({
        target: 'http://localhost:5173',
        changeOrigin: true
      })(req, res, next);
    }

    // 靜態資產（含「.」且非 .html）找不到時回 404，避免瀏覽器拿到 index.html 當 JS/CSS 解析報錯
    if (req.path.includes('.') && !req.path.endsWith('.html')) {
      return res.status(404).send('Not found');
    }
    res.sendFile(path.join(process.cwd(), 'dashboard/dist/index.html'));
  });

  return app;
}
