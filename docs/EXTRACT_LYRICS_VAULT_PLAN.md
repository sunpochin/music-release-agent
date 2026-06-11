# 拆分計劃：歌詞翻譯 + Obsidian 存檔 → `lyrics-vault-service`

> Branch: `refactor/extract-lyrics-vault-service`（自 `feat/on-demand-translation` 分出）
> 形態決定：獨立 companion service repo（與 `social-post-service` 同模式）
> 對象：任何接手的 coding agent。每階段可獨立 commit、獨立驗證。

## 目標一句話

把歌詞翻譯與 Obsidian vault 落盤從 `music-release-agent` 抽成第二個 companion service，
core repo 只留 thin proxy + 降級行為，藉此證明既有的 handoff-contract 架構可泛化。

## 現況依賴圖

```
server.js ──POST/DELETE /api/lyrics──▶ lyrics-service.js
                                          ├─ lyrics-prompt.js   (prompt SSOT)
                                          ├─ lyrics-translator.js (Gemini)
                                          ├─ translateWithOllama  (內嵌於 lyrics-service)
                                          ├─ lyrics-source.js   (LRCLIB 抓原文)
                                          ├─ spotify-lyrics.js  (sp_dc 爬蟲 — 直接刪除, 見 AGENT_HANDOFF_REVIEW P0-1)
                                          └─ lyrics-cache.js    (Obsidian-compatible md+frontmatter)
spotify-client.js L185 ──dynamic import──▶ getRawLyrics()   ← 隱性耦合，要切斷
dashboard 7 個元件 ──fetch /api/lyrics──▶ (不變，仍打 core proxy)
```

## 從鄰近 repo 共用的程式碼（複製進新 service，標註出處）

| 來源 | 檔案 | 用途 | 取代什麼 |
|---|---|---|---|
| `../nanoclaw-markdown-agent` | `src/vault-path.js` | `~` 展開、env 優先的 vault 路徑解析 | `lyrics-cache.js` 自製的 `resolveCacheDir` |
| `../nanoclaw-markdown-agent` | `src/file-lock.js` | 寫入加鎖，防並發寫壞 vault | 現況無鎖（已知缺陷） |
| `../youtube-podcast-translator` | `src/services/ai.service.js` 的 provider 結構 | Gemini→Ollama、主模型→fallback 模型鏈 | `lyrics-service.js` 內嵌的單層 provider 切換 |

> 方式：複製檔案 + 檔頭註明 `Adapted from <repo>/<path>`。不做跨 repo npm link（over-engineering）。
> 注意：複製 nanoclaw 檔案時**刪除「童趣」雙語註解**，只留技術註解。

## 新 repo 結構：`../lyrics-vault-service`

```
lyrics-vault-service/
├── package.json            # express + @google/genai + dotenv，scripts: start/test/demo:verify
├── server.js               # POST /api/translate, DELETE /api/cache/:slug, GET /healthz
├── contracts/
│   └── lyrics-handoff.schema.json   # request/response contract（仿 social-handoff.schema.json）
├── src/
│   ├── vault-path.js       # ← nanoclaw（去童趣註解）
│   ├── file-lock.js        # ← nanoclaw
│   ├── vault-writer.js     # ← music-release-agent lyrics-cache.js，改用 vault-path + file-lock
│   ├── translate-provider.js  # ← lyrics-translator.js + translateWithOllama 合併，
│   │                          #    fallback 鏈結構參考 youtube-podcast-translator ai.service.js
│   ├── lyrics-prompt.js    # ← 原樣搬移（PROMPT_VERSION 保留，cache key 不變）
│   ├── lyrics-source.js    # ← 原樣搬移（LRCLIB only；spotify-lyrics.js 不搬，刪除）
│   └── pipeline.js         # ← lyrics-service.js 改名，移除 spotify-lyrics 分支
└── tests/
    ├── contract/lyrics-handoff.test.js
    ├── vault-writer.test.js     # ← 搬移 lyrics-cache.test.js
    └── pipeline.test.js         # ← 搬移 lyrics-source.test.js + 新增 provider fallback 測試
```

ENV：`LYRICS_VAULT_DIR`（即原 `LYRICS_CACHE_DIR`，指向 Obsidian vault）、
`GEMINI_API_KEY`、`LYRICS_PROVIDER`、`OLLAMA_URL`、`PORT=3456`。

## Contract（先定義，雙邊都驗）

`POST /api/translate` request:
```json
{ "artistName": "string", "trackName": "string", "albumName": "string?", "forceRefresh": "boolean?" }
```
response `200`:
```json
{ "lyrics": "string", "source": "lrclib|ai-recall", "cached": "boolean", "promptVersion": "string", "vaultPath": "string" }
```
失敗：`502`（provider 全掛）、`422`（schema 不符）。
Schema 放 `contracts/lyrics-handoff.schema.json`，**兩個 repo 各自在測試中驗證同一份**（複製 + drift test，同 social 模式）。

## music-release-agent 側改動（本 branch）

### Phase 1 — 切斷耦合（可獨立 commit）
1. 刪 `spotify-client.js` L185 的動態 import `getRawLyrics`（該 fallback 改為直接回 null）。
2. 刪 `scripts/capture-spotify-sp-dc.js`、`src/services/spotify-lyrics.js`、`scratch/`（= AGENT_HANDOFF_REVIEW P0-1，順手完成）。
3. 跑 `npm test`，修掉 `lyrics-source-badge.test.js` 等對 spotify source 的斷言。

### Phase 2 — 建立新 service（在 `../lyrics-vault-service`，獨立 git repo）
4. 依上述結構搬移/合併檔案，`git init`，首 commit。
5. 搬移對應測試，新增 contract test 與 provider fallback test（mock fetch，零網路）。
6. `npm run demo:verify`：用 fixture 歌詞跑 翻譯(mock provider)→落盤→讀回，驗 frontmatter 完整性。

### Phase 3 — core 改 proxy（本 branch）
7. `server.js` 的 `/api/lyrics` 改為轉發 `LYRICS_SERVICE_URL`（預設 `http://localhost:3456`），
   複用 `src/services/social-client.js` 的 circuit-breaker + 降級模式（抽成通用 `companion-client.js` 或直接複製）。
8. 服務不可達 → `/api/lyrics` 回 `502 { reason: 'lyrics-vault-service unreachable' }`，
   `/readyz` 顯示 `lyricsService: degraded`。dashboard 已有錯誤態 UI，不需改。
9. 新增 `tests/fixtures/mock-lyrics-service.js`（仿 `mock-social-service.js`），
   `npm run demo:verify:lyrics` 走 mock 驗證 contract；`demo:verify:lyrics:down` 驗降級。

### Phase 4 — 文件與收尾
10. README：lyrics 從主敘事移除，加一節「Companion Services」列出 social + lyrics 兩個，各對應 verify 指令。
11. `docs/architecture.md` 更新服務邊界圖。
12. 刪 `docs/lyrics_cache_design.md`（搬去新 repo）、刪 `src/services/lyrics-*.js`、`src/lyrics-translator.js`。
13. CI 加 `demo:verify:lyrics` 與 `demo:verify:lyrics:down` 兩個 step。

## 驗收標準（全部必須綠）

- [ ] `music-release-agent`: `npm test` 全綠，repo 內 grep 不到 `sp_dc|spotify-lyrics|stealth`
- [ ] `music-release-agent`: `npm run demo:verify` 不變、`demo:verify:lyrics`、`demo:verify:lyrics:down` 新增且過
- [ ] `lyrics-vault-service`: `npm test` + `npm run demo:verify` 過，無憑證可跑
- [ ] 兩邊 contract test 驗同一份 schema 內容（drift test）
- [ ] dashboard 行為不變（仍打 `/api/lyrics`，可用 mock service 起來手測）
- [ ] `server.js` 行數下降（移除 lyrics 實作邏輯，只剩 proxy）

## 風險與已知限制

- cache key 沿用 `safeSlug` + `PROMPT_VERSION`：搬移後既有 vault 內快取仍然 hit，不需 migration。
- `forceRefresh` 語義跨服務後依然單一入口（DELETE → 新 service 的 cache invalidation）。
- 不處理三 repo 共用 package 化 — 留待未來（複製 + 出處註解已足夠面試敘事）。
- e2e `dashboard.spec.js` 的 lyrics 流程需把 route 攔截目標換成 proxy 後的回應格式。

## 預估

Phase 1: ~1h ・ Phase 2: ~3h ・ Phase 3: ~2h ・ Phase 4: ~1h，共一個工作天內。
