// @ts-check
/**
 * Core 路由 — 音樂庫 API：albums、tracks、本地樂評擷取、歌曲 AI 分析。
 */
import { Router } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { getSpotifyAlbumTracks } from '../spotify-client.js';
import { generateTrackAnalysis } from '../album-reviewer.js';
import { log } from '../services/logger.js';

// 輔助函式：將字串轉為 URL 友善的 Slug 格式，需與 GitBook 發布器一致
function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    // 繁體中文註解：將減號置於字元類別末尾以代表字面減號，避免範圍解讀與不必要的斜線轉義
    .replace(/[^\w一-龥-]+/g, '')
    .replace(/--+/g, '-');
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

export function coreRoutes() {
  const router = Router();

  router.get('/api', (_req, res) => {
    res.json({
      name: 'music-release-agent',
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
  router.get('/api/albums', async (_req, res) => {
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

      // 繁體中文註解：依照發行日期反向排序，呼叫 getTime() 進行型別安全相減
      allAlbums.sort((a, b) => new Date(b.release_date).getTime() - new Date(a.release_date).getTime());

      res.json(allAlbums);
    } catch (err) {
      log.error('Failed to read albums cache', { error: err.message });
      res.status(500).json({ error: 'Failed to load albums' });
    }
  });

  // 取得本地 AI 樂評介紹與總結
  router.get('/api/review', async (req, res) => {
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
    } catch {
      // 找不到檔案時回傳空值，不報錯
      res.json({ introduction: '', summary: '' });
    }
  });

  // 獲取專輯曲目 (動態隨選載入)
  router.get('/api/albums/:id/tracks', async (req, res) => {
    const { id } = req.params;
    try {
      const tracks = await getSpotifyAlbumTracks(id);
      res.json(tracks);
    } catch (err) {
      log.error('Failed to get tracks for album', { albumId: id, error: err.message });
      res.status(500).json({ error: 'Failed to load tracks' });
    }
  });

  // 歌曲級別 AI 分析 (動態隨選生成)
  router.post('/api/tracks/analyze', async (req, res) => {
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

  return router;
}
