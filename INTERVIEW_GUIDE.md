# 🎓 Music Release Agent 面試入口與導覽指南

本文件旨在協助您在面試時快速切入重點，用最精準的工程語言向面試官（包括開發主管、架構師與 Hiring Manager）展示本專案的架構亮點、技術難題與設計取捨。

---

## ⏱️ 60 秒極速 Pitch

> 「我做的是一個自動化音樂掃描與 AI 樂評推播系統——**Music Release Agent**。
> 它能自動監聽追蹤藝人的最新專輯，透過 Gemini AI 撰寫雙語樂評，並透過 GitOps 自動部署至 GitBook 發行。
> 因為音樂掃描是『讀取型』、社群發文是『寫入型』，我遵循 **SOLID 單一職責原則 (SRP)**，將發文功能拆分為獨立的微服務 **social-post-service**。
> 專案亮點在於**容災與效能優化**：它在 Spotify 遭限流時能自動降級至 MusicBrainz，且為繞過 iOS Web Share API 的非同步點擊限制，我實作了『背景非同步圖卡預渲染』，將圖片渲染優化了 33% 記憶體佔用。
> 另外，我特地設計了 **Dry Run 離線模擬沙箱**，讓您在不需要任何 API Key 的情況下，花 3 分鐘就能完整驗證整條發行與發文管線。」

---

## 🎪 3 分鐘完美 Demo 劇本

### 第一步：展示背景永動小精靈 (30 秒)
- 開啟終端機，執行 `npx pm2 list`。
- 指著畫面說明：
  > 「本專案採用 **PM2 進行進程管理**，在背景託管了 Express 後端、Vite 前端、Cron 定時掃描器與發文微服務，保證服務永不斷線與崩潰自動重啟。」

### 第二步：現場執行 Dry Run 驗證 (45 秒)
- 在終端機執行：`npm run scan:dry`。
- 觀察 console 輸出的掃描、AI樂評、目錄更新與 GitOps 提交流程，並開啟本地目錄 `data/mock-gitbook/` 檢視自動產生的 Markdown 樂評與大綱目錄。
  > 「這套 Dry Run 管線利用 Mock 機制隔離了 Spotify 與 Gemini。這證明了整個系統的**可測試性與可維護性**，面試官不需要準備任何 credentials 就能親自驗證我的代碼。」

### 第三步：瀏覽 Dashboard 與 AI 歌詞翻譯 (45 秒)
- 打開瀏覽器 [http://localhost:5173](http://localhost:5173)。
- 點選左側隨意一張專輯卡片，展示流暢的毛玻璃 UI。點選右側的歌曲，顯示「正在生成雙語歌詞對照...」，稍後展示 side-by-side 的原文與繁體中文歌詞。
  > 「因為 Spotify API 不提供歌詞，我設計了 `LyricsTranslator` 服務，透過 Gemini AI 抓取並翻譯。這裡我實作了狀態化逐行解析器，防止 XSS 注入並確保 HTML 語意完全符合標準。」

### 第四步：展示 IG 分享卡導出與社群自動發佈 (60 秒)
- 點選「匯出 IG/TikTok 限動卡」，手機端會同步拉起原生分享面板，電腦端則直接下載 9:16 的 PNG 圖卡。
- 點選「發佈到社群」按鈕，顯示載入動畫，隨後跳出發佈成功 Toast。
  > 「iOS Web Share API 限制非同步觸發，我的優化是在用戶選定曲目的當下就在背景預先將卡片轉為二進位 Blob 檔案，從而實現了 100% 同步的原生調用，並將圖片渲染記憶體佔用降低了 33%。
  > 點選發文按鈕時，後端透過 REST API 與 `social-post-service` 微服務溝通，以 `202 Accepted` 非同步接收任務，在背景排隊發佈，避免阻塞主執行緒。」

---

## 🧠 我會主動聊的 5 大技術架構亮點

### 1. 雙源容災與熔斷降級 (Failover & Circuit Breaker)
- **問題**：Spotify API 速率限制嚴格，且可能因網路波動失效。
- **解法**：實作 `CircuitBreaker` 熔斷器。若 24 小時內觸發 2 次 `429 Too Many Requests`，會強制禁用 Spotify API 24 小時。在此期間，掃描器自動切換至備用的 **MusicBrainz API**，解析為相容 schema，確保發行管線持續運轉。

### 2. 微服務拆分與單一職責 (SRP & Decoupling)
- **問題**：將「發佈到社群（如 Facebook/X/Threads）」功能塞入原專案會使程式碼臃腫，且兩個功能的 SLA 與資源擴展需求完全不同。
- **解法**：開闢獨立的 `social-post-service` 倉庫。透過輕量 REST API 進行非同步通訊。這展示了微服務邊界劃分與系統解耦的實戰思考。

### 3. 多平台發文的策略模式 (Strategy Pattern)
- **問題**：不同社群平台 API 與認證機制大相逕庭，未來隨時可能更換平台或 Unified API 供應商（如 Ayrshare）。
- **解法**：在發文微服務中實作 `PostingStrategy` 抽象基類，衍生出 `MockStrategy` 與 `AyrshareStrategy`。切換策略只需在 `.env` 中修改，完全符合 **開放封閉原則 (OCP)**。

### 4. iOS 原生分享同步性繞過與記憶體優化 (Web Share API)
- **問題**：iOS Safari 對 `navigator.share` 的呼叫限制極為嚴格，必須由人類點擊同步觸發。傳統「點擊 → 開啟 canvas 渲染成 base64 → 再 fetch 轉 file → 呼叫 share」的非同步鏈會被 iOS 直接封鎖並報錯。
- **解法**：採「背景非同步預生成」策略。用戶選取專輯時，就於背景產生 Blob 並暫存在 React State 中。點擊按鈕時直接讀取 State 同步呼叫。並捨棄 Base64，直接以 `canvas.toBlob` 輸出二進位，節省 33% 記憶體。

### 5. 防禦性程式設計與相容性 (Defensive Programming)
- **問題**：舊版本本地快取檔案中若沒有特定欄位，更新程式碼後會直接拋出 `TypeError` 導致伺服器崩潰。
- **解法**：在讀取快取後進行防禦性初始化（如 `cache.artist_albums = cache.artist_albums || {}`），避免老舊快取格式崩潰，確保系統高魯棒性。

---

## 💬 常見面試官 QA 準備

### Q1：為什麼不把歌詞跟樂評存到資料庫（MySQL/PostgreSQL），而是用 Markdown 檔案？
> 「因為這個系統的核心定位是 **GitOps 驅動的自動化出版**。
> Markdown 是 GitBook 的 **Single Source of Truth (唯一真實來源)**，我們可以直接透過 Git 紀錄來追蹤樂評的版本歷史、協作修改，並借助 GitBook 雲端服務免費托管與渲染網站，省去自建資料庫、備份與維護高昂網頁伺服器的成本。
> 為了兼顧讀取效能，我們在本地使用 JSON 作為讀取快取層，這是一個非常輕量、高效的雙腦架構設計。」

### Q2：為什麼不要在 music-release-agent 中直接發文，非得大費周章拆成另一個微服務？
> 「首先是**職責不同**：掃描樂評是讀取與分析型任務，而發文是具備高網路延遲、需要重試機制與死信佇列的寫入型任務。
> 其次是**依賴性與資源擴展**：發文服務未來若需要支援高併發，會引進 Redis 與 BullMQ 等訊息佇列。如果直接塞在同一個專案，會迫使音樂掃描後端也背負這些重型依賴。拆分後，兩者各自獨立測試與部署，其中一個服務當機，完全不影響另一個核心功能運轉。」

### Q3：如果 Gemini API 的限額用完了，系統如何應對？
> 「在我們的設計中，`lyrics-translator.js` 捕捉到了 API 失敗時，會優雅回傳友好錯誤訊息提示用戶，並記錄錯誤日誌。核心的音樂庫掃描仍然正常運作，前端亦保留了本地快取的歌詞，確保系統在部分失能時不會產生連鎖崩潰。」

---

## 🛠️ hiring manager 版本的架構設計模式對照表

本專案實踐了多個經典的設計模式與設計原則，是向資深工程師證明的最佳素材：

| 🎨 設計模式 / 原則 | 📍 專案中的實際應用場景 |
| :--- | :--- |
| **Strategy Pattern (策略模式)** | 音樂掃描層（`SpotifyStrategy` / `MusicBrainzStrategy`）與社群發文層（`MockStrategy` / `AyrshareStrategy`），動態抽換實體邏輯。 |
| **Factory Pattern (工廠模式)** | 根據環境變數 `STRATEGY` 動態產生發文策略執行個體。 |
| **Circuit Breaker (熔斷器)** | 監控 Spotify API 429 狀態，累計超標則熔斷，防止憑證遭三方持續限流懲罰。 |
| **Single Responsibility (SRP)** | 將音樂系統（:3011）與發文系統（:3012）獨立分離。 |
| **Dependency Inversion (DIP)** | `PostManager` 依賴於 `PostingStrategy` 抽象介面，而非實體 Mock/Ayrshare 類別，方便單元測試進行 Mock 注入。 |
| **Dependency Injection (DI)** | 透過建構子注入三方 API Client 與快取服務，降低模組耦合度。 |
