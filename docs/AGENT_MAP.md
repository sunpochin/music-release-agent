<!--
檔案用途：讓小任務直接找到入口與最近驗證。
所在層：docs。
主要關聯：AGENTS.md、TECHNICAL.md。
-->

# Agent Map

| 任務 | 入口 | 最近驗證 |
| --- | --- | --- |
| 掃描／provider | `src/scanner/`、`src/strategies/` | `tests/release-scanner.test.js`、`tests/strategies.test.js` |
| 樂評與筆記庫寫入 | `src/album-reviewer.js`、`src/gitbook-publisher.js` | `tests/album-reviewer.test.js`、`tests/gitbook-publisher.test.js` |
| 歌詞／社群契約 | `src/routes/lyrics.js`、`src/routes/social.js`、`contracts/` | `tests/contract/` |
| Dashboard | `dashboard/` | `tests/e2e/`，既有 Playwright mock flow |
| AI 規則與防線 | [AGENTS.md](../AGENTS.md)、`scripts/check-harness.mjs` | `npm run harness:check`、`npm run harness:test` |

先讀目標與直接契約，不全庫考古。測試一律用假資料；不因導覽需要而讀取憑證、私人內容或執行發布。
