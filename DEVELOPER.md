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
