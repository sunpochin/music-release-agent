# Staff-Level Review — Agent Handoff Document

> 對象：codex / antigravity / claude code / gemini / github copilot 等 coding agent。
> 目的：記錄本 repo（面試作品）的缺陷診斷與優先級任務。每項都附證據路徑，可直接驗證。
> Review 日期：2026-06-12。基準 commit：`b94732e`。

## 先講公道話（評審會給分的地方）

- `npm run demo:verify` / `demo:verify:social` / `demo:verify:social:down` 三條離線驗證路徑真實存在、可跑、會 fail loudly，且 CI（`.github/workflows/ci.yml`）全部執行。
- Contract schema（`contracts/social-handoff.schema.json`）同時驗 mock 與真實服務，能抓 drift。
- Circuit breaker 100% 覆蓋、golden tests（normal / malformed）存在。
- 這些是大多數面試 repo 沒有的。問題不在骨架，在定位與誠實度。

---

## 缺陷診斷（依嚴重度排序，非按你列的順序）

### 1. 🔴 產品定位失焦（你列的 #2 — 這是最大的問題）

一個 repo 裡塞了三個產品：

1. **核心**：release scanner → AI 樂評 → GitBook 輸出（README 主敘事）
2. **Companion**：social-post bot（Threads 自動發文）
3. **整個消費級 app**：歌詞抓取/翻譯、播放、分享卡片、iOS Web Share、"Jony Ive style morphing controller"（見 git log `0035644`、`1432e3c`）

證據：`server.js`（466 行）同時掛 albums / review / lyrics / tracks/analyze / social / playback / SSR share-meta / Spotify OAuth 共 15+ 條 route。`src/services/` 14 個檔案裡 6 個是 lyrics 相關。

**為什麼致命**：評審 3 分鐘內無法回答「這是什麼產品」。每個分支功能都稀釋核心敘事的完成度。

**修法（不要重寫，做減法）**：
- README 第一句定義唯一產品：「追蹤新發行並自動產出可驗證樂評內容的 pipeline」。
- 歌詞/播放/分享整組移到 `experimental/` 或文件上明確標 "Demo extras, not the product"，從主敘事與 Evaluator Quickstart 中移除。
- `server.js` 拆 route modules（`routes/core.js`, `routes/social.js`, `routes/experimental.js`），邊界自然浮現。

### 2. 🔴 合規紅旗：Spotify sp_dc cookie 抓取 + 反偵測（你沒列到，但比 TypeScript 嚴重十倍）

證據：
- `scripts/capture-spotify-sp-dc.js`：用 Playwright 開瀏覽器抓使用者 session cookie。
- git log：`eb2e762 "bypass google login block using stealth launch arguments"`、`e4d3be9 "supply browser-mimicking headers to avoid 403"`。

腳本內有免責聲明，但**面試 repo 的 commit history 裡出現「規避自動化偵測」字樣，嚴肅公司的評審會直接扣分**——這展示的是違反 ToS 的工程能力。

**修法**：從本 repo 移除整條 sp_dc 路徑（含 `scratch/test-*token*.js`、`src/services/spotify-lyrics.js` 的爬蟲部分），歌詞來源只留 LRCLIB + AI fallback。要保留就放到獨立私人 repo。順手把 `scratch/` 整個 untrack（debug 雜物不該在面試 repo）。

### 3. 🟠 文件與現實脫節（你列的 #4 — 成立，且有具體實例）

- **直接斷裂**：README L326 寫 `npm run spotify:capture-cookie`，`package.json` 裡實際叫 `auth:spotify`。評審照著跑會直接失敗——這一條就毀掉「每個 claim 對應一個指令」的承諾。
- **文件爆量**：32 個 tracked `.md`。`port_architecture_explanation.md`、`implementation_plan.md`、`task.md`、`walkthrough.md` 各有兩份（root + docs/）。`hero_image_brief.md`、`kid_friendly_changelog.md`、`INTERVIEW_GUIDE.md`、`PORTFOLIO_SUMMARY.md` 是 AI 生成痕跡，評審一眼看穿。
- `coverage-badge.svg` 是 committed 靜態檔，必然過期，本身就是 drift 來源。

**修法**：只留 `README.md`、`docs/architecture.md`、`DEVELOPER.md`、`PR_SUMMARY.md`。其餘刪除或移 `docs/archive/`。寫一個 `scripts/verify-readme-commands.js`：解析 README 中所有 `npm run X`，比對 `package.json` scripts，不存在就 exit 1，掛進 CI。

### 4. 🟠 Coverage 數字是篩選過的（你列的 #3 — 成立，但問題不是「不夠多」而是「不誠實」）

證據：`vitest.config.js` coverage.include 只算 6 個路徑，**明確 exclude `album-reviewer.js`、`gitbook-publisher.js`、`lyrics-translator.js`，且 `server.js`（466 行，整個 API surface）完全不在分母**。README 宣稱「後端核心模組覆蓋率 80–100%」——靠定義「核心」達成。

實際數字：整體 lines 67.87%；`musicbrainz-client.js` 22.6%、`spotify-auth.js` 35.7%、`playback-service.js` 45.1%。

**修法（優先序）**：
1. `server.js` 加 supertest 風格的 route 測試（health/readyz/albums/social proxy 至少各一條 happy + 一條 failure）。
2. `album-reviewer.js` 與 `gitbook-publisher.js` 是核心敘事的一半（AI 樂評 + 輸出），不可以被 exclude——用 mock LLM response fixture 測 prompt 組裝與 markdown 渲染。
3. README 改寫成誠實版本：「核心 pipeline 模組 X%，API 層測試見 tests/server」。

### 5. 🟡 測試慢的根因是 real timers（你列的 #5 — 對，但診斷要精確）

8.77s 跑 115 個 unit test，其中 ~7s 是真實 sleep：

- `tests/baseline.test.js` 429 降級測試：**4015ms**（等真實 Retry-After）
- baseline 另外 3 條各 ~1005ms
- `spotify-api-client.test.js` retry 測試 1001ms

**修法**：`vi.useFakeTimers()` + `vi.advanceTimersByTimeAsync()`，或把 sleep 函式注入（`deps.sleep`）測試時換成 no-op。預期全套 < 2s。E2E 只有 1 個 spec，問題不在 e2e。

### 6. 🟡 沒有 TypeScript（你列的 #1 — 真實但優先級最低）

對面試 demo，全面遷移 TS 是低 ROI、高 churn。**中間解**：
- 全 repo 加 `// @ts-check` + JSDoc typedef，`tsc --noEmit` 掛 CI（零 build step 拿到 80% 型別安全）。
- 唯一值得真 TS 的地方：handoff contract 型別（已有 JSON schema，可用 `json-schema-to-typescript` 生成，証明 contract-first 思維）。
- 面試時這樣講：「我選 JSDoc + tsc --noEmit 是 deliberate trade-off」比默默沒有 TS 好。

### 7. 🟡 其他（你說的天馬行空區）

- **後端沒有 lint**：root `package.json` 無 eslint（dashboard 有）。加 eslint flat config + CI step，半小時的事。
- **「小朋友解釋法」註解在測試碼裡**（`tests/e2e/dashboard.spec.js` L6-8）+ `kid_friendly_changelog.md`：自用可愛，面試 repo 是 AI-generated 的指紋。清掉。
- **Commit hygiene**：`b94732e "add test scripts"` 這種訊息、以及 main 上直接 churn 的歷史。已成事實，但最後可以 squash 出乾淨的 PR 敘事。
- **天馬行空但高 ROI**：`demo:verify` 輸出目前是 console text——讓它同時產出 `data/verify-report.json`（machine-readable），CI 上傳成 artifact。評審（或下一個 agent）能直接 diff 兩次 run 的結果。
- **天馬行空 #2**：加一個 `npm run demo:30s`——單一指令、30 秒內、零憑證，從 mock releases 跑到開啟產出的 GitBook markdown preview。面試現場的肌肉記憶。

---

## 給接手 Agent 的任務清單（按 ROI 排序）

| # | 任務 | 驗收標準 | 預估 |
|---|------|---------|------|
| P0-1 | 移除 sp_dc/stealth 路徑與 `scratch/` | repo 內 grep 不到 sp_dc/stealth；`demo:verify` 仍過 | 1h |
| P0-2 | 修 README 指令斷裂 + 砍文件到 4 份 | `scripts/verify-readme-commands.js` 進 CI 且綠 | 1h |
| P0-3 | 測試改 fake timers | `npm test` < 2s，115+ 全綠 | 1h |
| P1-1 | server.js 拆 routes + 加 API 層測試 | server.js < 150 行；health/social proxy 有測試 | 3h |
| P1-2 | album-reviewer / gitbook-publisher 進 coverage | coverage include 不再 exclude 核心模組；門檻不降 | 2h |
| P1-3 | README 重寫定位（單一產品敘事），lyrics 降級為 experimental | 第一段一句話說清產品；Quickstart 不含 lyrics | 1h |
| P2-1 | `// @ts-check` + `tsc --noEmit` 進 CI | CI 綠 | 2h |
| P2-2 | 後端 eslint | CI 綠 | 0.5h |
| P2-3 | verify-report.json + CI artifact | 兩次 run 可 diff | 1h |

## 一句話總結

骨架（verify scripts、contract、CI、golden tests）是 evaluator-ready 的；殺傷力最大的三刀是 **定位失焦、sp_dc 合規紅旗、文件膨脹到自我矛盾** — 全部是減法工程，不是加法。先做 P0 三項，這個 repo 的面試敘事就成立了。
