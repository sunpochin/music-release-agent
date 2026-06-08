import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs/promises';
import { getSpotifyAuthUrl, handleSpotifyCallback } from './src/spotify-auth.js';
import { translateLyrics } from './src/lyrics-translator.js';

dotenv.config();

const app = express();
app.use(express.json()); // 解析 JSON body
const PORT = process.env.PORT || 3011;

// 提供 React 前端靜態檔案 (發布後)
app.use(express.static(path.join(process.cwd(), 'dashboard/dist')));

app.get('/api', (_req, res) => {
  res.json({
    name: 'nanoclaw-music-agent',
    status: 'ok',
    endpoints: {
      login: '/login/spotify',
      callback: '/callback/spotify',
      healthz: '/healthz'
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
    console.error('Failed to read albums cache:', err);
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
    const filePath = path.join('/Users/pac/codes/interview/social-dancing-notes/new-releases', `${slug}.md`);
    const content = await fs.readFile(filePath, 'utf-8');
    const parts = extractReviewParts(content);
    res.json(parts);
  } catch (err) {
    // 找不到檔案時回傳空值，不報錯
    res.json({ introduction: '', summary: '' });
  }
});

// 翻譯歌詞 API
app.post('/api/lyrics', async (req, res) => {
  const { artistName, trackName } = req.body;
  if (!artistName || !trackName) {
    return res.status(400).json({ error: 'Missing artistName or trackName' });
  }
  
  try {
    const translation = await translateLyrics(artistName, trackName);
    res.json({ text: translation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/healthz', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

app.listen(PORT, () => {
  console.log(`🎵 nanoclaw-music-agent auth server running on http://localhost:${PORT}`);
});
