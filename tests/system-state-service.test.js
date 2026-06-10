import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SystemStateService } from '../src/services/system-state-service.js';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

// 使用每次執行唯一的暫存路徑，避免測試殘留檔案造成順序相依（order-dependent）失敗，
// 也避免污染 repo 的 data/ 目錄
const uniqueSuffix = `${process.pid}-${Date.now()}`;
const TEST_SYS_FILE = path.join(os.tmpdir(), `test-system-state-${uniqueSuffix}.json`);
const TEST_SCAN_FILE = path.join(os.tmpdir(), `test-scanner-state-${uniqueSuffix}.json`);

describe('SystemStateService 單元測試', () => {
  let stateService;

  beforeEach(async () => {
    stateService = new SystemStateService(TEST_SYS_FILE, TEST_SCAN_FILE);
    // 清除舊的測試殘留檔案
    try {
      await fs.unlink(TEST_SYS_FILE.replace(/\.json$/, '.test.json'));
    } catch (e) {}
    try {
      await fs.unlink(TEST_SCAN_FILE.replace(/\.json$/, '.test.json'));
    } catch (e) {}
  });

  afterEach(async () => {
    // 確保清除產生的測試檔案
    try {
      await fs.unlink(TEST_SYS_FILE);
    } catch (e) {}
    try {
      await fs.unlink(TEST_SCAN_FILE);
    } catch (e) {}
    try {
      await fs.unlink(TEST_SYS_FILE.replace(/\.json$/, '.test.json'));
    } catch (e) {}
    try {
      await fs.unlink(TEST_SCAN_FILE.replace(/\.json$/, '.test.json'));
    } catch (e) {}
  });

  it('初始狀態讀取應回傳預設空結構', async () => {
    const sysState = await stateService.readSystemState();
    expect(sysState.spotify429ErrorHistory).toEqual([]);
    expect(sysState.spotifyDisabledUntil).toBe(0);

    const scanState = await stateService.readScannerState();
    expect(scanState).toEqual({});
  });

  it('能成功寫入與讀取掃描器狀態與系統狀態', async () => {
    const mockScan = { 'artist-1': { name: 'Bobby', last_scanned_at: '2026-06-08' } };
    await stateService.writeScannerState(mockScan);
    const readScan = await stateService.readScannerState();
    expect(readScan).toEqual(mockScan);

    const mockSys = { lastScanCommandTime: 12345, spotify429ErrorHistory: [], spotifyDisabledUntil: 0 };
    await stateService.writeSystemState(mockSys);
    const readSys = await stateService.readSystemState();
    expect(readSys.lastScanCommandTime).toBe(12345);
  });

  it('觸發兩次 429 時，應啟動 24 小時冷卻禁用狀態', async () => {
    // 第一次 429
    await stateService.recordSpotify429();
    let sysState = await stateService.readSystemState();
    expect(sysState.spotify429ErrorHistory.length).toBe(1);
    expect(await stateService.isSpotifyCooldownActive()).toBe(false);

    // 第二次 429
    await stateService.recordSpotify429();
    sysState = await stateService.readSystemState();
    expect(sysState.spotify429ErrorHistory.length).toBe(2);
    expect(sysState.spotifyDisabledUntil).toBeGreaterThan(Date.now());
    expect(await stateService.isSpotifyCooldownActive()).toBe(true);
  });
});
