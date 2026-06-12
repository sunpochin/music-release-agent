import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/cypress/**'],
    // 使用 forks 執行池以避免 CI 環境中 Node 20 與 undici 的相容性錯誤 (webidl.util.markAsUncloneable)
    pool: 'forks',
    // 設定全域測試環境變數
    env: {
      NODE_ENV: 'test',
      // 設定不可達的微服務位址，確保路由降級 (502) 測試的穩定性，避免受本地運行服務干擾
      SOCIAL_SERVICE_URL: 'http://127.0.0.1:39998',
      LYRICS_SERVICE_URL: 'http://127.0.0.1:39999'
    },
    // 設置測試覆蓋率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      // 誠實的分母：核心敘事的每一個模組都計入（樂評生成與 GitBook 輸出
      // 是 pipeline 的一半，不可被排除在覆蓋率之外）
      include: [
        'src/scanner/**/*.js',
        'src/services/**/*.js',
        'src/strategies/**/*.js',
        'src/routes/**/*.js',
        'src/dry-run/**/*.js',
        'src/app.js',
        'src/album-reviewer.js',
        'src/gitbook-publisher.js',
        'src/spotify-client.js',
        'src/spotify-auth.js',
        'src/musicbrainz-client.js'
      ],
      // 設定覆蓋率門檻（可選，用於確保程式碼品質）
      thresholds: {
        lines: 60,
        functions: 50,
        branches: 50,
        statements: 60
      }
    }
  }
})
