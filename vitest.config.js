import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**', '**/tests/e2e/**', '**/cypress/**'],
    // 使用 forks 執行池以避免 CI 環境中 Node 20 與 undici 的相容性錯誤 (webidl.util.markAsUncloneable)
    pool: 'forks',
    // 設置測試覆蓋率配置
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'json-summary'],
      // 僅包含核心 SOLID 重構的後端程式碼
      include: [
        'src/scanner/**/*.js',
        'src/services/**/*.js',
        'src/strategies/**/*.js',
        'src/spotify-client.js',
        'src/spotify-auth.js',
        'src/musicbrainz-client.js'
      ],
      // 排除非核心或未重構的外部整合模組
      exclude: [
        'src/album-reviewer.js',
        'src/gitbook-publisher.js',
        'src/lyrics-translator.js'
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
