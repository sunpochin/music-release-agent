# 面試優化計畫：CI/CD、容器化、E2E 測試、結構化日誌與型別安全

這個計畫將專注於提升專案的「面試賣相」與工程成熟度，加入自動化與雲原生部署能力，並逐步實作全端測試防護網、日誌追蹤與型別安全。

## Proposed Changes

### 1. GitHub Actions & Docker (已完成)
- [x] 自動化 CI Pipeline (`.github/workflows/ci.yml`)
- [x] Docker 容器化配置 (`Dockerfile`, `dashboard/Dockerfile`, `docker-compose.yml`)

### 2. [第一階段] E2E 測試 (Playwright) (已完成) 🧪
引入 Playwright 以確保全端關鍵路徑正常運作：
- [x] 安裝 `@playwright/test` 於根目錄。
- [x] 撰寫測試腳本模擬：載入首頁、點擊卡片、生成歌詞、點擊發佈。
- [x] 在 `package.json` 與 CI 中整合 `npm run test:e2e`。

### 3. [第二階段] 結構化日誌 (Pino) 📊 (進行中)
優化微服務的可觀測性 (Observability)：
- 於根目錄安裝 `pino` 與 `pino-http`。
- 實作 Express Middleware 自動為每個傳入請求產生/解析 `X-Request-ID`。
- 重構 `server.js` 與關鍵模組中的 `console.log`，改用 Pino 輸出結構化 JSON 日誌。
- 在 `socialClient` 跨服務調用時，傳遞 `X-Request-ID` 作為 Correlation ID，以便未來串聯日誌軌跡。

### 4. [第三階段] 型別安全 (JSDoc / @ts-check) 🟦
在不完全重寫為 TypeScript 的前提下，引入型別防護：
- 新增 `jsconfig.json` 並開啟 `checkJs: true`。
- 在關鍵模組（例如 Spotify/MusicBrainz API Client、Cache 資料格式）加上 JSDoc `typedef` 定義。

### 5. [未來積壓項] AI E2E 測試生成器 (Webwright Integration) 🤖
- 探索整合微軟的 Webwright 框架。
- 建立 `scripts/generate-e2e-agent.js`，讓開發者能用自然語言讓 AI 自動在本機編寫、自我糾錯並產生新的 Playwright 測試腳本，再合入 CI 執行。

## Verification Plan

### Automated Tests
- 本地與 CI 執行 `npm run test:e2e` 且全部通過。
