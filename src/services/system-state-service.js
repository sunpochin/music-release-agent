import fs from 'fs/promises';
import path from 'path';

/**
 * 職責單一的系統狀態與進度管理服務 (SystemStateService)
 */
export class SystemStateService {
  /**
   * @param {string} systemStatePath - 系統通用狀態路徑 (如 system-state.json)
   * @param {string} scannerStatePath - 掃描器狀態路徑 (如 scanner-state.json)
   */
  constructor(systemStatePath, scannerStatePath) {
    const isTest = process.env.NODE_ENV === 'test';
    // 若為測試環境，自動將存檔重新導向至 .test.json 避免污染開發環境實體資料
    this.systemStatePath = path.resolve(isTest ? systemStatePath.replace(/\.json$/, '.test.json') : systemStatePath);
    this.scannerStatePath = path.resolve(isTest ? scannerStatePath.replace(/\.json$/, '.test.json') : scannerStatePath);
  }

  /**
   * 讀取全域系統狀態 (429 限流紀錄與冷卻時間)
   * @returns {Promise<object>} 系統狀態
   */
  async readSystemState() {
    try {
      const data = await fs.readFile(this.systemStatePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {
        lastScanCommandTime: 0,
        spotify429ErrorHistory: [],
        spotifyDisabledUntil: 0
      };
    }
  }

  /**
   * 寫入全域系統狀態
   * @param {object} state - 系統狀態
   */
  async writeSystemState(state) {
    try {
      await fs.mkdir(path.dirname(this.systemStatePath), { recursive: true });
      await fs.writeFile(this.systemStatePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[SystemStateService] ⚠️ 無法寫入系統狀態檔:`, err.message || err);
    }
  }

  /**
   * 讀取掃描器進度狀態 (各歌手 MBID 與上次掃描時間)
   * @returns {Promise<object>} 掃描器狀態
   */
  async readScannerState() {
    try {
      const data = await fs.readFile(this.scannerStatePath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  /**
   * 寫入掃描器進度狀態
   * @param {object} state - 掃描器狀態
   */
  async writeScannerState(state) {
    try {
      await fs.mkdir(path.dirname(this.scannerStatePath), { recursive: true });
      await fs.writeFile(this.scannerStatePath, JSON.stringify(state, null, 2), 'utf8');
    } catch (err) {
      console.warn(`[SystemStateService] ⚠️ 無法寫入掃描器狀態檔:`, err.message || err);
    }
  }

  /**
   * 檢查 Spotify API 是否正處於冷卻禁用保護期
   * @returns {Promise<boolean>} 是否正被冷卻禁用
   */
  async isSpotifyCooldownActive() {
    const state = await this.readSystemState();
    if (state.spotifyDisabledUntil && Date.now() < state.spotifyDisabledUntil) {
      const remainingMs = state.spotifyDisabledUntil - Date.now();
      const remainingHrs = (remainingMs / (1000 * 60 * 60)).toFixed(1);
      console.warn(`[SystemStateService/Cooldown] 🔒 Spotify API 正處於降級冷卻中，剩餘 ${remainingHrs} 小時，自動降級。`);
      return true;
    }
    return false;
  }

  /**
   * 記錄 429 錯誤時間戳，並判定是否觸發 24 小時強制冷卻鎖定
   */
  async recordSpotify429() {
    const state = await this.readSystemState();
    const now = Date.now();
    
    // 僅保留過去 24 小時內的時間戳
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    state.spotify429ErrorHistory = (state.spotify429ErrorHistory || [])
      .filter(ts => ts > oneDayAgo);
    
    state.spotify429ErrorHistory.push(now);
    
    // 24 小時內大於等於 2 次則觸發 24 小時強制冷卻
    if (state.spotify429ErrorHistory.length >= 2) {
      state.spotifyDisabledUntil = now + 24 * 60 * 60 * 1000;
      console.error(`[SystemStateService/Cooldown] 🚨 24 小時內觸發 429 限流達到臨界點 (2 次)！啟動 24 小時降級冷卻，強制完全禁用 Spotify。`);
    }
    
    await this.writeSystemState(state);
  }
}
