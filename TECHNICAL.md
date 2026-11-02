<!-- 檔案用途：系統設計決策；所在層：root；主要關聯：src/app.js、dashboard/src/main.jsx、contracts。 -->
# TECHNICAL.md - Music Release Agent 技術文件

## 獨立歌詞翻譯頁（2026-11-03）

- `/lyrics` 是與專輯 App 平行的路由，不掛載 Spotify 播放器、專輯查詢或樂評功能；首頁側欄提供直接入口。可只輸入歌名查詢 LRCLIB，補歌手縮小範圍，再選歌手／專輯／時長對應版本；亦可貼上原文、來源名稱、HTTPS 連結和版權／署名。
- 確認原文後才送出翻譯，結果以原句＋繁體中文逐行呈現，複製會連同來源與署名一起帶走。編輯歌曲、原文或來源會撤銷確認與舊結果，處理中停用編輯與重複送出，錯誤保留原文；無原文、演奏曲、超過行數和儲存失敗皆有提示。
- 核心新增 `POST /api/lyrics/search` 與 `/api/lyrics/translate` 薄轉接，保持 companion 的錯誤狀態；請求和回應都驗證 `contracts/lyrics-handoff.schema.json`，正本仍在姊妹 repo。搜尋 12 秒、翻譯 200 秒逾時；歌詞、prompt、來源驗證及儲存只在 companion。
- 兩行對照由 companion 保留原句並驗證中文陣列長度；不信任模型重抄原文。UI 以 React 純文字呈現，來源連結由 companion 限制 HTTPS。複製失敗可選取文字；私人歌詞不寫入前端持久儲存。
- 排除新增另一個前端服務：沿用 Vite 獨立路由即可，不需多一個 PM2 程序。不以專輯列表當查歌來源，不爬 Musixmatch；使用者接受先用 LRCLIB 自動查詞與手動貼上 Musixmatch 原文。官方 Musixmatch API 未串接，不宣稱自動取得該來源。
- 驗證：`npm test -- tests/lyrics-workbench-proxy.test.js tests/contract/lyrics-handoff-drift.test.js tests/server-routes.test.js`；前端 `npm run build --prefix dashboard` 與修改檔案 ESLint。跨服務配合姊妹 repo 的同名功能分支；現有工作基線為 `feat/issue-18-connect-obsidian-vault`，不夾帶合併或發布。
- 本機結果：116 項單元／契約測試通過，build 與修改檔案 ESLint 通過（build 保留現有大 bundle 警告）。瀏覽器以隔離假來源／假模型驗證完整兩種流程、快取、切換模式保留草稿、修改撤銷確認，以及 390／1280px 無水平溢出。真實搜尋可達；未用付費翻譯或私人 vault 驗收。`npm run typecheck` 仍受未修改的 `tests/e2e/dashboard-live.spec.js` 既有語法錯誤阻擋。

## 1. 架構概述 (Architecture Overview)

`music-release-agent` 是音樂情報與樂評發布系統的核心微服務，負責：
- **串流新發行發現 (Release Scanner)**：整合 Spotify Web API 與 MusicBrainz 開放資料庫，具備策略模式 (Strategy Pattern) 與自動熔斷降級機制。
- **AI 深度樂評分析 (Album Reviewer)**：調用 Google Gemini API 深度剖析專輯元數據與曲目概念，產出繁體中文專業樂評 Markdown。
- **GitOps 文件發布 (GitBook Publisher / Obsidian Vault Sync)**：自動將 Markdown 寫入筆記庫知識庫並提交推送，觸發雲端 GitBook / Obsidian 渲染上線。

**Phase 1 全雲端化目標**：
1. 將原先依賴工程師本地 Mac 手動執行之 CLI 管線 (`scan-releases.js`)，遷移至 GitHub Actions 每日定時無頭執行 (Headless Execution)（Issue #17）。
2. 連接 GitHub Actions 與外部筆記庫 (Obsidian Vault: `sunpochin/social-dancing-notes`)，實現雲端自動化跨倉庫樂評同步（Issue #18）。

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

### 2.3 跨 Repo 筆記庫 (Obsidian Vault) 授權與 PAT 安全防護策略 (Cross-Repo Access & Security Policy)
- **問題**：GitHub Actions 預設提供的 `GITHUB_TOKEN` 權限範圍僅限於當前儲存庫 (`music-release-agent`)，無法對跨儲存庫 (`sunpochin/social-dancing-notes`) 進行檢出或推送。
- **決策**：
  1. **最小權限原則 (Principle of Least Privilege, PoLP)**：強烈建議採用 GitHub **Fine-grained Personal Access Token (PAT)**，僅勾選目標倉庫 `sunpochin/social-dancing-notes`，權限僅需開放 `Repository permissions -> Contents: Read and write`。嚴禁使用具備全域管理員或寬鬆權限的過期 PAT。
  2. **環境變數雙軌相容**：同時支援 `VAULT_PAT` (新版語意化標準) 與 `GITBOOK_PAT` (相容現有專案設定)，在 Job 頂層注入 `VAULT_PAT: ${{ secrets.VAULT_PAT || secrets.GITBOOK_PAT }}`，避免 Step 層級 `env` 導致 `if:` 條件式提前計算為空的 GitHub Actions 常見坑洞。
  3. **自動分支綁定**：在 `actions/checkout@v4` 檢出 `social-dancing-notes` 後，主動執行 `git checkout main`，避免 Actions 預設之 detached HEAD 造成後續推送失敗。
- **排除的替代方案**：
  - *方案 A（單一 Monorepo 合併）*：知識庫筆記 (`social-dancing-notes`) 屬於使用者公開或個人 Obsidian / GitBook 站點，`music-release-agent` 屬於後端自動化微服務，混在同一個 Repo 破壞職責單一原則 (SRP) 與權限隔離。
  - *方案 B（Repository Dispatch Webhook）*：要求 `social-dancing-notes` 也要撰寫 Actions 接收端與維護兩段 CI 狀態，鏈路過長且排錯困難。

### 2.4 雙層 Markdown 提交與推送防禦架構 (Dual-Layer Markdown Commit & Push Strategy)
- **問題**：在無頭 Actions 環境下，可能因網路波動、detached HEAD 或批次提早中斷，導致寫入磁碟的 Markdown 樂評未成功推送到筆記庫倉庫。
- **決策**：
  1. **第 1 層（應用程式層 - `src/gitbook-publisher.js`）**：
     - 改用 `git branch --show-current` 取代脆弱的 `git rev-parse --abbrev-ref HEAD`，解決空倉庫 (0 commits) 下指令拋出 128 錯誤的問題。
     - 當偵測到 detached HEAD 時，推送目標強制映射為 `HEAD:main`，確保遠端分支正確接收。
     - 全量比對 `stdout` 與 `stderr` 處理 `nothing to commit, working tree clean`，避免拋出假性錯誤。
  2. **第 2 層（CI 工作流層 - `Push Reviews to Obsidian Vault` Step）**：
     - 在掃描管線結束後，由 Actions 步驟主動掃描 `social-dancing-notes` 目錄。
     - 若有未提交之 `new-releases/` 或 `SUMMARY.md`，自動補上 commit。
     - 比較本地 `HEAD` 與 `origin/main`，若本地超前則執行 `git push origin main`，形成雙重保險防禦。
  3. **降級回退機制**：未配置 `VAULT_PAT` 時，自動啟用本地 `data/mock-gitbook` 工作區，保證單機測試與無外部 Token 情況下管線平穩運行。

---

## 3. GitHub Secrets 環境變數配置清單 (Required Secrets)

於 GitHub 專案倉庫之 `Settings` -> `Secrets and variables` -> `Actions` 設定以下環境變數：

| Secret 名稱 | 是否必填 | 說明與安全設定建議 |
| :--- | :---: | :--- |
| `GEMINI_API_KEY` | **必填** | 用於調用 Google Gemini API 生成高品質專輯樂評。 |
| `SPOTIFY_CLIENT_ID` | **必填** | Spotify 開發者應用程式的 Client ID。 |
| `SPOTIFY_CLIENT_SECRET` | **必填** | Spotify 開發者應用程式的 Client Secret。 |
| `SPOTIFY_REFRESH_TOKEN` | **必填** | 使用者 Spotify 授權取得之 Refresh Token，用於自動換發短期 Access Token。 |
| `VAULT_PAT` (或 `GITBOOK_PAT`) | **必填 (若需同步)** | 跨 Repo 推送存取憑證。建議建立 Fine-grained PAT：僅授權 `sunpochin/social-dancing-notes` 且僅開放 `Contents: Read and write`。 |

---

## 4. 測試與驗證 (Verification)

- **單元測試全數通過**：執行 `npm test`，16 組測試套件、113 項測試全數通過（100% 通過率）。
- **新增 GitOps 同步單元測試** (`tests/gitbook-publisher.test.js`)：
  - 驗證真實 Git 倉庫中的變更暫存與提交。
  - 驗證「無變更」狀態下之冪等略過（捕獲 stdout `nothing to commit`）。
  - 驗證 detached HEAD 狀態下之目標分支推導與 `HEAD:main` 語法相容。
- **工作流語法結構驗證**：`.github/workflows/daily-scan.yml` 通過 YAML 解析器驗證。
