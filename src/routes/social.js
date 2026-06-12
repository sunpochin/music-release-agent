/**
 * Social 路由 — 轉發至 social-post-service companion。
 * 請求驗證使用 contracts/social-handoff.schema.json（與內建 mock、verify 腳本共用同一份契約）。
 */
import { Router } from 'express';
import { socialClient } from '../services/social-client.js';
import { loadHandoffSchema, validateAgainstDefinition } from '../services/contract-validator.js';
import { log } from '../services/logger.js';

const handoffSchema = loadHandoffSchema();

export function socialRoutes() {
  const router = Router();

  router.post('/api/social/publish', async (req, res) => {
    const { caption, platforms, imageBase64, mode } = req.body;

    const outboundBody = {
      image: imageBase64 || null,
      caption,
      platforms: platforms || ['threads'],
      // mode 語義（companion 的 post-manager）：'mock' = 模擬發佈；'live'（預設）= 真實平台
      // 不轉發 mode 曾造成 verify 腳本與真實 companion 的 503 drift — 必須透傳
      ...(mode ? { mode } : {})
    };
    const contractCheck = validateAgainstDefinition(handoffSchema, 'publishRequest', outboundBody);
    if (!contractCheck.valid) {
      return res.status(400).json({ error: `發文請求違反 handoff 契約: ${contractCheck.errors.join('; ')}` });
    }

    try {
      const result = await socialClient.publishPost({
        imageBase64,
        caption,
        platforms: platforms || ['threads'],
        mode
      });
      // 回傳 202 Accepted 與 jobId 供前端輪詢狀態
      res.status(202).json(result);
    } catch (err) {
      log.error('社群發文服務不可達', { error: err.message });
      res.status(502).json({ error: `社群發文服務不可達: ${err.message}` });
    }
  });

  router.get('/api/social/status/:jobId', async (req, res) => {
    try {
      const status = await socialClient.getPostStatus(req.params.jobId);
      res.json(status);
    } catch (err) {
      res.status(502).json({ error: `無法查詢發文狀態: ${err.message}` });
    }
  });

  router.get('/api/social/health', async (_req, res) => {
    const isHealthy = await socialClient.isHealthy();
    res.json({
      service: 'social-post-service',
      reachable: isHealthy,
      url: process.env.SOCIAL_SERVICE_URL || 'http://localhost:3012'
    });
  });

  return router;
}
