# PR Review 安全與正確性修正說明文件

這份文件記錄了專案中 PR Review 提出的安全與程式碼正確性問題，並以「小朋友解釋法」提供簡化好懂的說明，同時附帶對應的註解與修正內容。

---

## 1. XSS 漏洞防護（HTML 轉譯邏輯）

### 🚨 PR 審查回饋
直接將來自外部 API（例如 Gemini 或 Ollama）的未轉譯內容，透過 `dangerouslySetInnerHTML` 渲染至瀏覽器中，會造成嚴重的跨網站指令碼攻擊 (XSS) 漏洞。應在將每一行文字包裹至 HTML 標籤前先進行 HTML 轉譯。

### 👶 小朋友解釋法
> 想像 AI 給我們的內容是一張可能有藏有壞人（惡意腳本）的畫。
> 如果直接貼到牆上（`dangerouslySetInnerHTML`），壞人就會跑出來做壞事（XSS 攻擊）。
> 所以我們需要一個安檢門（`escapeHtml`），把 `<` 和 `>` 這些可能變成壞人的符號，
> 通通貼上安全膠帶（轉譯為 `&lt;` 和 `&gt;`），這樣壞人就只能乖乖當字元展示，不能活過來作怪了！

### 📝 程式碼註解
```javascript
// 輔助函式：將 Markdown 語法安全且語意化地轉譯為具有 Tailwind 樣式的 HTML
// 【小朋友解釋法】：
// 想像 AI 給我們的內容是一張可能有藏有壞人（惡意腳本）的畫。
// 如果直接貼到牆上（dangerouslySetInnerHTML），壞人就會跑出來做壞事（XSS 攻擊）。
// 所以我們需要一個安檢門（escapeHtml），把 `<` 和 `>` 這些可能變成壞人的符號，
// 通通貼上安全膠帶（轉譯為 &lt; 和 &gt;），這樣壞人就只能乖乖當字元展示，不能活過來作怪了！
```

### 🛠️ 修正實作
請參閱 [AILyricsPanel.jsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/components/AILyricsPanel.jsx)。

---

## 2. 異步請求競態條件（Race Condition）防護

### 🚨 PR 審查回饋
當使用者快速切換不同專輯時，會連續發出多個異步 API 請求。因為回傳時間不確定，較慢回傳的舊請求結果可能會覆寫當前選中專輯的歌曲列表。我們應在 `useEffect` 中加入 `active` 狀態旗標以忽略過期的 Response。

### 👶 小朋友解釋法
> 想像你是一個貼心的圖書館員，小明（使用者）點了「草莓專輯」，你立刻打電話給倉庫（API）請人送過來。但小明很急，在幾秒鐘內一直改主意，連續點了「蘋果專輯」、「香蕉專輯」和「西瓜專輯」。
> 結果，你的倉庫送貨員速度有快有慢：
> - 「西瓜專輯」的送貨員跑得最快，一下子就送來了，你高興地把西瓜專輯的歌單擺在桌上。
> - 可是沒想到，一開始那個被點的「草莓專輯」送貨員走錯路，現在才氣喘吁吁地把草莓專輯送來。
> - 如果你不做任何防備，直接把草莓專輯蓋在桌上，小明就會看到西瓜專輯的標題，裡面卻裝著草莓專輯的歌！這就叫做「競態條件 (Race Condition)」。
> 
> 所以我們的解決辦法是：每當小明改主意點新專輯時，我們就發給當前的任務一個「有效標記 (`active`)」，當我們改選新專輯時，就把舊的標記作廢（`active = false`）。這樣就算走錯路的「草莓專輯」好不容易送到了，圖書館員一看它的標記已經失效了，就會說：「這已經過期了，不要收！」直接丟掉，只留下最新選的「西瓜專輯」，桌上就不會亂成一團了。

### 📝 程式碼註解
```javascript
// 【小朋友解釋法】：
// 當快速切換專輯時，舊的送貨員（舊的異步請求）可能會比較慢把歌單送來，不小心蓋掉最新點的歌單。
// 我們加一個「有效標記」(active)。每當切換專輯時，就把上一次的標記設成失效 (false)；
// 這樣就算舊的歌單送到了，我們也會因為它失效而直接丟掉，只留最新點的歌單！
```

### 🛠️ 修正實作
請參閱 [App.jsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/App.jsx)。

---

## 3. 手動觸發異步請求競態條件防護（Ref 方式：單曲分析與歌詞翻譯）

### 🚨 PR 審查回饋
如果使用者在歌詞加載或單曲分析加載期間切換單曲，先前單曲的非同步 fetch 回應會覆寫新選中單曲的數據（如歌詞或分析）。我們應該定義一個隨時指向最新 `selectedTrack` 的 `selectedTrackRef`，並在 Promise 解析時確認該單曲是否仍為當前選中的單曲。

### 👶 小朋友解釋法
> 想像你是一個貼心的圖書館員，小明（使用者）點了「歌曲 A」並按下「尋找歌詞」或「AI 分析」。你立刻打電話給倉庫（API）請人送歌詞或寫報告。
> 但這需要一點時間。在等待的過程中，小明又切換到了「歌曲 B」。
> 當倉庫好不容易把「歌曲 A」的歌詞或報告送過來時，如果你直接貼在螢幕上，小明就會在看著「歌曲 B」的同時讀到「歌曲 A」的內容，畫面對不起來！
> 
> 為了解決這個問題，我們在開始寫報告時先拿小紙條記下當時的歌曲編號（`trackIdAtStart`）。同時，我們裝了一個「監視器」(`selectedTrackRef`)，隨時盯著小明現在正在看哪首歌。
> 當資料送達時，我們看一下監視器顯示的歌是不是跟小紙條上寫的一樣。只有一樣的時候，我們才把內容貼上螢幕；如果小明已經切換到別首歌了，我們就直接把資料丟掉，不影響目前新歌的畫面！

### 📝 程式碼註解
```javascript
// 【小朋友解釋法】：
// 當我們去搜尋並翻譯歌詞（或分析單曲）時，如果期間使用者換了歌，
// 結果送來後就會不小心蓋掉新歌的內容！
// 所以我們在開始時用小紙條記下歌曲編號 (trackIdAtStart)，
// 送達後比對「監視器」(selectedTrackRef) 是否還是同一首，一樣才更新畫面！
```

### 🛠️ 修正實作
請參閱 [App.jsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/App.jsx) 中的 `handleFetchLyrics` 與 `handleAnalyzeTrack` 函式。

---

## 4. 準備就緒檢查（Readyz）健康度異常防護

### 🚨 PR 審查回饋
如果 `socialClient.isHealthy()` 發生網路錯誤或 DNS 解析失敗而 Reject，會導致整個 `Promise.all` 失敗，使 `/readyz` 路由回傳 500 Internal Server Error，而非預期的 503 或是服務降級狀態。我們應該捕獲 `socialClient.isHealthy()` 的任何錯誤，並將其預設為 `false`。

### 👶 小朋友解釋法
> 想像你要開一間派對，開場前你要確認四件事都準備好：地板有沒有掃、食物有沒有擺好、飲料有沒有冰，以及打電話給特別嘉賓（`socialClient`）問他能不能到。
> 如果這四個準備動作中，有任何一個在檢查時「出了嚴重的意外」（例如打給嘉賓結果電話線被挖斷、直接斷線報錯），在沒有防護的情況下，整個派對會立刻被宣告取消、大門深鎖（伺服器回傳 500 Internal Server Error 錯誤）。
> 但其實，就算特別嘉賓聯絡不上，派對依然可以照常舉辦，只是變成「降級（degraded）狀態」而已。
> 
> 所以我們在聯絡嘉賓的任務上加一個「保險絲」(`.catch(() => false)`)。這樣一來，即使電話打不通（發生錯誤），我們也只會當作他「無法出席（false）」，其他三項主要事項準備好，派對依然能順利開門迎客！

### 📝 程式碼註解
```javascript
// 【小朋友解釋法】：
// 打電話給特別嘉賓確認健康狀態時，如果電話線斷了（請求報錯），不要讓整個派對取消（Promise.all 崩潰回傳 500）。
// 我們加上保險絲 (.catch(() => false))，打不通就當他無法出席 (false) 就好，派對照常開門！
```

### 🛠️ 修正實作
請參閱 [server.js](file:///Users/pac/codes/interview/music-release-agent/server.js)。

---

## 5. PM2 進程孤兒化防護與熱重載設定

### 🚨 PR 審查回饋
在 PM2 中使用 `npm` 作為 script 並傳入 `run dev` 作為參數，在停止或重啟應用程式時，極易導致 Node 進程孤兒化（Orphaned Processes）。PM2 發送關閉訊號給 npm 進程時，npm 往往無法將其轉發給子 Node 進程，導致 Port 被佔用而使下一次啟動失敗。直接執行 `server.js` 並由 PM2 處理 watch 機制會更安全。

### 👶 小朋友解釋法
> 想像你（PM2）是一個安檢主管，底下僱用了一個叫做「NPM 經理（`npm run dev`）」的外包負責人，由他再去把真正的「伺服器小兵（`server.js`）」叫起來工作。
> 當你想下班把大家叫回家（重啟或關閉服務）時，你對 NPM 經理喊一聲：「下班了，收工！」
> 
> 但這個 NPM 經理很健忘，他拍拍屁股自己走了，卻忘記通知底下的「伺服器小兵」。結果伺服器小兵還在辦公室一直佔著電腦（佔用 Port 埠），下次當你想要重新開工時，新來的小兵就會因為位置被佔走而沒辦法工作。
> 
> 所以我們的解決辦法是：不要僱用中間這個 NPM 經理，讓安檢主管（PM2）直接管理並盯著「伺服器小兵（`server.js`）」。同時，我們給主管一個望遠鏡（`watch: ['server.js', 'src']`），只要看到小兵的工作檔案有修改（程式碼更新），主管就會自己去幫他重啟，這樣既安全又不會發生小兵偷偷留在辦公室佔位置的問題！

### 📝 程式碼註解
```javascript
// 【小朋友解釋法】：
// 不要讓 PM2 呼叫 NPM 經理 (npm run dev) 去叫小兵 (server.js)，因為 NPM 經理下班時會忘記叫小兵回家，導致 Port 埠被佔用。
// 我們讓 PM2 直接管小兵 (server.js)，並用 watch 隨時注意小兵有沒有改寫，自動幫他重新開機！
```

### 🛠️ 修正實作
請參閱 [ecosystem.config.cjs](file:///Users/pac/codes/interview/music-release-agent/ecosystem.config.cjs)。

---

## 6. 驗證腳本輪詢暫時性網路錯誤防護

### 🚨 PR 審查回饋
在輪詢（Polling）迴圈中，呼叫 `fetch` 時沒有使用 `try-catch` 區塊包裹。如果在輪詢期間發生短暫的網路錯誤，驗證腳本會立刻崩潰，而不是嘗試重新撥打。將 `fetch` 包裹在 `try-catch` 區塊中可以讓測試腳本更穩健。

### 👶 小朋友解釋法
> 想像你（腳本）是一位快遞員，打電話（`fetch`）到管理中心詢問某件包裹送到了沒（查詢 Job 狀態）。因為包裹很大，你需要每隔幾秒就打一次電話詢問進度。
> 如果在打電話的過程中，因為「電話線訊號不好暫時斷線了一下」（短暫的網路波動），而此時你完全沒有任何防禦，直接崩潰大哭說工作失敗（程式拋出錯誤並當機），這就太可惜了。
> 
> 所以我們的解決辦法是：在打電話的動作外包一層「防摔保護殼」(`try-catch`)。這樣一來，萬一這一次打電話因為收訊不好失敗了，我們就默默當作「這次沒聽到」，等幾秒鐘後再播打下一次電話。只有當時間真的到了（Timeout）我們都還沒問到結果，我們才會判定是真的超時失敗！

### 📝 程式碼註解
```javascript
// 【小朋友解釋法】：
// 輪詢狀態打電話 (fetch) 時，如果遇到短暫的收訊不好（網路瞬斷），不要直接大哭崩潰（腳本當機）。
// 我們加上防摔保護殼 (try-catch)，這次沒問成功就等一下下再打，直到時間超時為止！
```

### 🛠️ 修正實作
請參閱 [demo-verify-social-handoff.js](file:///Users/pac/codes/interview/music-release-agent/scripts/demo-verify-social-handoff.js)。

---

## 7. 單曲變更時狀態自動清空防護

### 🚨 PR 審查回饋
當使用者在同一個專輯中切換不同的單曲（`selectedTrack` 改變）時，`lyricsData` 與 `analysisData` 並不會被重設。這會導致 UI 在載入新單曲的 AI 歌詞或賞析之前，仍然顯示上一首單曲的內容，造成嚴重的資料不一致與不良的用戶體驗。建議新增一個 `useEffect` 監聽 `selectedTrack`，並在單曲改變時自動清空歌詞與分析狀態。

### 👶 小朋友解釋法
> 想像你（瀏覽器）是一個多功能電視螢幕。當小明（使用者）從「歌曲 A」換到「歌曲 B」時，在新的「歌曲 B」的歌詞和分析還沒載入好之前，電視螢幕上如果還停留在「歌曲 A」的歌詞和分析畫面，就會讓人非常困惑（看著 B 歌的標題，底下卻播 A 歌的歌詞）。
> 
> 所以我們的解決辦法是：在電視機裝上一個「自動清空感應器」(`useEffect` 監聽 `selectedTrack`)。一旦小明按鈕換歌（`selectedTrack` 改變了），我們就立刻命令螢幕「先把黑板擦乾淨」(`setLyricsData('')` 和 `setAnalysisData('')`)，呈現一片乾淨的空白或載入狀態，這樣等新歌的歌詞和分析跑完送上來時，就不會跟舊歌的內容打架了！

### 📝 程式碼註解
```javascript
// 【小朋友解釋法】：
// 當換歌曲時，為了不讓螢幕上還殘留著上一首歌的歌詞或分析，
// 我們一感應到換歌，就立刻「擦黑板」把舊內容擦乾淨，讓畫面呈現空白等待新內容！
```

### 🛠️ 修正實作
請參閱 [App.jsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/App.jsx)。

---

## 8. 本地開發模式下放寬就緒檢查（Readyz）限制

### 🚨 PR 審查回饋
在 `/readyz` 的就緒檢查中，系統要求 `dashboard/dist/index.html` 必須存在（`dashboardBuilt`）才回傳 200 OK。然而在本地開發模式下，前端通常是由 Vite 開發伺服器（Port 5173）動態託管，並不需要事先執行 `npm run build`。這項限制會導致開發者在本地執行 Playwright E2E 測試或進行就緒檢查時，因為沒有建置前端而遭遇 503 錯誤或測試逾時。建議在 `process.env.NODE_ENV === 'development'` 時，放寬或跳過 `dashboardBuilt` 的檢查。

### 👶 小朋友解釋法
> 想像你要舉辦一場派對，主管（就緒檢查 `/readyz`）要求在開門迎客（200 OK）之前，必須確認「宣傳海報已經印好裝框了」（`dashboard/dist/index.html` 存在）。
> 這在正式營業（生產環境）時是合理的。但在我們自己在家排練（開發環境 `development`）時，我們其實是直接在電腦上畫草稿給自己看，根本不需要先花時間去列印和裝框。
> 如果主管一直堅持「沒看到裝框的海報就不准開門」，我們就沒辦法在排練時測試流程了。
> 
> 所以我們的解決辦法是：跟主管說，如果現在是在「排練時間（開發模式）」，即使海報還沒印出來，也請准許我們開門進行測試。這樣大家在本地開發或跑自動測試時，就不會因為沒先執行打包而一直吃閉門羹（503 錯誤）了！

### 📝 程式碼註解
```javascript
// 【小朋友解釋法】：
// 在排練（開發環境）時，我們不需要真的把海報印好裝框（不需 npm run build 產生 index.html），
// 所以如果是開發環境（isDev），我們就放寬限制，海報沒印好也算準備就緒，方便我們本地測試！
```

### 🛠️ 修正實作
請參閱 [server.js](file:///Users/pac/codes/interview/music-release-agent/server.js)。

---

## 9. GitHub Actions 測試環境中的 Node.js 版本升級

### 🚨 PR 審查回饋
在 GitHub Actions 的 CI 流程中，測試遭遇了 `TypeError: webidl.util.markAsUncloneable is not a function` 的錯誤，導致 `tests/strategies.test.js` 測試套件執行失敗。

這是因為專案內依賴的 `undici`（`^8.3.0`）套件，在新版本中呼叫了 Node.js v21+ 才支援的 `worker_threads.markAsUncloneable` 原生 API。而 CI 中設定的 Node.js 版本為 `20.x`，不包含此功能，因此引發相容性錯誤。建議將 CI 運行的 Node 升級至支援此 API 的 `22.x`（LTS 版本）。

### 👶 小朋友解釋法
> 想像你要開一輛新買的跑車（`undici` 8.3.0+ 套件），這台跑車需要加一種特殊的進階燃料（`markAsUncloneable` 函數）。
> 
> 在你的電腦上，你安裝的是最新型的加油站（Node.js v23），所以跑車開得很順。但是在 GitHub Actions 的測試工廠裡，他們用的是舊款的加油站（Node.js v20），裡面沒有這種新燃料。結果跑車開到一半就發不動，整個測試就壞掉（Failed）了。
> 
> 所以我們的解決辦法是：把 GitHub Actions 的加油站升級到最新的穩定版（Node.js v22.x），這樣它就有提供新燃料，跑車就可以順利跑完測試，不會再壞在半路了！

### 🛠️ 修正實作
請參閱 [.github/workflows/ci.yml](file:///Users/pac/codes/interview/music-release-agent/.github/workflows/ci.yml)。

---

## 10. 萬用字元（Wildcard）路由排除靜態資源防範 MIME 錯誤

### 🚨 PR 審查回饋
萬用字元（wildcard）路由 `app.get('*')` 會攔截所有未匹配的請求並回傳 `index.html`。如果瀏覽器請求一個不存在的靜態資源（例如已過期或路徑錯誤的 `.js`、`.css` 或圖片檔案），此路由仍會回傳 `index.html` 並帶有 200 OK 狀態。這會導致瀏覽器嘗試將 HTML 解析為 JavaScript/CSS，從而在主控台拋出混淆的 MIME 類型錯誤（例如 `Uncaught SyntaxError: Unexpected token '<'`）。建議限制此萬用路由，僅對不包含副檔名（或僅限 `.html`）的頁面導航請求回傳 `index.html`，而對其他靜態資源請求回傳 404。

### 👶 小朋友解釋法
> 想像你開了一家大型超市（Vite 前端應用），大門口有一張導覽圖（`index.html`）。有一位「包裹處理員」(`app.get('*')` 萬用字元路由)，只要看到有人來找任何不存在的地方（例如打錯的網址），他一律把大門口導覽圖給對方。
> 
> 在尋找普通網頁時這很貼心。但是！如果對方要的是一個「特定的燈泡零件」或「特定的螺絲頭」（例如不存在的 `.js` 或 `.css` 檔案），處理員卻也給了他們一張「紙質導覽圖（HTML）」。
> 
> 當電腦收到這張導覽圖（HTML）時，會試圖把它裝進燈座裡當燈泡用（瀏覽器把 HTML 當作 JS/CSS 載入），結果就會拋出「格式不對」的紅字錯誤（MIME 類型錯誤）。
> 
> 所以我們的解決辦法是：給處理員增加一條規則。只要發現對方要找的是「有特定的規格副檔名」（像是包含 `.` 且不是 `.html` 的請求），就直接跟對方說「沒有這件貨」(404 Not Found)；只有當對方是要找一般的網頁路徑時，才把導覽圖給他，這樣電腦就不會拿錯零件而報錯了！

### 📝 程式碼註解
```javascript
// 【小朋友解釋法】：
// 當別人來找零件（.js 或 .css 靜態檔案）時如果找不到，不要硬給他「導覽圖」(index.html)，否則瀏覽器會裝不進去而報錯。
// 我們檢查只要路徑裡有「.」而且不是「.html」，就直接說沒貨 (404)，只有網頁導航才給導覽圖！
```

### 🛠️ 修正實作
請參閱 [server.js](file:///Users/pac/codes/interview/music-release-agent/server.js)。

---

## 11. E2E 測試中對專輯列表（/api/albums）API 的模擬（Mocking）

### 🚨 PR 審查回饋
在 GitHub Actions 測試環境中，Playwright E2E 測試因為找不到 `aside button` (第一個專輯按鈕) 或等待引導文字時逾時而宣告失敗。

這是因為 E2E 測試在 CI 環境中執行時，後端 `/api/albums` 路由需要讀取 `data/spotify-cache.json` 快取檔案，然而該檔案已在 `.gitignore` 中被排除，導致 GitHub Actions 上的實體檔案不存在、API 返回 500 錯誤，進而使頁面無法渲染任何專輯。建議在 E2E 測試腳本中對 `/api/albums` 進行 Mock 攔截，以確保測試不依賴本地快取檔案，從而在 CI 中能百分之百穩定通過。

### 👶 小朋友解釋法
> 想像你要對一間超市的安全通道（自動測試）進行演練。你的演練步驟有一步是「走到糖果櫃前（選擇第一個專輯卡片）」。
> 
> 在你的本地辦公室（本地開發環境），糖果櫃上真的擺滿了糖果（`data/spotify-cache.json` 快取檔案存在），所以演練順利通過。但是在 GitHub 雲端測試中心時，因為那是個全新的空房間，櫃子是空的（快取檔案被 `.gitignore` 排除，所以沒有上傳）。快遞員（API）回傳「沒貨了」的錯誤，演練的小人找不到糖果櫃（`aside button`），於是演練就當場卡住並宣告失敗了！
> 
> 所以我們的解決辦法是：在演練的腳本裡，裝上一個「虛擬糖果櫃模擬器」(`page.route('**/api/albums')`)。這樣不論在什麼空房間（即使沒有實體快取檔案），演練一開始就會用模擬的虛擬糖果櫃（Mock Albums）代替，小人就能順利看到專輯並點擊，演練就能順利通過了！

### 🛠️ 修正實作
請參閱 [dashboard.spec.js](file:///Users/pac/codes/interview/music-release-agent/tests/e2e/dashboard.spec.js)。

---

## 12. 播放器多重初始化防護（SpotifyPlayer.tsx）

### 🚨 PR 審查回饋
`SpotifyPlayer` 元件不應該在內部直接呼叫 `useSpotifyPlayer()` 進行連線初始化，這樣會導致傳入的 `playerControls` 無法被正確使用，且會重複載入 Spotify SDK，引發連線衝突。

### 👶 小朋友解釋法
> 想像 `SpotifyPlayer` 是一台「電視機元件」，而 `useSpotifyPlayer` 是「拉第四台的線」。
> 原本的寫法是在客廳 (`App.jsx`) 拉了一條線，又在電視機裡面 (`SpotifyPlayer.tsx`) 自己拉了一條線！兩條線搶訊號，就會導致畫面跟聲音不同步，或是根本無法播放（因為連線衝突了）。
> 我們現在把電視機裡面的線拔掉，規定電視機必須接客廳拉過來的線 (`playerControls`)，這樣全家就只會有一個 Spotify 連線，再也不會打架了！

### 🛠️ 修正實作
請參閱 [SpotifyPlayer.tsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/components/SpotifyPlayer.tsx) 與 [App.jsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/App.jsx)。

---

## 13. 自動捲動歌詞的副作用（KtvLyricsView.tsx）

### 🚨 PR 審查回饋
不應該在畫面的「繪製階段 (Render phase)」去執行捲動頁面 (Scroll) 的動作，應該要預先計算目前正在播放的歌詞索引，並將自動捲動的副作用邏輯放到 `useEffect` 裡面，以防 layout 抖動與重複渲染。

### 👶 小朋友解釋法
> React 畫畫面就像是畫家在「打草稿」。在打草稿的時候，畫家應該專心決定「每一句歌詞要畫在哪裡、誰要發光」。
> 如果我們在打草稿的同時，又命令畫布「自動往下捲動」，畫家就會手忙腳亂（這叫做 Side Effect 副作用），嚴重的話會導致畫面卡頓或是無限重畫。
> 我們現在改成：畫家專心打草稿（標記出目前唱到哪一句），等整張圖畫完掛到牆上後，才由負責掛圖的人 (`useEffect`) 輕輕把畫面捲到正中間！

### 🛠️ 修正實作
請參閱 [KtvLyricsView.tsx](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/components/lyrics/KtvLyricsView.tsx)。

---

## 14. 字典載入效能優化與錯誤防護（useTrackAi.ts）

### 🚨 PR 審查回饋
使用 `import()` 動態載入 `lrcParser` 會增加非同步請求的複雜性與額外開銷。此外，在解析 JSON 之前，我們應先檢查 `res.ok` 確認 API 正常運作，否則若回傳失敗會導致崩潰。

### 👶 小朋友解釋法
> 想像 `lrcParser` 是一本「翻譯字典」。
> 原本的寫法是：等收到外國信件後，才「打電話叫快遞送一本字典過來」(`import(...)`)，然後才開始翻譯。但這本字典明明很薄！這樣做會浪費很多等待的時間。
> 我們直接把字典放在辦公桌上（在檔案最上面用 `import { parseLrc }` 靜態載入），信一來就可以立刻翻譯，速度飛快！同時我們也加了一道檢查：如果信件根本寄丟了 (`res.ok` 是 false)，我們就不會傻傻打開一封空信件然後當機。

### 🛠️ 修正實作
請參閱 [useTrackAi.ts](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/hooks/useTrackAi.ts)。

---

## 15. 多個時間標籤全域清除防護（lrcParser.ts）

### 🚨 PR 審查回饋
有些 LRC 檔案中，一行歌詞可能包含多個時間標籤 (例如 `[01:20.00][02:30.00] lyrics`)。原本的 `line.replace(timeRegex, '')` 只能替換掉第一個標籤，應使用全域正則表達式 `/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g` 來徹底清除。

### 👶 小朋友解釋法
> 副歌的歌詞因為重複唱，有時候會在同一行貼上兩個「時間貼紙」。
> 原本我們的打掃機器人很懶惰，看到一行字，撕掉「第一張」貼紙後就覺得工作做完了，結果畫面上就會跑出類似 `[02:30.00] 寶貝對不起` 這種帶有亂碼的歌詞。
> 我們在機器人的指令後面加了一個 `/g` (Global，代表全部都要)，現在機器人會死盯著那行字，把「所有」的時間貼紙通通撕乾淨，只留下純淨的歌詞！

### 🛠️ 修正實作
請參閱 [lrcParser.ts](file:///Users/pac/codes/interview/music-release-agent/dashboard/src/utils/lrcParser.ts)。









