# TECHNICAL.md - Music Release Agent 技術文件

## 1. 架構概述 (Architecture Overview)

`music-release-agent` 是音樂情報與樂評發布系統的核心微服務，負責：
- **串流新發行發現 (Release Scanner)**：整合 Spotify Web API 與 MusicBrainz 開放資料庫，具備策略模式 (Strategy Pattern) 與自動熔斷降級機制。
- **AI 深度樂評分析 (Album Reviewer)**：調用 Google Gemini API 深度剖析專輯元數據與曲目概念，產出繁體中文專業樂評 Markdown。
- **GitOps 文件發布 (GitBook Publisher)**：自動將 Markdown 寫入 GitBook 知識庫並提交推送，觸發雲端 GitBook 渲染上線。

**Phase 1 全雲端化目標**：將原先依賴工程師本地 Mac 手動執行之 CLI 管線 (`scan-releases.js`)，遷移至 GitHub Actions 每日定時無頭執行 (Headless Execution)。

---

## 2. 核心技術決策 (Key Architectural Decisions)

### 2.1 GitHub Actions Cron 排程與 GitOps 狀態回存機制 (GitOps State Persistence)
- **問題**：GitHub Actions Runner 屬於拋棄式無狀態環境（Ephemeral Environment）。若掃描結束後未保留 `data/scanner-state.json` 與 `data/spotify-cache.json`，下一次排程執行將丟失藝人掃描游標（Cursor）與快取，導致每次都重複掃描前幾位藝人，並大幅增加 Spotify API 429 限速與 Gemini 額度超額風險。
- **決策**：在 `.github/workflows/daily-scan.yml` 尾端設計自動 GitOps 狀態提交步驟。以 `github-actions[bot]` 身份將 `data/` 目錄變動提交並推回倉庫，並附帶 `[skip ci]` 防止觸發無窮循環建置。
- **排除的替代方案**：
  - *方案 A（外部 Redis 或雲端關聯資料庫）*：大幅增加服務架構複雜度與額外雲端託管帳單。本專案以輕量 JSON 與 GitOps 版本控制為核心哲學，利用 Git 倉庫本身作為分散式狀態儲存庫最為簡單且零維護成本。
  - *方案 B（無狀態全量掃描）*：每次全量掃描會隨關注藝人數量增加而超時，且必定觸發 Spotify 嚴格的 429 冷卻限制。

### 2.2 無頭環境憑證注入與 Refresh Token 刷新 (Headless Credentials Hydration)
- **問題**：本地開發依賴 Express Callback 端點由真人透過瀏覽器點擊授權並落盤 `spotify_tokens.json`。在 GitHub Actions 無頭雲端環境中無瀏覽器與真人可進行 OAuth 重定向。
- **決策**：
  1. 系統正式支援 `SPOTIFY_REFRESH_TOKEN` 環境變數。
  2. 在工作流中增加 `Hydrate Spotify Credentials` 步驟，透過 GitHub Secrets 注入 Refresh Token 並初始化憑證檔案，啟動時由 `refreshSpotifyAccessToken` 自動換取當前有效之短期 Access Token。
- **排除的替代方案**：
  - *方案 A（在 Secrets 儲存 Access Token）*：Spotify Access Token 效期僅 3600 秒（1 小時），在隔日排程執行時必定已過期而導致掃描失敗。
  - *方案 B（採用 Client Credentials 流程）*：Client Credentials 無法讀取使用者的關注藝人名單（Followed Artists），僅 User Authorization Code 模式具備讀取使用者追蹤清單之 Scope 權限。

### 2.3 雙模式 GitBook 目錄相容與降級架構 (Dual GitBook Workspace Fallback)
- **問題**：本地環境下預設發布路徑為同層之 `../social-dancing-notes`。雲端環境若未配置目標文檔倉庫之檢出與存取權限，`gitPushChanges` 中的 `git rev-parse` 會因目錄非 Git Repo 而中斷致命報錯。
- **決策**：
  - 若提供 `GITBOOK_PAT` Secret，工作流自動檢出 `sunpochin/social-dancing-notes` 倉庫至工作區進行真實發布。
  - 若未提供，工作流自動回退至本地 `data/mock-gitbook` 並執行 `git init` 確保 GitOps 同步引擎能正常演練且安全略過遠端推送，兼具安全性與相容性。

---

## 3. GitHub Secrets 環境變數配置清單 (Required Secrets)

於 GitHub 專案倉庫之 `Settings` -> `Secrets and variables` -> `Actions` 設定以下環境變數：

| Secret 名稱 | 是否必填 | 說明與用途 |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **必填** | 用於調用 Google Gemini 2.5 Flash 生成高品質專輯樂評。 |
| `SPOTIFY_CLIENT_ID` | **必填** | Spotify 開發者應用程式的 Client ID。 |
| `SPOTIFY_CLIENT_SECRET` | **必填** | Spotify 開發者應用程式的 Client Secret。 |
| `SPOTIFY_REFRESH_TOKEN` | **必填** | 使用者 Spotify 授權取得之 Refresh Token，用於自動換發短期 Access Token。 |
| `GITBOOK_PAT` | 選填 | 具備 `repo` 權限之 GitHub Personal Access Token，用於將樂評推送到外部文檔庫 (`sunpochin/social-dancing-notes`)。 |

---

## 4. 測試與驗證 (Verification)

- 執行 `npm test`：全部 16 組測試套件、111 項測試全數通過（100% 通過率）。
- 驗證 `.github/workflows/daily-scan.yml` YAML 結構完整性通過 parser 檢查。
