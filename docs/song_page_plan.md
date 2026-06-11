# 🎤 Song Page 下一步規劃

> **狀態更新（2026-06-12）：P0、P1、P2 全部完成並各自 commit。**
> 證明：`npm test`（87 個含 share-meta 與 waveform 確定性測試）、`npx playwright test`（7 個 e2e，含 deep link、404、剪貼簿、鍵盤導航+音波、OG meta 爬蟲視角）。
> 額外收穫：deep-link e2e 曝光並修復了原版 App.jsx 潛伏的「歌單永遠讀取中」race（詳見 kid_friendly_changelog.md Round 6）。
> 「刻意不做」清單維持不變 — 面試時主動講這個取捨。

目標：讓 `/album/:albumId/song/:trackId` 從「App.jsx 裡的一個面板」變成「值得被分享出去的頁面」。
選題原則延續本 repo 哲學：**每個亮點都要有確定性的可執行證明，不做依賴外部 API 心情的 flaky 功能。**

---

## 現狀盤點

- ✅ 路由已存在（`/album/:albumId/song/:trackId`），URL 與選取狀態雙向同步
- ✅ AI 歌詞/分析面板、ShareCard 圖卡導出、iOS 同步分享都能動
- ⚠️ App.jsx 是巨石：專輯、曲目、歌詞、分析、發文……所有狀態都擠在一個元件
- ⚠️ 直接貼連結給朋友：重新整理後 loading 體驗差、track 不存在時沒有友善處理
- ⚠️ 分享到社群沒有 OG 預覽卡片（連結看起來像垃圾訊息）

---

## P0 — 讓它成為「真正的頁面」（最高 ROI，先做這個）

> **小朋友說明法**：現在的歌曲頁像是「大客廳裡的一個角落」，所有家具（狀態）都堆在客廳。
> 我們要幫它隔出一個自己的房間（SongPage 元件 + custom hooks），
> 房間有自己的門牌（deep link 可直開）、有「整理中」的牌子（skeleton）、
> 走錯房間會有人帶路（404 友善頁），而不是看到一片空白嚇一跳。

| # | 事項 | 面試價值 | 實用價值 |
|---|---|---|---|
| 1 | 抽出 `SongPage` 容器 + `useAlbumTracks` / `useTrackAnalysis` custom hooks | 重構巨石、關注點分離、custom hook 設計 — React 面試最常考 | 之後所有功能都蓋在乾淨地基上 |
| 2 | Loading / Error / Empty 三態 skeleton（毛玻璃風格與現有 UI 一致） | 「你怎麼處理非同步三態」必考題的實品回答 | 體感提升最大的一項 |
| 3 | trackId 不存在 → 友善 404 區塊（推薦同專輯其他曲目） | 邊界思維 | 分享出去的舊連結不會死 |
| 4 | e2e：**直接開** deep link `/album/x/song/y`（現有 e2e 只測從首頁點進去）+ 404 案例 | 與 repo「宣稱必有證明」哲學一致 | 防 regression |

**驗收**：`npx playwright test` 新增 2 案例全綠；`npm run build` 通過；App.jsx 行數顯著下降。

## P1 — 分享體驗（對外最討喜）

> **小朋友說明法**：你寄邀請卡給朋友，卡片上要有漂亮的照片和標題（OG meta），
> 朋友才知道是派對邀請，而不是一張白紙。但我們的房子是「進門後才畫畫」（CSR），
> 郵差（社群爬蟲）不會進門等畫畫完成 — 所以要在門口先貼好一張海報（server 端 meta）。

1. **OG meta endpoint**：`server.js` 對 `/album/:id/song/:id` 回帶 `og:title`、`og:image`（用專輯封面）、`og:description` 的 HTML，再 client-side hydrate。面試可深聊 CSR/SSR/爬蟲差異 — 用一個小 endpoint 講清楚，比「我會 Next.js」更有說服力。
2. **複製連結按鈕** + 既有 Web Share API 整合（iOS 同步分享的故事已經很好，補上桌面端體驗）。
3. 驗收：`curl -s localhost:3011/album/x/song/y | grep og:image`（可寫進 demo:verify 家族）。

## P2 — 互動亮點（面試 wow 點，挑不會壞的）

1. **確定性音波視覺化**：以 trackId 為 seed 生成 canvas 波形/頻譜動畫。**刻意不用** Spotify audio-features（已棄用）或 30 秒 preview（不穩定）— 面試時這個取捨本身就是亮點：「我選了永遠不會壞的視覺化，而不是 demo 當天會翻車的真實音訊」。
2. **鍵盤導航**：`j`/`k` 上下首、`Enter` 抓歌詞 + 對應 `aria-*` 與 focus 管理 — a11y 是資深前端的分水嶺話題。
3. 歌詞逐行 stagger 進場動畫（CSS only，零依賴）。

## 刻意不做（面試時主動講，是加分不是扣分）

- ❌ 30 秒試聽播放器：`preview_url` 已大規模回傳 null，demo 當天翻車風險高
- ❌ 即時 BPM/調性分析：audio-features API 已棄用，替代源（AcousticBrainz）已停止更新
- ❌ SSR 框架遷移：為一頁 OG meta 換掉整個 Vite 架構，不符合最小高槓桿原則

---

## 建議順序與時程

P0（半天～一天）→ P1-1 OG meta（半天）→ P2-1 視覺化（半天）。
每完成一項：補小朋友說明法到 `kid_friendly_changelog.md` → 測試 → commit。
