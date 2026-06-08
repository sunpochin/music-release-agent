/**
 * 熔斷器模式 (CircuitBreaker)
 * 負責隔離不穩定服務（如雲端 Gemini API），避免持續失敗造成崩潰，並提供自動冷卻復原狀態機。
 */
export class CircuitBreaker {
  /**
   * @param {object} options
   * @param {number} [options.failureThreshold] - 連續失敗上限次數
   * @param {number} [options.cooldownMs] - 熔斷後禁用並冷卻的時間 (毫秒)
   */
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold !== undefined ? options.failureThreshold : 3;
    this.cooldownMs = options.cooldownMs !== undefined ? options.cooldownMs : 3 * 60 * 1000;
    
    this.state = 'CLOSED'; // 可為 'CLOSED', 'OPEN', 'HALF_OPEN'
    this.failureCount = 0;
    this.nextAttemptTime = 0;
  }

  /**
   * 執行包裝的非同步函式，自動監控並推進狀態機
   * @param {function} fn - 回傳 Promise 的待封裝執行函式
   * @returns {Promise<any>}
   */
  async execute(fn) {
    this.checkState();

    if (this.state === 'OPEN') {
      throw new Error('熔斷器處於開啟狀態，拒絕執行雲端服務，自動進行降級。');
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  /**
   * 檢查當前狀態。若在 OPEN 狀態下冷卻時間已過，則進入 HALF-OPEN
   */
  checkState() {
    if (this.state === 'OPEN' && Date.now() >= this.nextAttemptTime) {
      this.state = 'HALF_OPEN';
    }
  }

  /**
   * 調用成功時的狀態推進邏輯
   */
  onSuccess() {
    this.state = 'CLOSED';
    this.failureCount = 0;
  }

  /**
   * 調用失敗時的狀態推進與熔斷開關判定
   */
  onFailure() {
    this.failureCount++;
    if (this.state === 'HALF_OPEN' || this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttemptTime = Date.now() + this.cooldownMs;
      console.warn(`[CircuitBreaker] 🚨 服務連續失敗，熔斷器開啟 (OPEN)，進入冷卻期直至 ${new Date(this.nextAttemptTime).toLocaleTimeString()}`);
    }
  }
}
