import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SystemStateService } from '../src/services/system-state-service.js';
import fs from 'fs/promises';
import path from 'path';

const TEST_SYS_FILE = path.resolve('data/test-system-state.json');
const TEST_SCAN_FILE = path.resolve('data/test-scanner-state.json');

describe('SystemStateService 單元測試', () => {
  let stateService;

  beforeEach(() => {
    stateService = new SystemStateService(TEST_SYS_FILE, TEST_SCAN_FILE);
  });

  afterEach(async () => {
    try {
      await fs.unlink(TEST_SYS_FILE);
    } catch (e) {}
    try {
      await fs.unlink(TEST_SCAN_FILE);
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
