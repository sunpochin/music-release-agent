# PR 總結：從「有說服力的 Demo」到「評估者可驗證的 Release」

## 改了什麼（What Changed）

### 0. 本輪（Round 2）：補齊最後的「宣稱 vs. 證明」落差

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
npm test                        # 54 個測試（單元 + golden + 前端 XSS），全離線確定性
npm run demo:verify             # 離線管線 + 產物 schema/內容驗證
npm run demo:verify:social      # 跨服務 handoff（無姊妹 repo 自動用內建 mock）
npm run demo:verify:social:down # 依賴失敗降級行為
cd dashboard && npm run build   # 驗證 markdown 轉譯器抽離後前端可編譯
```

全部不需網路與憑證。負面驗證（確認 fail-loud）：把 `data/mock-releases.json` 任一筆的 `name` 改成 `""` 再跑 `npm run demo:verify`，會在執行管線前以非零 exit code 失敗並指出 `releases[i].name`。

## 已知限制（Known Limitations）

- 內建 mock 只覆蓋 handoff 契約的 happy path 與基本 400/404，不模擬 companion 的佇列重試、Ayrshare 策略等內部行為（那些屬於姊妹 repo 的測試範圍）
- 真實 `npm run scan`（Spotify + Gemini + Git push）仍無自動化整合測試 — 刻意取捨，避免 flaky 的外部 API 測試
- Golden 比對鎖定樂評「模板」；若刻意改模板需重新生成 golden 檔（`getMockReview` 輸出寫回 `tests/golden/fixtures/expected-normal-review.golden.md`）
- 契約是「兩份手寫的對齊」：內建 mock 與真實 companion 各自實作同一契約，尚無 single source of truth 的 schema 檔
- XSS 測試鎖定的是「轉譯器輸出僅含白名單標籤」這個性質，不是完整的瀏覽器端滲透測試；e2e 層級的注入驗證（真的把 payload 餵進 lyrics API 再檢查 DOM）尚未涵蓋
- Playwright e2e 與 Docker build 在本機沙箱未重跑（需要瀏覽器二進位與 Docker daemon），由 CI 覆蓋
- 兩輪變更皆尚未 commit — 建議以本文件兩個 Round 為單位拆成兩個 commit

## 下一步最高 ROI（Next Highest ROI Step）

把 handoff 契約變成**單一 schema 檔**（如 `contracts/social-handoff.json`，JSON Schema 格式），讓三方共同消費：核心服務的 proxy 驗證、內建 mock 的回應產生、以及姊妹 repo 的 contract test。這消除「mock 與真實服務悄悄漂移」這個目前唯一無法被測試抓到的失敗模式，成本約半天。
