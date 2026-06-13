import { fetch } from 'undici';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

// 取得當前檔案的目錄路徑
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 定義 Token 儲存的本地小抽屜路徑 (JSON 檔案)
const TOKEN_FILE_PATH = path.join(__dirname, '../spotify_tokens.json');

// 設定 Spotify 請求權限範疇 (Scope)
const SPOTIFY_SCOPES = [
  'user-modify-playback-state',
  'user-read-playback-state',
  'user-read-currently-playing',
  'user-follow-read',
  'streaming',           // Web Playback SDK 串流播放必須
  'user-read-email',     // SDK 初始化時需要讀取用戶基本資訊
  'user-read-private',   // SDK 需確認用戶是否為 Premium 帳號
  'playlist-modify-public',  // 允許建立與修改公開歌單
  'playlist-modify-private', // 允許建立與修改私人歌單
  'playlist-read-private',   // 允許讀取現有歌單
  'user-top-read'        // 允許讀取近期最愛歌曲 (Feature 2 使用)
].join(' ');

interface SpotifyTokens {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
}

/**
 * 取得 Spotify 授權頁面的 URL
 */
export function getSpotifyAuthUrl(): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    console.error('[Spotify/Auth] ❌ 未在 .env 配置 SPOTIFY_CLIENT_ID 或 SPOTIFY_REDIRECT_URI！');
    return '';
  }

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: SPOTIFY_SCOPES,
    redirect_uri: redirectUri,
    show_dialog: 'true' // 強制每次都顯示授權畫面，確保可獲取新 Scope
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

/**
 * 將 Token 結構安全寫入本地儲存 (JSON 檔案)
 */
async function saveTokensToLocal(tokens: SpotifyTokens): Promise<void> {
  try {
    const dataToSave: SpotifyTokens = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || '', 
      expires_at: tokens.expires_at || (Date.now() + (tokens.expires_in || 3600) * 1000)
    };

    if (!tokens.refresh_token) {
      try {
        const oldDataStr = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
        const oldData = JSON.parse(oldDataStr) as SpotifyTokens;
        dataToSave.refresh_token = oldData.refresh_token;
      } catch (e) {
        // 忽略
      }
    }

    await fs.writeFile(TOKEN_FILE_PATH, JSON.stringify(dataToSave, null, 2), 'utf-8');
    console.log('[Spotify/Auth] 💾 Spotify 授權 Token 已成功持久化保存！');
  } catch (err: any) {
    console.error('[Spotify/Auth] ❌ 保存 Token 到本地失敗:', err.message || err);
  }
}

/**
 * 使用 Authorization Code 向 Spotify 交換 Access/Refresh Token
 */
export async function handleSpotifyCallback(code: string): Promise<SpotifyTokens> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri = process.env.SPOTIFY_REDIRECT_URI;

  console.log('[Spotify/Auth] 🔑 正在使用 code 交換 Access Token...');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri || ''
    }).toString()
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Spotify Token 交換失敗 (HTTP ${response.status}): ${errText}`);
  }

  const data = await response.json() as SpotifyTokens;
  await saveTokensToLocal(data);
  return data;
}

/**
 * 使用 Refresh Token 自動超時刷新 Access Token
 */
async function refreshSpotifyAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  console.log('[Spotify/Auth] 🔄 Access Token 已過期，正在呼叫 API 刷新中...');

  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken
    }).toString()
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`刷新 Spotify Access Token 失敗 (HTTP ${response.status}): ${errText}`);
  }

  const data = await response.json() as SpotifyTokens;
  await saveTokensToLocal(data);
  return data.access_token;
}

/**
 * 智能獲取當前有效的 Spotify Access Token (若過期自動刷新)
 */
export async function getSpotifyAccessToken(): Promise<string | null> {
  try {
    const rawData = await fs.readFile(TOKEN_FILE_PATH, 'utf-8');
    const tokenData = JSON.parse(rawData) as SpotifyTokens;

    if (!tokenData.access_token || !tokenData.refresh_token) {
      console.warn('[Spotify/Auth] ⚠️ 本地 Token 檔案不完整！請重新進行網頁授權登入。');
      return null;
    }

    const isExpired = Date.now() + 60000 >= (tokenData.expires_at || 0);

    if (isExpired) {
      return await refreshSpotifyAccessToken(tokenData.refresh_token);
    }

    return tokenData.access_token;
  } catch (err) {
    console.warn('[Spotify/Auth] ⚠️ 未能成功讀取本地 Token 檔案，請點擊 Web 連結進行第一次授權登入。');
    return null;
  }
}

/**
 * 清除本地儲存的 Spotify 授權憑證檔案 (實作登出)
 */
export async function clearSpotifyTokens(): Promise<void> {
  try {
    await fs.rm(TOKEN_FILE_PATH, { force: true });
    console.log('[Spotify/Auth] 🧹 本地 Spotify Token 憑證已成功清除！');
  } catch (err: any) {
    console.error('[Spotify/Auth] ❌ 清除本地 Token 失敗:', err.message || err);
  }
}
