/**
 * Auth 路由 — Spotify OAuth 登入與 callback。
 */
import { Router } from 'express';
import { getSpotifyAuthUrl, handleSpotifyCallback, getSpotifyAccessToken } from '../spotify-auth.js';

export function authRoutes() {
  const router = Router();

  router.get('/api/auth/login/spotify', (_req, res) => {
    const url = getSpotifyAuthUrl();
    if (!url) {
      return res.status(500).send('Spotify configuration is missing in .env');
    }
    return res.redirect(url);
  });

  router.get('/api/auth/callback/spotify', async (req, res) => {
    const code = req.query.code;
    if (!code) {
      return res.status(400).send('Missing authorization code');
    }

    try {
      await handleSpotifyCallback(code);
      // 授權成功後，自動導向回前端 Dashboard，使 SPA 能接手後續流程
      const dashboardUrl = process.env.DASHBOARD_URL || 'http://localhost:5173';
      return res.redirect(`${dashboardUrl}?auth=success`);
    } catch (err) {
      return res.status(500).send(`
        <div style="font-family: system-ui, sans-serif; text-align: center; padding: 50px; background: #121212; color: #fff; height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center;">
          <h1 style="color: #e91429; font-size: 3rem; margin-bottom: 20px;">Authorization failed</h1>
          <p style="font-size: 1.1rem; color: #b3b3b3;">Reason: ${err.message}</p>
        </div>
      `);
    }
  });

  /**
   * 前端向此端點取得有效的 Spotify Access Token。
   * Client Secret 永遠留在後端，不暴露給瀏覽器。
   * Web Playback SDK 初始化時會呼叫此端點。
   */
  router.get('/api/auth/token', async (_req, res) => {
    try {
      const token = await getSpotifyAccessToken();
      if (!token) {
        // Token 不存在，代表尚未完成 OAuth 授權，引導前端跳轉登入
        return res.status(401).json({ error: 'not_authorized', loginUrl: '/api/auth/login/spotify' });
      }
      return res.json({ access_token: token });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
