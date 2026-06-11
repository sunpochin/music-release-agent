/**
 * =====================================================================
 * 🔗 Share Meta — 社群分享連結的 OG meta 產生器（純函式，可離線測試）
 * =====================================================================
 * [技術] SPA（CSR）的頁面內容是進瀏覽器後才由 JS 畫出來的，
 *        但社群平台的爬蟲（FB/Threads/Slack/LINE）不執行 JS，
 *        只看 HTML 裡的 <meta property="og:*">。
 *        所以後端提供 /album/:id(/song/:id) 的「門口海報」：
 *        回一頁帶 OG meta 的輕量 HTML，真人會被 meta refresh
 *        重導向到 SPA，爬蟲則拿到標題、描述、封面圖。
 * [童趣] 我們的房子是「進門後才開始畫畫」的畫廊（CSR）。
 *        郵差（爬蟲）送邀請卡時不會進門等畫完，只看門口。
 *        所以我們在門口先貼好海報（OG meta）：有照片、有標題，
 *        郵差拍下海報轉發給朋友，朋友按門鈴（點連結）才真正進門看畫。
 * =====================================================================
 */

/** HTML 屬性與內文轉義（XSS 防護：專輯/藝人/歌名都是外部資料，一律視為不可信） */
export function escapeHtml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** 從 spotify-cache 結構中找出專輯與藝人名稱 */
export function findAlbumInCache(cache, albumId) {
  if (!cache?.artist_albums) return null;

  const artistMap = {};
  for (const artist of cache.followed_artists?.data ?? []) {
    artistMap[artist.id] = artist.name;
  }

  for (const artistId of Object.keys(cache.artist_albums)) {
    const albums = cache.artist_albums[artistId]?.data ?? [];
    const album = albums.find((a) => a.id === albumId);
    if (album) {
      return { album, artistName: artistMap[artistId] || '未知藝人' };
    }
  }
  return null;
}

/** 從 spotify-cache 結構中找出歌曲名稱（找不到回 null，meta 退回專輯層級） */
export function findTrackName(cache, albumId, trackId) {
  const tracks = cache?.album_tracks?.[albumId]?.data ?? [];
  return tracks.find((t) => t.id === trackId)?.name ?? null;
}

const SITE_NAME = 'Music Release Agent';

/**
 * 產生帶 OG meta 的分享 HTML。
 * album 為 null 時退回站台層級的通用 meta（過期連結不該變成醜 404 卡片）。
 */
export function buildShareHtml({ album, artistName, trackName, dashboardUrl, requestPath }) {
  const safePath = escapeHtml(requestPath || '/');
  const redirectUrl = `${escapeHtml(dashboardUrl)}${safePath}`;

  let title = SITE_NAME;
  let description = '追蹤新發行、AI 雙語歌詞與樂評的音樂儀表板';
  let image = '';
  let ogType = 'website';

  if (album) {
    const safeAlbum = escapeHtml(album.name);
    const safeArtist = escapeHtml(artistName);
    if (trackName) {
      title = `${escapeHtml(trackName)} — ${safeArtist}`;
      description = `收錄於《${safeAlbum}》(${escapeHtml(album.release_date)})。AI 雙語歌詞與賞析。`;
      ogType = 'music.song';
    } else {
      title = `${safeAlbum} — ${safeArtist}`;
      description = `${escapeHtml(album.release_date)} 發行，共 ${escapeHtml(album.total_tracks)} 首曲目。AI 雙語歌詞與樂評。`;
      ogType = 'music.album';
    }
    image = escapeHtml(album.image || album.images?.[0]?.url || '');
  }

  const imageMeta = image
    ? `  <meta property="og:image" content="${image}">\n  <meta name="twitter:image" content="${image}">\n`
    : '';

  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:type" content="${ogType}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${redirectUrl}">
${imageMeta}  <meta name="twitter:card" content="summary_large_image">
  <meta name="description" content="${description}">
  <meta http-equiv="refresh" content="0;url=${redirectUrl}">
</head>
<body>
  <p>正在前往 <a href="${redirectUrl}">${title}</a>…</p>
</body>
</html>
`;
}
