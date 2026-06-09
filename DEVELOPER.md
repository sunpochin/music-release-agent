# music-release-agent 開發與技術架構指南

![Test Coverage](./coverage-badge.svg)

本指南專門為開發者與面試官準備，詳細說明了專案的目錄結構、快速開始步驟、核心的禮貌掃描分析、後端重構所套用的 SOLID 原則與設計模式，以及社群發布 SaaS（如 Socialync）如何突破巨頭 API 牆的架構思維。

---

## 📂 目錄結構

*   `server.js`: 用於 Spotify OAuth 流程的 Callback 伺服器與前端 API。
*   `scan-releases.js`: CLI 進入點，一鍵執行掃描、分析與 GitOps 發布流程。
*   `scan-releases-dry.js`: 零配置的離線模擬發行掃描器（面試官 Dry Run 專用）。
*   `src/spotify-auth.js`: Spotify 授權 Token 的管理與自動刷新。
*   `src/spotify-client.js`: 向下相容的外觀層 (Facade / Adapter)，組合並代理調用新的核心服務。
*   `src/album-reviewer.js`: 深度樂評大腦服務，整合 Gemini 雲端與本地 Ollama 降級路由。
*   `src/gitbook-publisher.js`: 負責處理 Markdown 輸出與 GitOps 的同步發布器。
*   `src/services/`: 職責單一的核心服務（Cache、SystemState、SpotifyApiClient、Playback、CircuitBreaker）。
*   `src/strategies/`: 新發行探索策略（SpotifyStrategy、MusicBrainzStrategy）。
*   `src/scanner/`: `ReleaseScanner` 掃描協調器（繼承自 EventEmitter）。
*   `tests/`: 透過 `vitest` 撰寫的 21 個單元與基準防禦測試案例。

---

## ⚡ 快速開始

### 1. 安裝與設定
```bash
npm install
cp .env.example .env
npm start
```

### 2. 本地開發與運行
*   **啟動驗證伺服器**：打開 `http://localhost:3011/login/spotify` 進行 OAuth 授權，成功後 Token 將持久化儲存於 `spotify_tokens.json`。
*   **執行生產掃描管線**：執行 `npm run scan`。
*   **執行零配置模擬器**：執行 `npm run scan:dry`。
*   **運行 21 個單元測試**：執行 `npm run test`。
*   **運行覆蓋率測試並更新 Badge**：執行 `npm run test:coverage`。

---

## 🎵 Spotify 禮貌掃描與極限分析

本專案實施了嚴格的防禦性禮貌掃描機制，旨在於 `SCAN_CYCLE_DAYS` 週期內完成一次完整掃描，保證不因高頻率請求而被 Spotify 城堡限流鎖定。

*   **動態分批尺寸 (Dynamic Batch Sizing)**：配合定時排程，批次大小公式為 `Math.max(15, Math.ceil(total_artists / (SCAN_CYCLE_DAYS * 8)))`。
*   **隨機防禦延遲 (Politeness Delay)**：呼叫 API 前隨機等待 `1000ms ~ 2000ms`。
*   **全域限速閥門 (Global Bottleneck Throttle)**：所有請求使用全域排隊 Mutex 鎖 `spotifyLock`，強制請求間隔不低於 `1000ms`。
*   **雙源降級冷卻**：遭逢 429 時自動降級切換至 `MusicBrainz` 策略，並在 24 小時內累計 2 次 429 時，啟動 24 小時降級冷卻封鎖。

---

## 🛠️ 後端 SOLID 原則與設計模式實踐

為了向面試官展現殿堂級的軟體工程素養與代碼美感，我們對後端代碼進行了基於 SOLID 原則的解耦，並引入了四大設計模式。

### 1. SOLID 設計原則
*   **單一職責原則 (SRP)**：
    *   `CacheService`：專職管理本地快取 JSON 的生命週期與讀寫。
    *   `SystemStateService`：專職管理系統全域鎖定狀態與掃描時間進度。
    *   `SpotifyApiClient`：專職處理低階 HTTP 通訊、Token 自動刷新、限速排隊與 429 緩衝重試。
    *   `PlaybackService`：專職處理播放器設備與歌曲搜尋控制。
    *   `ReleaseScanner`：專職處理歌手掃描排程與調度。
*   **開放封閉原則 (OCP)**：
    *   定義了 `ReleaseDiscoveryStrategy` 抽象策略基底。若要新增第三個探索來源（如 Discogs API），只需新增一個繼承此類別的 Strategy 元件，並傳入 Scanner 協調器的策略鏈陣列中，**核心掃描邏輯無須修改任何一行代碼**。
*   **里氏代換原則 (LSP)**：
    *   所有探索策略的 `execute` 介面皆會將資料正規化為統一的 `NormalizedAlbum` 物件格式，確保了策略與後續 AI 分析、發布器的無痛代換與相容性。
*   **介面隔離原則 (ISP)**：
    *   將前台使用者播放控制（`PlaybackService`）與背景 CLI 排程掃描 API 職責完全分離，互不干涉。
*   **依賴反轉原則 (DIP)**：
    *   服務類別之間完全採用 **建構子依賴注入 (Constructor Dependency Injection)** 傳入相依元件（如 `ReleaseScanner` 建構子接收 `stateService` 與 `strategies` 陣列）。移除了對外部模組的直接硬編碼引用，以實現高可測試性（Testability）。

### 2. 四大核心設計模式
*   **策略模式 (Strategy Pattern)**：封裝不同音樂平台的發行探索邏輯（Spotify 與 MusicBrainz），並依降級鏈輪詢。
*   **觀察者模式 (Observer Pattern)**：`ReleaseScanner` 繼承自 `EventEmitter`。掃描進度與降級事件均以 `emit` 廣播，解耦了業務核心與控制台輸出。
*   **熔斷器模式 (Circuit Breaker Pattern)**：設計具備 `CLOSED`、`OPEN`、`HALF-OPEN` 三種狀態的 `CircuitBreaker` 狀態機，在雲端 Gemini 連續失敗時觸發熔斷，直接退化呼叫本地 Ollama 模型，並在冷卻後自動嘗試復原，展示了微服務高可用系統設計。
*   **外觀模式 (Facade Pattern / Adapter)**：將舊的 `spotify-client.js` 改寫為**外觀層**，內部組合並代理（Delegate）至各個新服務，實現對 `server.js` 與 `scan-releases-dry.js` 舊代碼 100% 的向下相容性。

### 3. TDD (Test-Driven Development) 測試驅動開發
專案引進了 `vitest` 做為現代測試框架，並完全實踐 TDD 流程：
1.  **Red (測試失敗)**：先為 `CircuitBreaker`、`ReleaseScanner`、`CacheService` 及 `SpotifyApiClient` 撰寫測試，定義邊界並確認測試失敗。
2.  **Green (測試通過)**：實作對應服務使其通過測試。
3.  **Refactor (重構)**：在有測試防護網保護的前提下，進行程式碼優化。
*   目前共有 7 組測試檔、21 個測試案例，**100% 順利通過測試**！

### 4. 測試覆蓋率分析與 32% 未覆蓋解釋 (面試高階考點)
當面試官挑戰：「為什麼核心邏輯覆蓋率很高，但整體的總語句覆蓋率是 68%？那未覆蓋的 32% 是什麼？」您可以給出符合資深全端與架構師素養的專業回答：
*   **未覆蓋代碼分布**：
    *   [musicbrainz-client.js](./src/musicbrainz-client.js) (~77% 未覆蓋)：處理實體 HTTP 聯網請求。在測試中被 Mock 擋板隔離，防止執行真實測試時觸發 MusicBrainz 官方 1 req/s 限制而導致 IP 遭封鎖。
    *   [spotify-auth.js](./src/spotify-auth.js) (~64% 未覆蓋)：處理三方 OAuth 跳轉登入、憑證交換與本地 Token JSON 的持久化讀寫。這類 UI 跳轉與檔案系統 I/O 流程不適合納入單元測試。
    *   [playback-service.js](./src/services/playback-service.js) (~55% 未覆蓋)：控制實體 Spotify 播放器設備（如調整音量、下一首）。此類控制需要當前帳號有 Premium 資格並綁定真實播放器，在單元測試中皆透過 Mock 隔離。
*   **軟體工程架構思維（測試金字塔）**：
    *   **確定性與測試速度 (No Flaky Tests)**：單元測試專注於驗證「業務邏輯（Business Logic）」與「狀態機（State Machine）」（例如 `CircuitBreaker` 熔斷器為 100% 覆蓋，`CacheService` 與 `ReleaseScanner` 為 90%+ 覆蓋）。單元測試不應實體聯網或寫檔，以防外部服務偶發性當機或頻率限制導致測試隨機失敗。
    *   **職責分工**：這些未覆蓋的部分屬於 E2E/整合測試（如使用 Playwright 或 Cypress 進行端到端模擬）的範疇，在單元測試階段透過 Mock 隔離是維持高測試速度與穩定性的標準做法。

---

## 🛡️ 防禦性快取修正說明

在 `src/spotify-client.js` 中，我們在讀取本地快取後加入以下保護程式碼：
```js
const cache = await cacheService.read();
// 防禦性程式設計：若舊版快取缺少 artist_albums 欄位，預設為空物件
cache.artist_albums = cache.artist_albums || {};
const now = Date.now();
```
這段程式碼的目的在於防止 **舊版快取檔案** 沒有 `artist_albums` 欄位時，直接存取 `cache.artist_albums[artistId]` 會拋出 `TypeError`，從而導致整個掃描流程崩潰。加入預設空物件後，即使快取缺失該欄位，程式仍能正常走向快取檢查與寫入流程。

> **防禦性程式設計原則**：在系統邊界或向後相容層加入安全預設值，確保舊資料不會破壞新程式的執行。此做法與我們在 `MusicBrainzDiscoveryStrategy` 中加入 `rawAlbums = (await albumsFn(...)) || []` 的防禦性處理屬同理。

此變更已同步於測試，所有單元測試均成功通過，確保功能在升級過程中的穩定性。

在面試中，面試官經常會挑戰一個極具深度的架構問題：**「像 Socialync 這樣的社群排程工具，是如何突破 Meta、LinkedIn 這些巨頭設下的企業審查、OAuth 驗證與嚴格 API 牆的？」**

這背後涉及到現代 SaaS 開發的商業與架構突破策略：

### 策略一：第三方整合服務供應商（Unified API Provider）
這是獨立開發者（Indie Hacker）在起步與規模化時最常用、最聰明的底層大絕招。

*   **商業機密**：Socialync 其實不需要直接向 Meta、LinkedIn、TikTok、YouTube 官方一家家申請權限並走完繁瑣的企業認證，他們直接串接了 Unified Social API 中間商（例如 Ayrshare、bundle.social、Zernio 等）。
*   **運作機制**：
    1.  中間商已經完成了各大社群巨頭的最高規格企業驗證。
    2.  中間商提供統一且極簡的 API 給開發者（例如只要發送 `POST /v1/posts` 附帶文案與圖片，中間商就會分發至 10 個不同的平台）。
    3.  當用戶點擊連結帳號時，彈出的登入視窗實際上是中間商代為持有的 Meta 官方 App 登入頁面，授權成功後的 Token 會託管在中間商端。
*   **架構考量**：雖然中間商每個月收費不斐，但這能幫助產品在一週內「Ready for Production」，將時間成本轉移給付費用戶的訂閱費覆蓋。

### 策略二：利用 Instagram 商業帳號「借道」Threads
Threads 的權限模型在 Meta API 體系中，與 Instagram (IG) 有著極深的帳號綁定。

*   **授權連動**：
    1.  Threads 誕生之初便寄生於 IG 帳號體系。Meta 開放的官方 Threads API 規範中，只要用戶將 Threads 與其 IG 商業/創作者帳號 (Instagram Professional Account) 進行綁定，系統就能直接使用 Instagram Graph API 的既有企業授權管道。
    2.  老牌軟體公司或中間商只需要持有 Instagram 的企業 App 權限，就能透過「IG 商業帳號管理員」角色直接讀寫 Threads，無須為 Threads 去經歷一套毫無交集、從零開始的審核地獄。
*   **安全防禦 (XSS & Rate Limit)**：為了防止發布時因為大量用戶同時推送造成 429 限流，系統內部會在後端建構與本專案類似的 **全域 Mutex Queue 排隊機制**，並針對 AI 翻譯生出的歌詞進行 XSS 防禦過濾（Escape HTML），確保發送給巨頭 API 的資料結構完全合法、安全。

---

## 🛣️ 前後端路由架構與 React Router 整合 (面試亮點)

為了解決點選專輯後的狀態同步與 Deep Linking (深層連結) 問題，我們在前端導入了 `react-router-dom` 進行 URL 狀態管理：

*   **狀態與路由同步**：
    *   廢除以往僅保存在 React Component State 的手動專輯選取狀態，將其徹底與瀏覽器網址列 `/album/:albumId` 綁定。
    *   透過 `useParams()` 動態獲取 `:albumId` 路由參數，並於 `albums` 資料載入完成後進行安全匹配與狀態同步。
    *   在專輯選擇動作中，改用 `useNavigate()` 控制路徑跳轉，完美支援瀏覽器「上一頁/下一頁」的前後歷史紀錄導航。
*   **後端 Express Wildcard Fallback 路由**：
    *   在 `server.js` 尾端設置 `app.get('*')` 路由攔截非 API 的所有前端請求，自動發送 `dashboard/dist/index.html`，以避免使用者重新整理頁面 (F5) 或直接輸入網址列進入 `/album/:albumId` 時造成後端 Express 拋出 404 找不到路由的問題，這充分體現了單頁應用程式 (SPA) 的伺服器配合規範。
*   **非同步資料載入與 Race Condition 防禦**：
    *   前端載入專輯列表為非同步請求。為防 URL 解析時 `albums` 陣列尚未取回而將匹配判定為無效，增加了 `albums.length > 0` 的守衛閘門 (Guard)，唯有列表確實加載後才與路由參數進行同步。
