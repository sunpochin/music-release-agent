# 🛠️ 開發環境代理與 HMR 熱更新架構說明

在本地開發此專案時，為了解決前端單頁應用（SPA）與後端 API 路由同源（Same-Origin）的問題，並同時保有 Vite 的 **即時熱更新 (HMR)** 與 **SEO 爬蟲 OG Meta 預覽** 能力，本專案採用了雙埠代理架構。

---

## 視覺化架構流程圖 (Mermaid Diagram)

```mermaid
graph TD
    %% 定義風格
    classDef client fill:#f9f,stroke:#333,stroke-width:2px;
    classDef cf fill:#2f74ff,stroke:#111,stroke-width:1px,color:#fff;
    classDef backend fill:#1db954,stroke:#111,stroke-width:2px,color:#fff;
    classDef frontend fill:#ff9f43,stroke:#111,stroke-width:1px,color:#fff;

    User([瀏覽器/爬蟲]) -->|HTTPS| CF[Cloudflare Tunnel<br/>release.sunpochin.xyz]
    CF -->|轉發至 Port 3011| Server[Express Backend<br/>Port 3011]

    subgraph PM2 守護進程
        Server
        Vite[Vite Dev Server<br/>Port 5173]
    end

    %% 判斷路由與環境
    Server -->|1. 檢查路徑| PathDecision{是否為 API 或 爬蟲路由?}
    
    PathDecision -->|是<br/>/api/*, /login, /callback, /album/*| API[後端核心處理邏輯<br/>Gemini/Spotify/快取]
    PathDecision -->|否<br/>/src/*, /@vite/*, 靜態資源| EnvDecision{NODE_ENV === 'development'?\n開發環境?}
    
    EnvDecision -->|是| Proxy[http-proxy-middleware]
    Proxy -->|2. 反向代理| Vite
    Vite -.->|3. WebSocket HMR| User
    
    EnvDecision -->|否| Static[直接分發<br/>dashboard/dist 靜態檔案]

    %% 套用風格
    class User client;
    class CF cf;
    class Server,API backend;
    class Vite,Proxy,Static frontend;
```

---

## 核心設計理念與優勢

### 1. 統一入口點（Single Point of Entry）
Cloudflare 不需要分別設定多個子網域（如 `api.sunpochin.xyz` 與 `release.sunpochin.xyz`），只需統一將 `release.sunpochin.xyz` 轉發至本地的 **Port 3011**（Express 後端）。

### 2. 開發與生產無縫切換
*   **開發環境 (`NODE_ENV=development`)**：
    後端會啟用 `http-proxy-middleware`，將所有非 API 與非爬蟲的靜態資源請求透明地反向代理至 **Port 5173** 的 Vite 服務。此時 Vite 的 WebSocket (`ws: true`) 會穿透後端代理，與瀏覽器建立 HMR 連線，達成即時修改、即時更新的極致流暢開發感。
*   **生產環境 (`NODE_ENV=production`)**：
    後端不再代理，改為直接使用 `express.static` 分發前端經過 `vite build` 壓縮優化後的 `dashboard/dist` 靜態資源，此時 **不需要開啟 Port 5173**，節省伺服器記憶體。

### 3. SEO 爬蟲友好（OG Metadata Pre-rendering）
當 Facebook 或 LINE 爬蟲請求 `/album/123/song/456` 時，Express 會在 **3011** 優先攔截並回傳完整的 HTML 與 Meta Tags（而不是回傳空的 SPA 首頁），保證在通訊軟體上的卡片預覽完美呈現。

---

## 👶 小朋友解釋法：為什麼會發生「雙重 React 衝突」？

### 故事背景
想像一下，我們開了一家叫 **「音樂釋出特工 (Music Release Agent)」** 的餐廳。
廚房裡有一位叫 **React** 的大廚，他有一本專門記點單和狀態的 **「神奇小筆記本 (useState/Hooks)」**。

### 發生了什麼事？
因為餐廳的門牌指引有點複雜（後端 3011 代理轉發到前端 5173，而且有兩層不同的 node_modules 資料夾），服務生們搞混了：
- **服務生 A (App.jsx)** 跑去跟 **React 廚師 1 號** 點了一份「歌曲清單」。
- **服務生 B (useAlbumTracks.js)** 卻跑去問 **React 廚師 2 號**：「剛剛點的歌曲清單好了嗎？」
- **React 廚師 2 號** 翻開自己的神奇小筆記本，一臉困惑地說：「我的筆記本是空的啊！根本沒有這筆點單！(TypeError: Cannot read properties of null (reading 'useState'))」

結果，服務生們在廚房撞成一團，盤子全摔碎了（網頁直接白屏報錯）。

### 我們是怎麼治好它的？
我們去找餐廳總經理（`vite.config.js`），在佈告欄上寫下一條鐵律：
> 🚫 **「廚房裡只能有唯一的一位 React 大廚！不准有任何分身複製人！所有服務生如果要找 React 廚師，必須統一走到 `dashboard/node_modules/react` 這間辦公室，不准走錯！」** (resolve.alias & resolve.dedupe)

現在，所有人都只會找同一位大廚，神奇小筆記本永遠能對得起來，餐廳就能順暢出菜囉！

