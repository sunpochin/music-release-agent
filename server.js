/**
 * 進入點 — 載入環境變數後啟動 app（組裝邏輯見 src/app.js，路由見 src/routes/）。
 */
import dotenv from 'dotenv';

// 優先載入本地開發專用環境變數（.env.local），隨後載入預設配置（.env）
dotenv.config({ path: '.env.local' });
dotenv.config();

const { createApp } = await import('./src/app.js');
const { logger } = await import('./src/services/logger.js');

const PORT = process.env.PORT || 3011;

createApp().listen(PORT, () => {
  logger.info(`🎵 music-release-agent server running on http://localhost:${PORT}`);
  logger.info(`📍 health: http://localhost:${PORT}/healthz`);
  logger.info(`📍 ready:  http://localhost:${PORT}/readyz`);
});
