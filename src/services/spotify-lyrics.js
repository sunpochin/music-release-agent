/**
 * 🎵 Spotify 官方歌詞獲取器 (Spotify Internal Lyrics Fetcher)
 * 透過用戶提供的 sp_dc cookie 獲取高級存取權杖，並向 Spotify 內部 API 抓取官方歌詞
 */

/** 
 * 透過 sp_dc cookie 交換臨時高級存取權杖
 * @param {string} spDc - Spotify sp_dc cookie
 */
async function getAccessToken(spDc) {
  const url = 'https://open.spotify.com/get_access_token?reason=transport&productType=web_player';
  const res = await fetch(url, {
    headers: {
      'Cookie': `sp_dc=${spDc}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });

  if (!res.ok) {
    throw new Error(`無法從 sp_dc cookie 取得存取權杖: ${res.status}`);
  }

  const data = await res.json();
  return data.accessToken;
}

/**
 * 抓取 Spotify 官方歌詞
 * @param {string} trackId - Spotify 單曲 ID
 * @param {string} spDc - Spotify sp_dc cookie
 * @returns {Promise<{ lyrics: string, source: 'spotify' }|null>} 歌詞原文與來源標記
 */
export async function fetchSpotifyLyrics(trackId, spDc) {
  if (!trackId || trackId.startsWith('fallback-') || trackId.startsWith('mb-')) {
    return null; // 非 Spotify 原生 ID 則直接跳過
  }

  try {
    const accessToken = await getAccessToken(spDc);
    const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${trackId}`;
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'App-Platform': 'WebPlayer',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      if (res.status === 404) return null; // 該歌曲在 Spotify 上無歌詞
      throw new Error(`Spotify 內部歌詞 API 回應異常: ${res.status}`);
    }

    const data = await res.json();
    const lines = data.lyrics?.lines || [];
    if (lines.length === 0) return null;

    // 將逐行歌詞組合為純文字
    const plainLyrics = lines.map(line => line.words || '').join('\n').trim();
    if (!plainLyrics) return null;

    return {
      lyrics: plainLyrics,
      source: 'spotify'
    };
  } catch (err) {
    console.warn(`[SpotifyLyrics] ⚠️ 獲取 Spotify 官方歌詞失敗 (${err.message})，將降級使用其他來源。`);
    return null;
  }
}
