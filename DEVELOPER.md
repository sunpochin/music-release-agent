# music-release-agent 开发指南

已獨立的音樂釋出掃描與分析代理程式，專注做三件事：

- Spotify OAuth 與關注藝人新發行掃描
- AI 生成繁體中文樂評
- 將樂評寫入本地 `gitbook/` 並透過 Git 推送

## 結構

- `server.js`: Spotify OAuth callback server
- `scan-releases.js`: 一鍵執行掃描、評論與發布流程
- `src/spotify-auth.js`: Spotify token 管理
- `src/spotify-client.js`: Spotify / MusicBrainz 掃描與降級邏輯
- `src/album-reviewer.js`: Gemini / Ollama 樂評生成
- `src/gitbook-publisher.js`: GitBook 檔案與 GitOps 發布

## 快速開始

```bash
npm install
cp .env.example .env
npm run dev
```

打開：

- `http://localhost:3011/login/spotify`

授權成功後執行：

```bash
npm run scan
```

## 注意

- `spotify_tokens.json`、`data/scanner-state.json`、`data/system-state.json` 都是本地狀態，不會提交。
- `gitbook/` 是輸出內容，會被 `src/gitbook-publisher.js` 維護與提交。
- `scan-releases.js` 依賴目前 repo 是 Git 工作樹，且已設定好遠端。

## Spotify 禮貌掃描與極限分析

本專案實施了最嚴格的 Spotify API 防禦性禮貌掃描機制，旨在設定的週期天數（`SCAN_CYCLE_DAYS`，預設為 `7` 天，即一週跑完一輪）內完成一次完整掃描，同時保證絕不因高頻率請求而觸發 Spotify 封鎖。

### 1. 核心禮貌機制設計
* **環境變數配置 (`SCAN_CYCLE_DAYS`)**：
  可在 `.env` 中設定 `SCAN_CYCLE_DAYS=7`。若要改成一天掃描完，可改為 `SCAN_CYCLE_DAYS=1`。
* **動態分批尺寸 (Dynamic Batch Sizing)**：
  配合 PM2 設定每 3 小時執行一次（每天執行 8 次）。
  每次掃描的批次大小公式為 `Math.max(15, Math.ceil(total_artists / (SCAN_CYCLE_DAYS * 8)))`。
  這可以確保在規定的週期內，**必定能將所有關注藝人輪流掃描完一遍**。
* **隨機防禦性延遲 (Politeness Delay)**：
  在對每個藝人發送請求前，隨機等待 `1000ms ~ 2000ms`（平均 `1500ms`）。
* **藝人掃描後冷卻 (Post-Artist Cooldown)**：
  每掃完一位藝人，強制休眠 `1000ms`。
* **全域限速閥門 (Global Bottleneck Throttle)**：
  所有對 Spotify API 的請求之間均強制間隔至少 `1000ms`（由全域排隊 Mutex 鎖 `spotifyLock` 控制）。
* **雙源自動降級**：
  若不幸遭遇 429 Rate Limit，系統會自動在該批次中降級改為查詢 `MusicBrainz` API，並在 24 小時內累計 429 達到 2 次時，啟動 24 小時強制冷卻保護。

---

### 2. 藝人規模與掃描時間極限分析（以預設的一週週期計算）

依據上述「禮貌機制」，平均掃描一位藝人（含隨機等待與冷卻）約需花費 **`2.8 秒`**。
在 `SCAN_CYCLE_DAYS=7`（每週掃描一輪，共 56 次排程執行）的情境下：

#### A. 109 位藝人（目前規模）
* **每次執行數量**：`Math.max(15, Math.ceil(109 / 56)) = 15` 位藝人。
* **每次執行時間**：`15 * 2.8 秒 = 42 秒`。
* **結論**：極度輕鬆安全，每天總運行時間約 5.6 分鐘。

#### B. 2,000 位藝人（中大型關注量）
* **每次執行數量**：`Math.ceil(2000 / 56) = 36` 位藝人。
* **每次執行時間**：`36 * 2.8 秒 = 100.8 秒`（約 **`1.7 分鐘`**）。
* **結論**：非常優雅！每次執行只需不到 2 分鐘，對 Spotify API 完全沒有任何負載壓力。

#### C. 5,000 位藝人（Spotify 官方帳號硬性上限）
* **每次執行數量**：`Math.ceil(5000 / 56) = 90` 位藝人。
* **每次執行時間**：`90 * 2.8 秒 = 252 秒`（約 **`4.2 分鐘`**）。
* **結論**：極度穩健！這是 Spotify 個人帳號關注藝人的官方硬性限制（個人帳號關注上限為 5,000 人）。在此極限下，每次執行僅需約 4.2 分鐘（每天累計運作約 33.6 分鐘），遠低於 3 小時的排程間隔，對 Spotify 城堡極致友善，完全不用擔心 429 或被封鎖。

#### D. 65,535 位藝人（極端想像情況）
如果我們打破 Spotify 限制（改用外部藝人清單而非 API 關注清單）掃描 65,535 位藝人：
* **每次執行數量**：`Math.ceil(65535 / 56) = 1171` 位藝人。
* **每次執行時間**：`1171 * 2.8 秒 = 3278.8 秒`（約 **`54.6 分鐘`**）。
* **結論**：
  * 若在一週內跑完：每次執行耗時約 55 分鐘，小於 3 小時的排程間隔，理論上可行且不會造成 PM2 執行重疊與阻塞。
  * 若要改成「一天跑完（`SCAN_CYCLE_DAYS=1`）」：每次執行數量將暴增至 `Math.ceil(65535 / 8) = 8192` 位藝人，在最嚴格禮貌延遲下每次需要跑 **`6.37 小時`**，這會造成嚴重的時間赤字與排程重疊阻塞（PM2 每 3 小時就會重複重啟）。
  * **建議**：若未來有如此龐大的藝人資料庫需求，應採用多憑證輪替 (Credential Rotation) 與代理伺服器 (Proxy Pool) 分散請求，並將掃描週期拉長。


