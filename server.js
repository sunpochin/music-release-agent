import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import pinoHttp from 'pino-http';
import { getSpotifyAuthUrl, handleSpotifyCallback } from './src/spotify-auth.js';
import { getLyricsWithCache } from './src/services/lyrics-service.js';
import { getSpotifyAlbumTracks } from './src/spotify-client.js';
import { generateTrackAnalysis } from './src/album-reviewer.js';
import { socialClient } from './src/services/social-client.js';
import { loadHandoffSchema, validateAgainstDefinition } from './src/services/contract-validator.js';
import { buildShareHtml, findAlbumInCache, findTrackName } from './src/services/share-meta.js';
import { logger, log, requestStore } from './src/services/logger.js';

dotenv.config();

// 跨服務 handoff 契約（單一事實來源：contracts/social-handoff.schema.json）
const handoffSchema = loadHandoffSchema();

const app = express();

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
const PORT = process.env.PORT || 3011;
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

async function buildReadinessReport() {
  const isDev = process.env.NODE_ENV === 'development';
  const [dashboardBuilt, mockDataAvailable, cacheAvailable, socialReachable] = await Promise.all([
    pathAccessible(dashboardIndexPath),
    pathAccessible(mockDataPath),
    pathAccessible(cacheDataPath),
    // 【小朋友解釋法】：
    // 打電話給特別嘉賓確認健康狀態時，如果電話線斷了（請求報錯），不要讓整個派對取消（Promise.all 崩潰回傳 500）。
    // 我們加上保險絲 (.catch(() => false))，打不通就當他無法出席 (false) 就好，派對照常開門！
    socialClient.isHealthy().catch(() => false)
  ]);

  // 【小朋友解釋法】：
  // 在排練（開發環境）時，我們不需要真的把海報印好裝框（不需 npm run build 產生 index.html），
  // 所以如果是開發環境（isDev），我們就放寬限制，海報沒印好也算準備就緒，方便我們本地測試！
  const coreReady = (isDev || dashboardBuilt) && mockDataAvailable;
  const dependencyStatus = socialReachable ? 'reachable' : 'unreachable';
  const status = coreReady ? (socialReachable ? 'ok' : 'degraded') : 'not_ready';

  return {
    status,
    coreReady,
    checks: {
      dashboardBuilt,
      mockDataAvailable,
      cacheAvailable,
      socialPostService: dependencyStatus
    },
    ports: {
      app: Number(PORT),
      socialServiceUrl: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3012'
    },
    timestamp: new Date().toISOString()
  };
}

import { createProxyMiddleware } from 'http-proxy-middleware';

// 判斷當前環境是否為開發模式
const isDev = process.env.NODE_ENV === 'development';

// 提供 React 前端資源
if (isDev) {
  // 在開發模式下，將前端資源請求反向代理至 Vite 開發伺服器 (Port 5173)
  // 這樣透過 Cloudflare Tunnel 連結後端時，依然能享受 Vite 的熱更新與動態載入
  app.use((req, res, next) => {
    // 排除後端 API、登入、健康檢查與 OG 分享 meta 路由，其餘皆代理至 Vite
    const excludes = ['/api', '/login', '/callback', '/healthz', '/readyz', '/album'];
    if (excludes.some(path => req.path.startsWith(path))) {
      return next();
    }
    createProxyMiddleware({
      target: 'http://localhost:5173',
      changeOrigin: true,
      ws: true // 支援 WebSocket 進行 Vite HMR 熱更新
    })(req, res, next);
  });
} else {
  // 在生產模式下，直接提供編譯後的靜態檔案
  app.use(express.static(path.join(process.cwd(), 'dashboard/dist')));
}

// 社群分享連結的 OG meta 端點（爬蟲看門口海報，真人被重導向到 SPA）
// 驗證：tests/share-meta.test.js（含 XSS 轉義與 fallback 行為）
app.get(['/album/:albumId', '/album/:albumId/song/:trackId'], async (req, res) => {
  const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';
  let found = null;
  let trackName = null;

  try {
    const cache = JSON.parse(await fs.readFile(cacheDataPath, 'utf-8'));
    found = findAlbumInCache(cache, req.params.albumId);
    if (found && req.params.trackId) {
      trackName = findTrackName(cache, req.params.albumId, req.params.trackId);
    }
  } catch {
    // 快取缺失或壞掉 → 退回通用 meta，分享連結仍可導向 SPA
  }

  res
    .status(found ? 200 : 404)
    .type('html')
    .send(buildShareHtml({
      album: found?.album ?? null,
      artistName: found?.artistName ?? '',
      trackName,
      dashboardUrl,
      requestPath: req.path
    }));
});

app.get('/api', (_req, res) => {
  res.json({
    name: 'nanoclaw-music-agent',
    status: 'ok',
    endpoints: {
      login: '/login/spotify',
      callback: '/callback/spotify',
      healthz: '/healthz',
      readyz: '/readyz'
    }
  });
});

// 取得緩存的音樂發行資料
app.get('/api/albums', async (_req, res) => {
  try {
    const dataPath = path.join(process.cwd(), 'data/spotify-cache.json');
    const content = await fs.readFile(dataPath, 'utf-8');
    const cache = JSON.parse(content);
    
    // 建立藝人 ID 到名稱的對照表
    const artistMap = {};
    if (cache.followed_artists && cache.followed_artists.data) {
      cache.followed_artists.data.forEach(artist => {
        artistMap[artist.id] = artist.name;
      });
    }
    
    // 整理所有藝人的專輯，並注入藝人名稱
    const allAlbums = [];
    if (cache.artist_albums) {
      for (const artistId in cache.artist_albums) {
        if (cache.artist_albums[artistId] && cache.artist_albums[artistId].data) {
          const artistName = artistMap[artistId] || '未知藝人';
          const albumsWithArtist = cache.artist_albums[artistId].data.map(album => ({
            ...album,
            artistName,
            artistId
          }));
          allAlbums.push(...albumsWithArtist);
        }
      }
    }
    
    // 依照發行日期反向排序
    allAlbums.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
    
    res.json(allAlbums);
  } catch (err) {
    log.error('Failed to read albums cache', { error: err.message });
    res.status(500).json({ error: 'Failed to load albums' });
  }
});

// 輔助函式：將字串轉為 URL 友善的 Slug 格式，需與 GitBook 發布器一致
function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u4e00-\u9fa5]+/g, '')
    .replace(/\-\-+/g, '-');
}

// 輔助函式：解析 AI 樂評 markdown 檔案，擷取作品介紹與精選總結
function extractReviewParts(markdown) {
  const lines = markdown.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  let introduction = '';
  let summary = '';
  
  // 尋找第一個非圖片、非標題且非連結的段落作為作品介紹
  for (const line of lines) {
    if (line.startsWith('!') || line.startsWith('#') || line.startsWith('---') || line.startsWith('🎧') || line.startsWith('[')) {
      continue;
    }
    if (line.startsWith('**') && line.endsWith('**')) {
      continue;
    }
    introduction = line;
    break;
  }
  
  // 從尾端往前尋找最後一個粗體段落作為分享的精選總結
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i];
    if (line.startsWith('**') && line.endsWith('**')) {
      summary = line.replace(/^\*\*|\*\*$/g, ''); // 移除粗體標籤
      break;
    }
  }
  
  return { introduction, summary };
}

// 取得本地 AI 樂評介紹與總結 API
app.get('/api/review', async (req, res) => {
  const { artistName, albumName } = req.query;
  if (!artistName || !albumName) {
    return res.status(400).json({ error: 'Missing artistName or albumName' });
  }

  try {
    const slug = generateSlug(`${artistName}-${albumName}`) || 'unknown';
    // 讀取環境變數設定的樂評路徑，並以本地 reviews 目錄為安全降級備用
    const reviewsDir = process.env.REVIEWS_PATH || path.join(process.cwd(), 'reviews');
    const filePath = path.join(reviewsDir, `${slug}.md`);
    const content = await fs.readFile(filePath, 'utf-8');
    const parts = extractReviewParts(content);
    res.json(parts);
  } catch (err) {
    // 找不到檔案時回傳空值，不報錯
    res.json({ introduction: '', summary: '' });
  }
});

// 翻譯歌詞 API
// 歌詞翻譯（快取優先）：cache hit 零 token；miss 才呼叫 LYRICS_PROVIDER（gemini|ollama）
// 失效策略見 docs/lyrics_cache_design.md — 不可變內容無 TTL，promptVersion 改版自然 miss
app.post('/api/lyrics', async (req, res) => {
  const { artistName, trackName, trackId, translate, refresh } = req.body;
  if (!artistName || !trackName) {
    return res.status(400).json({ error: 'Missing artistName or trackName' });
  }

  try {
    const result = await getLyricsWithCache({
      artistName,
      trackName,
      trackId,
      translate: Boolean(translate),
      forceRefresh: Boolean(refresh)
    });
    res.json(result); // { text, cached, provider, source, translated }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 獲取專輯曲目 API (動態隨選載入)
app.get('/api/albums/:id/tracks', async (req, res) => {
  const { id } = req.params;
  try {
    const tracks = await getSpotifyAlbumTracks(id);
    res.json(tracks);
  } catch (err) {
    log.error('Failed to get tracks for album', { albumId: id, error: err.message });
    res.status(500).json({ error: 'Failed to load tracks' });
  }
});

// 歌曲級別 AI 分析 API (動態隨選生成)
app.post('/api/tracks/analyze', async (req, res) => {
  const { artistName, trackName, albumName } = req.body;
  if (!artistName || !trackName) {
    return res.status(400).json({ error: 'Missing artistName or trackName' });
  }
  
  try {
    const analysis = await generateTrackAnalysis(artistName, trackName, albumName);
    res.json({ text: analysis });
  } catch (err) {
    log.error('Failed to analyze track', { trackName, error: err.message });
    res.status(500).json({ error: err.message });
  }
});

// 社群自動發文代理端點 — 轉發請求至 social-post-service 微服務
// 請求驗證使用 contracts/social-handoff.schema.json（與內建 mock、verify 腳本共用同一份契約）
app.post('/api/social/publish', async (req, res) => {
  const { caption, platforms, imageBase64 } = req.body;

  const outboundBody = {
    image: imageBase64 || null,
    caption,
    platforms: platforms || ['threads']
  };
  const contractCheck = validateAgainstDefinition(handoffSchema, 'publishRequest', outboundBody);
  if (!contractCheck.valid) {
    return res.status(400).json({ error: `發文請求違反 handoff 契約: ${contractCheck.errors.join('; ')}` });
  }

  try {
    const result = await socialClient.publishPost({
      imageBase64,
      caption,
      platforms: platforms || ['threads']
    });
    // 回傳 202 Accepted 與 jobId 供前端輪詢狀態
    res.status(202).json(result);
  } catch (err) {
    log.error('社群發文服務不可達', { error: err.message });
    res.status(502).json({ error: `社群發文服務不可達: ${err.message}` });
  }
});

// 查詢社群發文任務狀態
app.get('/api/social/status/:jobId', async (req, res) => {
  try {
    const status = await socialClient.getPostStatus(req.params.jobId);
    res.json(status);
  } catch (err) {
    res.status(502).json({ error: `無法查詢發文狀態: ${err.message}` });
  }
});

// 社群發文服務健康檢查
app.get('/api/social/health', async (_req, res) => {
  const isHealthy = await socialClient.isHealthy();
  res.json({
    service: 'social-post-service',
    reachable: isHealthy,
    url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3012'
  });
});
app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/readyz', async (_req, res) => {
  const report = await buildReadinessReport();
  res.status(report.coreReady ? 200 : 503).json(report);
});

app.get('/login/spotify', (_req, res) => {
  const url = getSpotifyAuthUrl();
  if (!url) {
    return res.status(500).send('Spotify configuration is missing in .env');
  }
  return res.redirect(url);
});

app.get('/callback/spotify', async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send('Missing authorization code');
  }

  try {
    await handleSpotifyCallback(code);
    return res.send(`
      <div style="font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #121212; color: #fff; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h1 style="color: #1DB954; font-size: 3rem; margin-bottom: 20px;">Spotify authorization succeeded</h1>
        <p style="font-size: 1.1rem; color: #b3b3b3;">Tokens were saved to spotify_tokens.json.</p>
        <p style="font-size: 1.1rem; color: #b3b3b3;">You can close this window and run the scan pipeline.</p>
      </div>
    `);
  } catch (err) {
    return res.status(500).send(`
      <div style="font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #121212; color: #fff; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
        <h1 style="color: #e91429; font-size: 3rem; margin-bottom: 20px;">Authorization failed</h1>
        <p style="font-size: 1.1rem; color: #b3b3b3;">Reason: ${err.message}</p>
      </div>
    `);
  }
});

// 提供 React 前端靜態檔案 (發布後) 的 wildcard 路由以支援 React Router 前端路徑
app.get('*', (req, res, next) => {
  // 排除 API 請求，如果 API 未匹配則回傳 404
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }

  if (isDev) {
    // 開發模式下，交由 Vite 開發伺服器處理單頁應用路由 (SPA Fallback)
    return createProxyMiddleware({
      target: 'http://localhost:5173',
      changeOrigin: true
    })(req, res, next);
  }

  // 【小朋友解釋法】：
  // 當別人來找零件（.js 或 .css 靜態檔案）時如果找不到，不要硬給他「導覽圖」(index.html)，否則瀏覽器會裝不進去而報錯。
  // 我們檢查只要路徑裡有「.」而且不是「.html」，就直接說沒貨 (404)，只有網頁導航才給導覽圖！
  if (req.path.includes('.') && !req.path.endsWith('.html')) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(process.cwd(), 'dashboard/dist/index.html'));
});

app.listen(PORT, () => {
  logger.info(`🎵 music-release-agent server running on http://localhost:${PORT}`);
  logger.info(`📍 health: http://localhost:${PORT}/healthz`);
  logger.info(`📍 ready:  http://localhost:${PORT}/readyz`);
});
