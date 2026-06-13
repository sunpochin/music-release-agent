# 🎵 音樂發行管理系統 - Claude AI 編碼規則

## 【小朋友解說法】- 程式碼註釋標準 📝

這是我們專案的**鐵律**。所有修改——無論多小——都必須遵守此規則。適用於：
- ✅ Claude Code / Claude API
- ✅ GitHub Copilot
- ✅ Google Gemini
- ✅ OpenAI GPT
- ✅ VS Code 中所有 AI 工具
- ✅ Anthropic Codex
- ✅ Antigravity IDE

---

## 核心原則

### 1️⃣ **什麼是「小朋友解說法」？**

用 7-10 歲小朋友能聽懂的方式解釋技術決策。不用「防答非所問」、「遞迴」、「狀態管理」等專業術語。

**✅ 好的例子：**
```javascript
// 【小朋友解釋法】：
// 當使用者點進一首歌，我們會先把舊歌詞擦掉，
// 再用 400 毫秒的延遲載入新歌詞。
// 目的：避免畫面閃兩次（一次空白，一次新歌詞出現）
const autoFetchedRef = useRef(null)
useEffect(() => {
  setLyricsData('')  // 擦黑板
  if (!selectedAlbum || !selectedTrack) return
  
  setRawLoading(true)
  const timer = setTimeout(() => {
    autoFetchedRef.current = selectedTrack.id
    fetchLyricsFor(selectedTrack, { translate: false })
  }, 400)
  return () => clearTimeout(timer)
}, [selectedAlbum, selectedTrack])
```

**❌ 差的例子：**
```javascript
// 防答非所問的狀態追蹤機制，採用 ref 模式存儲 trackId 以避免競態條件
// 並在異步完成時驗證 selectedTrackRef.current 與 trackIdAtStart 一致性
```

---

### 2️⃣ **什麼時候要用「小朋友解說法」？**

#### 一定要用 ✅
- **複雜邏輯**：超過 1 個 if/else 的控制流
- **非顯而易見的設計**：為什麼要 debounce？為什麼用 ref？
- **性能優化**：為什麼不直接做？
- **錯誤處理**：為什麼要 fallback？
- **狀態流程**：React hooks 的多個 effect 之間的協作
- **業務規則**：為什麼 AI 翻譯要失敗降級？

#### 不用 ❌
- **變數名清晰**：`const isLoading = true` 不用註解
- **單行操作**：`setCount(count + 1)` 不用註解
- **自解釋代碼**：`if (user.email.includes('@'))` 不用註解

---

### 3️⃣ **小朋友解說法的結構**

```markdown
【小朋友解釋法】：
[背景] — 這是什麼情況？
[目的] — 我們要解決什麼問題？
[做法] — 怎麼做？（最多 2-3 步）
[結果] — 最後會怎樣？

可選：
[為什麼這樣做] — 有什麼好處或陷阱？
```

**例子：**
```javascript
// 【小朋友解釋法】：
// 背景：使用者快速點擊多首歌時，舊的 AI 翻譯請求可能在新歌詞後才回來
// 目的：確保只顯示「當前歌曲」的翻譯，不要被舊翻譯覆蓋
// 做法：
//   1. 在請求開始時記錄「當前歌曲 ID」(trackIdAtStart)
//   2. 翻譯完成後，檢查「當時的歌曲 ID」是否還是當前的？
//   3. 只有一樣才更新畫面
// 結果：快速換歌時，舊翻譯被自動忽略，不會亂套

const trackIdAtStart = track.id
const res = await fetch('/api/lyrics', { ... })
const result = await res.json()

// 驗證「監視器」：歌曲有沒有變過？
if (selectedTrackRef.current?.id === trackIdAtStart) {
  setLyricsData(result?.text)
}
```

---

## 📋 commit message 標準

所有 commit 都要包含「小朋友解說法」的摘要。

**格式：**
```
feat/fix/refactor: 一句話說明做什麼

【小朋友解釋法】：
[詳細解說，最多 3-4 行]

Co-Authored-By: [AI工具名] <noreply@[源]>
```

**例子：**
```
fix: eliminate double flash when switching songs in lyrics panel

【小朋友解釋法】：
點擊歌曲時，歌詞會閃兩次：
1. 先閃空白（舊歌詞被清除）
2. 再閃新歌詞（載入完成）
原因是兩個 useEffect 分別「擦黑板」和「載入」。
現在合併成一個 useEffect，避免中間的空狀態。

Co-Authored-By: Claude Haiku 4.5 <noreply@anthropic.com>
```

---

## 🎯 特定場景範例

### React Hooks（最常見）

```javascript
// ✅ 好的例子：解釋為什麼要用 ref 追蹤
const selectedTrackRef = useRef(selectedTrack)
useEffect(() => {
  selectedTrackRef.current = selectedTrack
  // 【小朋友解釋法】：
  // 用一張小紙條（ref）記錄「當時選中的歌曲」，
  // 這樣即使使用者快速換歌，我們也能檢查：
  // 「等等，之前的請求還在進行嗎？但現在歌曲已經換了！」
  // 所以就不更新舊歌詞了，只更新新歌詞。
}, [selectedTrack])
```

### 非同步流程

```javascript
// ✅ 好的例子：解釋為什麼要 debounce
const handleSearch = debounce(async (query) => {
  // 【小朋友解釋法】：
  // 使用者在搜尋框裡打字時，每打一個字就會觸發搜尋。
  // 如果有 100 個字，就會發送 100 個請求！太浪費了。
  // debounce 的做法是：「等使用者停止打字 300 毫秒後，
  // 才發一次請求」。就像老師說「安靜」後還要等幾秒才開始上課。
  const res = await fetch(`/api/search?q=${query}`)
}, 300)
```

### 錯誤處理

```javascript
// ✅ 好的例子：解釋降級策略
if (res.status === 502) {
  // 【小朋友解釋法】：
  // 502 表示「歌詞翻譯的小助手（companion service）不在」。
  // 不用顯示紅色錯誤訊息嚇使用者，改成友善的提示：
  // 「暫時無法翻譯，但可以繼續看歌詞」。
  // 這樣核心功能（播放音樂）不受影響，使用體驗更好。
  setLyricsData('### 歌詞服務暫時離線\n\n...')
}
```

---

## 📚 為什麼要這樣做？

這個規則的目的：

| 對象 | 好處 |
|------|------|
| **未來的開發者** | 不用猜「為什麼」，直接能理解 |
| **Code Review** | 不用問 100 個問題，直接看懂邏輯 |
| **Codex/Copilot** | 產生的代碼更貼近原意，減少修改次數 |
| **非技術利益者** | 能看懂技術決策背後的商業價值 |
| **6 個月後的你** | 看自己的代碼時不用重新思考一遍 |

---

## 🔧 工具配置

### VS Code 設定（`.vscode/settings.json`）

```json
{
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "claude.conventions": "See CLAUDE_CONVENTIONS.md"
}
```

### GitHub Copilot Prompt（`.github/copilot-instructions.md`）

請見 [COPILOT_INSTRUCTIONS.md](./COPILOT_INSTRUCTIONS.md)

### Claude Code 配置（`.claude/settings.json`）

```json
{
  "languageModel": "claude-opus-4-8",
  "conventions": {
    "style": "xiaopengyyou_jieshi",
    "comments": "required_for_complex_logic",
    "commit_messages": "must_include_explanation"
  }
}
```

---

## ✅ 檢查清單

每個 PR 合併前，檢查：

- [ ] 複雜邏輯都有「小朋友解說法」註解
- [ ] commit message 包含清晰的動機解釋
- [ ] 如果有 hook、async 流程、錯誤處理，都有註解
- [ ] 沒有「防答非所問」、「競態條件」等術語（改成日常說法）
- [ ] 註解能讓 7-10 歲小朋友（或非技術人員）理解

---

## 📞 疑問排查

**Q: 「小朋友解說法」會讓代碼變得冗長嗎？**

A: 不會。只註解複雜邏輯（10-15% 的代碼），清晰的變數名已經自解釋了。

**Q: 現有代碼沒有這些註解，要全部改嗎？**

A: 不用。只在**修改**時加上。逐步改進即可。

**Q: 可以用其他語言寫註解嗎（英文、日文）？**

A: 可以，但要確保清楚。建議跟著專案主要使用的語言（本專案是繁體中文）。

---

## 🎓 參考資源

- [原始概念出處](https://github.com/sunpochin/music-release-agent/commit/37d13d2) - 本規則在歌詞雙閃修復時提出
- [小朋友解說法的演變](./docs/CLAUDE_EVOLUTION.md)
- [AI 工具整合指南](./docs/AI_TOOL_INTEGRATION.md)

---

**最後的話：**

> 「好的代碼像好的文章——不是寫給電腦看，是寫給人看的。」
>
> 這個規則就是確保我們寫的每一行代碼，都能讓任何人（包括 6 個月後的自己）
> 在 2 分鐘內理解「為什麼」，而不只是「做什麼」。
>
> —— Pac's Music Release Team

---

**版本：** 1.0  
**生效日期：** 2026-06-13  
**強制等級：** 🔴 必須遵守（鐵律）
