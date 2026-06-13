# 實作計畫總結 (Implementation Plans Roadmap)

本文件整合了本專案多個階段的實作計劃，包括單曲專屬頁面 (Song Page)、Obsidian 歌詞快取服務拆分 (Lyrics Vault Service)，以及最近的 LRC 時間碼保留與 TypeScript 遷移。

---

## 1. 歌詞時間碼保留與 TS 遷移 (LRC Synced Lyrics & TS Migration)

### 1.1 目標 (Goal)
1. 在翻譯過程中保留 `[mm:ss.xx]` 格式的 LRC 時間戳，使翻譯與原文能完美對齊。
2. 廢除脆弱的字串模糊配對，改用時間戳作為絕對的 key 對齊原文、羅馬拼音與翻譯。
3. 在雙語全文 (Markdown) 與 KTV 視圖中，將時間戳轉化為可點擊的時間徽章。
4. 點擊時間標籤即可呼叫帶有 `position_ms` 的播放 API 或 `seek` 動作。
5. 將 `lyrics-vault-service` 內的核心腳本與邏輯遷移為 TypeScript。

### 1.2 模組異動與實作
*   **`lyrics-vault-service`**：
    *   `lyrics-prompt.ts`：更新為 V9 版本快取失效，在 System Prompt 中嚴格限制 AI 保留 `[mm:ss.xx]`。
    *   `pipeline.ts`、`translate-provider.ts`：重構並加入強型別定義。
    *   PM2 配置：設定執行 `npm start` 呼叫 `tsx server.js` 運作 TS。
*   **`music-release-agent`**：
    *   `lrcParser.ts`：支援多重時間戳全域替換清除 (`/g`)。
    *   `translationMatcher.ts`：以 timeMs 數值為 key 解析出 `Record<number, string>` 的譯文映射表。
    *   `MarkdownLyricsView.tsx` 與 `KtvLyricsView.tsx`：支援 click-to-play 與 `useEffect` 控制的自動滾動。

---

## 2. 獨立單曲頁面與 UI 拋光實作計畫 (Song Page & UI Polish)

### 2.1 路由設計 (URL Layout)
為了解決 Spotify 專案中「同一首單曲可能屬於單曲 EP 也可能屬於大專輯」的對齊問題，我們採用 `/album/:albumId/song/:trackId` 路由：
1. **上下文（Context）一致性**：點進特定專輯的單曲時，重新整理依然能正確還原左側側邊欄的選中專輯與歌曲清單。
2. **精確的發行版本對齊**：明確告訴系統「在某專輯的脈絡下展示這首歌」，播放連結精確對齊當前發行版本。

### 2.2 前端路由與 UI 重構
*   `main.jsx`：新增單曲頁面路由匹配 `Route path="/album/:albumId/song/:trackId" element={<App />}`。
*   `App.jsx`：使用 `useParams` 提取 `trackId` 以決定渲染 `AILyricsPanel` 或提示選擇歌曲的 `Placeholder`。
*   `MetadataPanel.jsx`：改用 `navigate` 跳轉路由，且僅在 `import.meta.env.DEV` 開發模式下渲染偵錯資訊。
*   自訂 Favicon：覆寫預設 React icon，設計漸層音符 SVG。

---

## 3. 歌詞翻譯與 Obsidian 存檔拆分計畫 (`lyrics-vault-service`)

### 3.1 職責拆分目標
將歌詞翻譯與 Obsidian vault 落盤寫入功能抽離為獨立的 `lyrics-vault-service` 伴隨服務，使核心 repo 僅保留 thin client。

### 3.2 交接合約 (Handoff Schema)
*   **Request 格式 (`POST /api/translate`)**：
    ```json
    {
      "artistName": "string",
      "trackName": "string",
      "albumName": "string?",
      "forceRefresh": "boolean?"
    }
    ```
*   **Response 格式 (`200 OK`)**：
    ```json
    {
      "lyrics": "string",
      "source": "lrclib|ai-recall",
      "cached": "boolean",
      "promptVersion": "string",
      "vaultPath": "string"
    }
    ```
*   **降級防護**：若 `lyrics-vault-service` 連線不可達，核心 API 返回 502 錯誤，前端 UI 進行降級提示，核心服務與健康狀態不受影響。
