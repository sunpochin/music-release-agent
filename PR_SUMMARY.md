# PR 總結：從「有說服力的 Demo」到「評估者可驗證的 Release」

## 改了什麼（What Changed）

### -1. 本輪（Round 3）：契約單一事實來源 + 瀏覽器層 XSS 證明

實作前兩輪 PR summary 各自指出的「下一步最高 ROI」：

1. **Handoff 契約變成單一 schema 檔**：新增 [`contracts/social-handoff.schema.json`](./contracts/social-handoff.schema.json)（JSON Schema draft-07：publishRequest / acceptedResponse / statusResponse / postResult / healthResponse / errorResponse）與零依賴子集驗證器 `src/services/contract-validator.js`（type union、required、enum、items、minLength、minItems、內部 $ref，錯誤訊息含欄位路徑）。四方消費同一份檔案：
   - `server.js` proxy：轉發前驗證請求體，違約 400 不轉發（取代手寫的 `if (!caption)`）
   - 內建 mock：以 schema 驗證請求 + 對自己每個回應做契約自我檢查（違約 500，fail-loud）
   - `demo:verify:social`：對「真實或 mock」companion 的活回應做 schema 驗證 — 漂移偵測點
   - `tests/contract/social-handoff.test.js`（17 案例）：schema 對合法/非法樣本的判定（正常/模糊/失敗），加上把 mock 真的跑起來驗證活回應與 400/404 錯誤體全部符合契約
2. **瀏覽器層 XSS 滲透驗證**：`tests/e2e/dashboard.spec.js` 新增 XSS 案例 — 把含 `<script>`、`<img onerror>`、`<svg onload>`、`<iframe javascript:>`、`onclick` 的 Markdown payload 經攔截的歌詞 API 餵進真實 Chromium，驗證四件事：注入旗標 `window.__xssExecuted` 未被設置、payload 以純文字可見、DOM 無任何危險元素、無 dialog 彈出。已在本機 headless Chromium 實跑通過（2/2 e2e passed）。

### 0. 前輪（Round 2）：補齊最後的「宣稱 vs. 證明」落差

前一輪建立了 dry-run 核心、golden tests 與三條 verify 路徑；本輪掃描殘餘落差後做了四件事：

1. **前端 XSS 宣稱現在有可執行證明**：README 宣稱「安全的輕量 Markdown 轉譯器…杜絕 XSS」但零測試。將 `parseMarkdownToHtml` 從 `AILyricsPanel.jsx` 抽為純模組 `dashboard/src/utils/markdown.js`（無 React 依賴、行為不變），新增 `tests/markdown-renderer.test.js` 15 個案例：惡意（`<script>`、`<img onerror>`、`<svg onload>`、`<iframe>`、`&` 二次解碼、輸出白名單標籤掃描）、正常（H2/H3/清單/粗體/分隔線）、模糊（null/空白/未閉合粗體/逐行不丟行）。dashboard `vite build` 驗證重構後可編譯。
2. **CI 從未在 `feat/*` 分支跑過**：trigger 只配了 `feature/*`，但實際分支命名是 `feat/...`（含目前分支）— 等於 CI 對所有開發分支靜默不跑。已加入 `feat/*`。
3. **CI 現在執行全部三條 proof 路徑**：原本只跑 `demo:verify`；`demo:verify:social` 與 `demo:verify:social:down` 是 README 主打的驗證模式卻不在 CI。兩者皆離線（內建 mock），已加入。
4. **清除過時測試殘留**：`data/test-system-state.test.json`、`data/test-scanner-state.test.json`（已 git rm）、`data/test-spotify-cache.json`（已刪）— 測試早已改用 `os.tmpdir()`，這些是舊版殘留且會被測試意外改寫造成 dirty working tree。`.gitignore` 加入 `data/test-*.json` 防回歸。另將 README/architecture.md 中寫死的「39 個測試」改為不易過期的描述（現為 54 個）。

---

## 前一輪（Round 1）改動

### 1. 跨服務驗證不再依賴不存在的姊妹 repo（最大的落差）

`npm run demo:verify:social` 原本硬性依賴 `../social-post-service`，單獨 clone 本 repo 時這條 README 宣稱的驗證路徑直接無法執行。現在：

- 新增 `tests/fixtures/mock-social-service.js`：零依賴（純 Node `http`）的內建 mock，實作與真實 companion 完全相同的 handoff 契約（`/healthz`、`POST /api/posts` → 202+jobId、`GET /api/posts/:jobId` → completed+results，含非同步完成延遲）
- `scripts/demo-verify-social-handoff.js` 偵測姊妹 repo：存在用真的，不存在自動退回內建 mock 並在輸出中明確標示

### 2. 抽出管線共用核心，消除規則漂移

新增 `src/dry-run/pipeline-core.js`：slug 規則、樂評模板、schema 驗證的單一事實來源。原本 `generateSlug` 在 `scan-releases-dry.js` 與 `demo-verify.js` 各有一份副本，任何一邊改了驗證就會失真。順手修了一個真實邊界 bug：名稱全為符號的 release（`"!!!-???"` → slug `"-"`）會繞過 `|| id` 後備產生 `-.md` 無效檔名，現在會正確退回 release id（由 golden test 鎖定）。

### 3. demo:verify 從「檔案存在」升級為「內容沒壞」

五層驗證：輸入 schema（執行管線前先擋壞資料，逐欄位報錯）→ 管線 exit code 與輸出標記 → 產物存在性 → 每篇樂評內容完整性（封面圖、標題、評分、聆聽連結缺一即 fail）→ SUMMARY.md 結構與重複連結偵測（冪等性破壞會被抓到）。

### 4. Golden 測試（`tests/golden/`，15 個案例，全離線確定性）

- **正常**：標準 release 輸出與 golden 檔案逐字比對；端到端在暫存目錄跑完整管線；重複執行驗證 SUMMARY 冪等性
- **模糊**：slug 退化、重音字元（Café → caf）、中文名稱保留、空 genres 後備文字、single/album 文案分支
- **失敗**：malformed fixture 與無效 JSON 必須以非零 exit code 大聲失敗，錯誤訊息含索引與欄位名

配套：`scan-releases-dry.js` 支援 `DRY_RUN_FAST=1`（跳過模擬延遲）、`DRY_RUN_DATA_PATH`、`DRY_RUN_OUTPUT_DIR`（導向暫存目錄），輸出內容不變。新增 `npm run test:golden`。

### 5. 修復順序相依的測試

`cache-service.test.js` 與 `system-state-service.test.js` 原本共用 `data/` 下的固定路徑、靠 `afterEach` 刪檔清理 — 清理一旦失敗（唯讀環境、中斷的執行）下一輪必掛。改用 `os.tmpdir()` + pid + timestamp 的唯一路徑，連跑兩輪全綠驗證過。

### 6. 文件

- 新增 `docs/architecture.md`（中文）：資料流、服務邊界、handoff 格式（含 JSON 範例）、失敗模式對照表（每個失敗模式 → 可執行證明）、五層驗證階梯
- README 修正：測試數 21 → 39、`demo:verify:social` 不需姊妹 repo、demo:verify 驗證內容說明與實作對齊

## 如何驗證（How to Verify）

```bash
npm install
npm test                        # 71 個測試（單元 + golden + 契約 + 前端 XSS），全離線確定性
npm run demo:verify             # 離線管線 + 產物 schema/內容驗證
npm run demo:verify:social      # 跨服務 handoff，活回應過契約 schema（無姊妹 repo 自動用內建 mock）
npm run demo:verify:social:down # 依賴失敗降級行為
npx playwright test             # 2 個 e2e：完整使用者流程 + 瀏覽器層 XSS 滲透驗證
cd dashboard && npm run build   # 驗證 markdown 轉譯器抽離後前端可編譯
```

契約漂移的負面驗證：把 `tests/fixtures/mock-social-service.js` 的 202 回應 `status: 'queued'` 改成 `'ok'` 再跑 `npm run demo:verify:social` — mock 的自我檢查會以 500 fail-loud，verify 腳本以非零 exit code 失敗並列出違約欄位。

全部不需網路與憑證。負面驗證（確認 fail-loud）：把 `data/mock-releases.json` 任一筆的 `name` 改成 `""` 再跑 `npm run demo:verify`，會在執行管線前以非零 exit code 失敗並指出 `releases[i].name`。

## 已知限制（Known Limitations）

- 內建 mock 只覆蓋 handoff 契約的 happy path 與基本 400/404，不模擬 companion 的佇列重試、Ayrshare 策略等內部行為（那些屬於姊妹 repo 的測試範圍）
- 真實 `npm run scan`（Spotify + Gemini + Git push）仍無自動化整合測試 — 刻意取捨，避免 flaky 的外部 API 測試
- Golden 比對鎖定樂評「模板」；若刻意改模板需重新生成 golden 檔（`getMockReview` 輸出寫回 `tests/golden/fixtures/expected-normal-review.golden.md`）
- 契約驗證器是 JSON Schema 的**子集**實作（足夠覆蓋本契約所有規則）；姊妹 repo 若要消費 schema 檔，建議用 ajv 做完整驗證 — schema 檔本身是標準 draft-07，完全相容
- 姊妹 repo `../social-post-service` 自己的 contract test 尚未建立（檔案在本 repo，引用方式已在 schema description 註明）；在它建立之前，「真實 companion 符合契約」只在 `demo:verify:social` 以真實服務執行時被驗證
- 瀏覽器層 XSS 測試覆蓋歌詞 API 這條注入路徑；其他渲染入口（如專輯評論）走同一個轉譯器，但未逐一做 e2e 注入
- Docker build 在本機沙箱未重跑（需要 Docker daemon），由 CI 覆蓋
- 三輪變更皆尚未 commit — 建議以本文件三個 Round 為單位拆 commit

## 下一步最高 ROI（Next Highest ROI Step）

在姊妹 repo `social-post-service` 加一個 contract test，直接讀取本 repo 的 `contracts/social-handoff.schema.json`（或以 git submodule / npm workspace 共享），用 ajv 驗證它的真實路由回應。完成後，契約三角（核心 proxy、真實 companion、內建 mock）的每一邊都有自動化防漂移證明，跨 repo 重構可以放心做。成本約 1-2 小時。
