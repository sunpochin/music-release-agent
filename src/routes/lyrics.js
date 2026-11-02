// @ts-check
/**
 * Lyrics 路由 — 轉發至 lyrics-vault-service companion（歌詞翻譯 + Obsidian vault 落盤）。
 * 快取邏輯（hit 零 token、promptVersion 失效）在 companion 內；本服務只轉發與降級。
 * 契約：contracts/lyrics-handoff.schema.json。companion 不可達 → 穩定 502。
 * 檔案用途：歌詞 HTTP 薄轉接；所在層：src/routes；主要關聯：lyrics-client.js、LyricsPage.jsx。
 */
import { Router } from 'express';
import { Readable } from 'stream';
import { lyricsClient } from '../services/lyrics-client.js';
import { log } from '../services/logger.js';
import { loadLyricsHandoffSchema, validateAgainstDefinition } from '../services/contract-validator.js';

export function lyricsRoutes() {
  const router = Router();
  const schema = loadLyricsHandoffSchema();

  // 搜尋與貼上翻譯使用獨立契約，核心只轉接，不複製來源與逐行翻譯邏輯。
  for (const [path, request, response] of [
    ['search', 'workbenchSearchRequest', 'workbenchSearchResponse'],
    ['translate', 'workbenchTranslateRequest', 'workbenchTranslateResponse']
  ]) {
    router.post(`/api/lyrics/${path}`, async (req, res) => {
      if (!validateAgainstDefinition(schema, request, req.body ?? {}).valid) {
        return res.status(400).json({ error: '請確認歌名、來源與歌詞欄位填寫正確。' });
      }
      try {
        const upstream = await fetch(`${process.env.LYRICS_SERVICE_URL || 'http://localhost:3013'}/api/lyrics/${path}`, {
          method: 'POST', headers: lyricsClient.buildHeaders(), body: JSON.stringify(req.body),
          signal: AbortSignal.timeout(path === 'search' ? 12000 : 200000)
        });
        const body = await upstream.json();
        const definition = upstream.ok ? response : 'errorResponse';
        if (!validateAgainstDefinition(schema, definition, body).valid) throw new Error('Invalid companion response');
        res.setHeader('Cache-Control', 'no-store');
        return res.status(upstream.status).json(body);
      } catch {
        return res.status(502).json({ error: '歌詞服務目前無法連線，請稍後再試。已輸入的原文會保留。' });
      }
    });
  }

  router.post('/api/lyrics/stream', async (req, res) => {
    const { artistName, trackName, trackId, translate, refresh } = req.body;
    if (!artistName || !trackName) {
      return res.status(400).json({ error: 'Missing artistName or trackName' });
    }

    try {
      const LYRICS_SERVICE_URL = process.env.LYRICS_SERVICE_URL || 'http://localhost:3013';
      const response = await fetch(`${LYRICS_SERVICE_URL}/api/lyrics/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(req.headers['x-request-id'] && { 'x-request-id': req.headers['x-request-id'] })
        },
        body: JSON.stringify({ artistName, trackName, trackId: trackId ?? null, translate: Boolean(translate), refresh: Boolean(refresh) })
      });

      if (!response.ok) {
        log.error('歌詞服務(Stream)不可達', { status: response.status });
        return res.status(response.status).json({ error: '歌詞服務回應異常' });
      }

      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.flushHeaders();

      if (response.body) {
        // @ts-ignore - Readable.fromWeb might not be perfectly typed depending on Node typings
        Readable.fromWeb(response.body).pipe(res);
      } else {
        res.end();
      }
    } catch (err) {
      log.error('歌詞服務不可達', { error: err.message });
      if (!res.headersSent) {
        res.status(502).json({ error: `歌詞服務不可達: ${err.message}` });
      } else {
        res.end();
      }
    }
  });

  router.post('/api/lyrics', async (req, res) => {
    const { artistName, trackName, trackId, translate, refresh } = req.body;
    if (!artistName || !trackName) {
      return res.status(400).json({ error: 'Missing artistName or trackName' });
    }

    try {
      const result = await lyricsClient.fetchLyrics({
        artistName,
        trackName,
        trackId,
        translate: Boolean(translate),
        refresh: Boolean(refresh)
      });
      res.json(result); // { text, cached, provider, source, translated }
    } catch (err) {
      log.error('歌詞服務不可達', { error: err.message });
      res.status(502).json({ error: `歌詞服務不可達: ${err.message}` });
    }
  });

  router.delete('/api/lyrics', async (req, res) => {
    const { artistName, trackName } = req.body;
    if (!artistName || !trackName) {
      return res.status(400).json({ error: 'Missing artistName or trackName' });
    }

    try {
      const result = await lyricsClient.clearCache({ artistName, trackName });
      res.json(result);
    } catch (err) {
      log.error('歌詞快取清除失敗', { error: err.message });
      res.status(502).json({ error: `歌詞服務不可達: ${err.message}` });
    }
  });

  router.get('/api/lyrics/health', async (_req, res) => {
    const isHealthy = await lyricsClient.isHealthy();
    res.json({
      service: 'lyrics-vault-service',
      reachable: isHealthy,
      url: process.env.LYRICS_SERVICE_URL || 'http://localhost:3013'
    });
  });

  return router;
}
