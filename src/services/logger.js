import pino from 'pino';
import { AsyncLocalStorage } from 'async_hooks';

// 建立非同步本地儲存空間，用以在整個 Request 生命週期內隱式傳遞 Request ID
export const requestStore = new AsyncLocalStorage();

// 建立 Pino 結構化日誌實例
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp: pino.stdTimeFunctions.isoTime,
  // 格式化日誌輸出，加入自訂欄位
  formatters: {
    level: (label) => {
      return { level: label.toUpperCase() };
    },
  },
});

// 包裝日誌方法，自動從非同步儲存空間中注入當前的 Request ID (Correlation ID)
export const log = {
  info: (msg, obj = {}) => {
    const store = requestStore.getStore();
    logger.info({ ...obj, requestId: store?.requestId }, msg);
  },
  error: (msg, obj = {}) => {
    const store = requestStore.getStore();
    logger.error({ ...obj, requestId: store?.requestId }, msg);
  },
  warn: (msg, obj = {}) => {
    const store = requestStore.getStore();
    logger.warn({ ...obj, requestId: store?.requestId }, msg);
  },
  debug: (msg, obj = {}) => {
    const store = requestStore.getStore();
    logger.debug({ ...obj, requestId: store?.requestId }, msg);
  }
};
