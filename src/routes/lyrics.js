// @ts-check
/**
 * Lyrics 路由 — 轉發至 lyrics-vault-service companion（歌詞翻譯 + Obsidian vault 落盤）。
 * 快取邏輯（hit 零 token、promptVersion 失效）在 companion 內；本服務只轉發與降級。
 * 契約：contracts/lyrics-handoff.schema.json。companion 不可達 → 穩定 502。
 */
import { Router } from 'express';
import { Readable } from 'stream';
import { lyricsClient } from '../services/lyrics-client.js';
import { log } from '../services/logger.js';

export function lyricsRoutes() {
  const router = Router();

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
