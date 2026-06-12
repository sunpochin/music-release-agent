/**
 * Auth 路由 — Spotify OAuth 登入與 callback。
 */
import { Router } from 'express';
import { getSpotifyAuthUrl, handleSpotifyCallback } from '../spotify-auth.js';

export function authRoutes() {
  const router = Router();

  router.get('/login/spotify', (_req, res) => {
    const url = getSpotifyAuthUrl();
    if (!url) {
      return res.status(500).send('Spotify configuration is missing in .env');
    }
    return res.redirect(url);
  });

  router.get('/callback/spotify', async (req, res) => {
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

  return router;
}
