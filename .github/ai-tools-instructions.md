# 🤖 所有 AI 工具協作指南

本文檔說明如何在本專案中使用任何 AI 工具（GPT、Gemini、Codex、Copilot、Claude）。

---

## 核心規則：小朋友解說法（必須遵守 🔴）

所有 AI 生成的代碼和文檔必須使用「小朋友解說法」。

### 什麼是「小朋友解說法」？

用 7-10 歲小朋友能聽懂的方式解釋技術決策。

**✅ 好的例子：**
```javascript
// 【小朋友解釋法】：
// 點擊歌曲時，舊歌詞會立即消失（畫面閃一下），
// 400 毫秒後新歌詞才出現（又閃一下）。
// 這樣會閃兩次，很煩。
// 所以我們改成：清空舊歌詞、等待、載入新歌詞，
// 一個步驟接一個步驟，只閃一次。

useEffect(() => {
  setLyricsData('')
  const timer = setTimeout(() => {
    fetchLyricsFor(selectedTrack)
  }, 400)
}, [selectedTrack])
```

**❌ 差的例子：**
```javascript
// 防答非所問的競態條件處理機制，透過 ref 追蹤以確保異步回應
// 只在 trackId 仍為當前值時執行狀態更新
```

---

## 🛠️ 工具別指示

### 1️⃣ Claude (Claude Code / Claude API)
- 參考：[CLAUDE_CONVENTIONS.md](../CLAUDE_CONVENTIONS.md)
- 語言：中文或英文（隨專案而定）
- 檔案格式：Markdown 註解 (`//【小朋友解釋法】：`)

### 2️⃣ GitHub Copilot
- 參考：[.github/copilot-instructions.md](./copilot-instructions.md)
- 啟用方式：在 `.github/copilot-instructions.md` 中定義
- 執行方式：Copilot 在生成代碼時自動應用規則

### 3️⃣ Google Gemini
**使用提示詞範例：**
```
我用「小朋友解說法」規則開發。這表示所有複雜邏輯都要用 7-10 歲小朋友能聽懂的方式解釋。

請生成代碼時包含以下：
- 用日常語言解釋「為什麼」，不用專業術語
- 禁用術語：防答非所問、遞迴、競態條件、狀態管理
- 複雜邏輯前加上【小朋友解釋法】註解

請參考這個例子：
[貼上 CLAUDE_CONVENTIONS.md 的例子]
```

### 4️⃣ OpenAI GPT
**使用提示詞範例（粘貼到 Custom Instructions）：**
```
My project uses "Xiaopengyo Jieshi" (小朋友解說法) — 
a rule that all complex code must be explained in language 
a 7-10 year old would understand.

When generating code:
1. Include comment blocks explaining "WHY" (not just "WHAT")
2. Avoid jargon: don't use "race condition", "state management", 
   "recursive", etc. Use everyday language instead.
3. Format: // 【小朋友解釋法】：[explanation in Chinese]

Example:
// 【小朋友解釋法】：
// When user clicks a song, old lyrics disappear (flash 1),
// wait 400ms, then new lyrics appear (flash 2).
// Problem: flashes twice. Solution: combine into one smooth flow.

Reference: See CLAUDE_CONVENTIONS.md in the project.
```

### 5️⃣ Anthropic Codex
- 與 Claude Code 相同的規則
- 參考：[CLAUDE_CONVENTIONS.md](../CLAUDE_CONVENTIONS.md)

### 6️⃣ Antigravity IDE
- 與 Claude Code 相同的規則
- 在 IDE 設定中引用 [CLAUDE_CONVENTIONS.md](../CLAUDE_CONVENTIONS.md)

### 7️⃣ VS Code Inline Chat
**在 VS Code settings.json 中添加：**
```json
{
  "github.copilot.chat.localeOverride": "zh-TW",
  "chat.instructions": "See .github/copilot-instructions.md for 'Xiaopengyo Jieshi' convention"
}
```

---

## 📋 快速檢查清單

在任何 AI 工具中提交代碼前，檢查：

- [ ] 複雜邏輯都有「小朋友解說法」註解
- [ ] 沒有使用禁止術語（防答非所問、遞迴、競態條件等）
- [ ] 註解能讓非技術人員理解核心邏輯
- [ ] commit message 包含【小朋友解釋法】段落
- [ ] 代碼風格與現有代碼一致

---

## 🎓 常見場景

### React Hook（最常見）
```javascript
// ✅ 正確
// 【小朋友解釋法】：
// useRef 像一張貼在牆上的便簽紙。
// 即使組件重新渲染（重新執行代碼），這張紙上的內容也不會改變。
// 我們用它來記錄「當時選中的歌是哪一個」，
// 這樣如果有慢速的網路請求，我們可以檢查：
// 「等等，那個舊請求回來了？但歌已經換了！不要更新。」

const selectedTrackRef = useRef(selectedTrack)
useEffect(() => {
  selectedTrackRef.current = selectedTrack
}, [selectedTrack])
```

### 非同步錯誤處理
```javascript
// ✅ 正確
// 【小朋友解釋法】：
// 502 錯誤表示「翻譯服務小助手不在」。
// 不用顯示紅色的「ERROR」嚇使用者，改成友善的提示：
// 「歌詞服務暫時不可用，但歌詞仍然可以看。」
// 這樣核心功能（播放音樂）不受影響。

if (res.status === 502) {
  setLyricsData('### 歌詞服務暫時離線\n\n核心功能不受影響...')
  return
}
```

---

## 🚫 禁止術語替換表

| ❌ 禁止 | ✅ 改為 |
|--------|--------|
| 防答非所問 | 確保舊的請求不會覆蓋新的 |
| 遞迴 | 自己呼叫自己 |
| 競態條件 | 多個動作同時進行導致的混亂 |
| 狀態管理 | 記住當前的情況 |
| 副作用 | 額外發生的事情 |
| 高階組件 | 包裝其他組件的組件 |
| 序列化 | 轉換成文本 |
| 反序列化 | 從文本轉換回去 |

---

## 📞 常見問題

**Q: 是否所有代碼都要加「小朋友解說法」？**

A: 不是。只有複雜邏輯（超過 1 個 if/else、非顯而易見的設計、性能優化）需要。簡單代碼（如 `setCount(count + 1)`）不用。

**Q: 註解語言可以是英文嗎？**

A: 可以，但要清楚。本專案主要用繁體中文。

**Q: 已經生成了不符合規則的代碼怎麼辦？**

A: 直接要求 AI 重新生成，並在提示詞中貼上「小朋友解說法」的例子。

**Q: 這會讓代碼變冗長嗎？**

A: 不會。只註解複雜部分（通常是代碼的 10-15%），清晰的變數名已經自解釋了。

---

## 🔗 相關文件

- [CLAUDE_CONVENTIONS.md](../CLAUDE_CONVENTIONS.md) — 完整規則
- [.github/copilot-instructions.md](./copilot-instructions.md) — GitHub Copilot 專用
- [commit message 標準](../CLAUDE_CONVENTIONS.md#-commit-message-標準)

---

**版本：** 1.0  
**生效日期：** 2026-06-13  
**強制等級：** 🔴 必須遵守（鐵律）
