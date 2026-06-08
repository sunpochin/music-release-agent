import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CircuitBreaker } from '../src/services/circuit-breaker.js';

describe('CircuitBreaker 熔斷器單元測試 (TDD)', () => {
  let breaker;

  beforeEach(() => {
    // 建立一個失敗閥值為 2，冷卻時間為 100ms 的熔斷器
    breaker = new CircuitBreaker({
      failureThreshold: 2,
      cooldownMs: 100
    });
  });

  it('初始狀態應為 CLOSED，且正常執行並回傳成功結果', async () => {
    expect(breaker.state).toBe('CLOSED');
    const fn = vi.fn().mockResolvedValue('success-data');
    const res = await breaker.execute(fn);
    expect(res).toBe('success-data');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('在 CLOSED 狀態下，若調用失敗達到閥值，應熔斷切換至 OPEN', async () => {
    const errorFn = vi.fn().mockRejectedValue(new Error('Network error'));
    
    // 第一次失敗
    await expect(breaker.execute(errorFn)).rejects.toThrow('Network error');
    expect(breaker.state).toBe('CLOSED');
    expect(breaker.failureCount).toBe(1);

    // 第二次失敗 -> 觸發熔斷
    await expect(breaker.execute(errorFn)).rejects.toThrow('Network error');
    expect(breaker.state).toBe('OPEN');
    expect(breaker.failureCount).toBe(2);
  });

  it('在 OPEN 狀態下，調用應直接被攔截拒絕，不執行目標函式', async () => {
    breaker.state = 'OPEN';
    breaker.nextAttemptTime = Date.now() + 5000; // 未過期

    const fn = vi.fn().mockResolvedValue('success');
    await expect(breaker.execute(fn)).rejects.toThrow('熔斷器處於開啟狀態');
    expect(fn).not.toHaveBeenCalled();
  });

  it('在 OPEN 狀態下，若冷卻時間已過，應進入 HALF-OPEN；若調用成功，恢復為 CLOSED', async () => {
    const errorFn = vi.fn().mockRejectedValue(new Error('Fail'));
    await expect(breaker.execute(errorFn)).rejects.toThrow();
    await expect(breaker.execute(errorFn)).rejects.toThrow();
    expect(breaker.state).toBe('OPEN');

    // 模擬等待冷卻時間 (100ms)
    await new Promise((resolve) => setTimeout(resolve, 110));

    // 下一次調用應為 HALF-OPEN 嘗試
    const successFn = vi.fn().mockResolvedValue('recovered');
    const res = await breaker.execute(successFn);
    
    expect(res).toBe('recovered');
    expect(breaker.state).toBe('CLOSED');
    expect(breaker.failureCount).toBe(0);
  });

  it('在 HALF-OPEN 狀態下，若調用依然失敗，應重新進入 OPEN 狀態並刷新冷卻時間', async () => {
    const errorFn = vi.fn().mockRejectedValue(new Error('Fail'));
    await expect(breaker.execute(errorFn)).rejects.toThrow();
    await expect(breaker.execute(errorFn)).rejects.toThrow();
    expect(breaker.state).toBe('OPEN');

    // 等待冷卻
    await new Promise((resolve) => setTimeout(resolve, 110));

    // HALF-OPEN 下再次失敗
    await expect(breaker.execute(errorFn)).rejects.toThrow('Fail');
    expect(breaker.state).toBe('OPEN');
  });
});
