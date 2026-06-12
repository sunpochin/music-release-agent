/**
 * Share 路由 — 社群分享連結的 OG meta 端點（爬蟲看門口海報，真人被重導向到 SPA）。
 * 驗證：tests/share-meta.test.js（含 XSS 轉義與 fallback 行為）。
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { buildShareHtml, findAlbumInCache, findTrackName } from '../services/share-meta.js';

const cacheDataPath = path.join(process.cwd(), 'data/spotify-cache.json');

export function shareRoutes() {
  const router = Router();

  router.get(['/album/:albumId', '/album/:albumId/song/:trackId'], async (req, res) => {
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

  return router;
}
