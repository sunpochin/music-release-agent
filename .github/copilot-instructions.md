# 🤖 GitHub Copilot 協作指南

## 給 Copilot 的指示

Copilot 生成任何代碼時，請遵守本專案的「小朋友解說法」規則。

### 核心要求

1. **複雜邏輯必須有中文註解**
   - 用 7-10 歲小朋友能聽懂的方式
   - 解釋「為什麼」，不只是「做什麼」

2. **禁用以下術語**（改成日常說法）
   - ❌ 防答非所問 → ✅ 確保舊的請求不會覆蓋新的
   - ❌ 遞迴 → ✅ 自己呼叫自己
   - ❌ 競態條件 → ✅ 多個動作同時進行導致的混亂
   - ❌ 狀態管理 → ✅ 記住當前的情況

3. **commit message 格式**
   ```
   type: 一句話說明
   
   【小朋友解釋法】：
   [簡短解說]
   ```

### 例子：Copilot 該產生什麼

**❌ 不要這樣：**
```javascript
// 防答非所問的異步狀態管理，使用 ref 進行 trackId 追蹤
const trackIdAtStart = track.id
if (selectedTrackRef.current?.id === trackIdAtStart) {
  setLyricsData(result?.text)
}
```

**✅ 要這樣：**
```javascript
// 【小朋友解釋法】：
// 在請求開始時記錄「當時是哪首歌」(trackIdAtStart)。
// 請求完成後，檢查「現在還是同一首歌嗎？」。
// 只有一樣才更新歌詞。這樣快速換歌時，舊歌詞就不會亂出現。

const trackIdAtStart = track.id
if (selectedTrackRef.current?.id === trackIdAtStart) {
  setLyricsData(result?.text)
}
```

### 常見場景

#### React Hook 優化
```javascript
// ✅ 好的例子
// 【小朋友解釋法】：
// 延遲 400 毫秒再載入，就像「等朋友安靜後再開始遊戲」。
// 這樣可以避免快速點擊時載入太多次。

const timer = setTimeout(() => {
  fetchLyricsFor(selectedTrack)
}, 400)
```

#### 錯誤處理
```javascript
// ✅ 好的例子
if (res.status === 502) {
  // 【小朋友解釋法】：
  // 502 表示翻譯服務暫時不可用，但不用嚇使用者。
  // 改成友善的提示，繼續顯示歌詞（只是沒有翻譯）。
  setLyricsData('### 歌詞服務暫時離線')
}
```

#### 條件判斷
```javascript
// ✅ 好的例子
if (!selectedAlbum || !selectedTrack) return
// 【小朋友解釋法】：
// 如果還沒選歌，就不用做事。就像「先確認要去哪裡，才能出發」。
```

### 禁止清單

不要產生以下代碼：
- ❌ `console.log('debugging')` 沒有註解
- ❌ 複雜 hook 邏輯沒有「為什麼」的解釋
- ❌ async/await 流程沒有錯誤說明
- ❌ 使用專業術語而不解釋

### 提示詞範例

當你問 Copilot 時，可以這樣寫：

**提示詞：**
```
為 useTrackAi hook 加上「小朋友解說法」註解。
解釋為什麼要用 ref 追蹤 selectedTrack，
以及為什麼要延遲 400 毫秒。
用 7-10 歲小朋友能聽懂的方式。
```

**Copilot 應該回答：**
```javascript
// 【小朋友解釋法】：
// 1. 用 ref 記錄「當時選中的歌」，因為請求可能很慢
// 2. 如果請求完成時，歌已經換了，就不更新（避免亂套）
// 3. 延遲 400 毫秒再載入，避免「邊打字邊搜尋」時發太多請求

const selectedTrackRef = useRef(selectedTrack)
useEffect(() => {
  selectedTrackRef.current = selectedTrack
}, [selectedTrack])

useEffect(() => {
  if (!selectedAlbum || !selectedTrack) return
  
  const timer = setTimeout(() => {
    fetchLyricsFor(selectedTrack)
  }, 400)
  
  return () => clearTimeout(timer)
}, [selectedAlbum, selectedTrack])
```

---

**最後提醒：** 
使用 Copilot 時，請檢查產生的代碼是否遵守這些規則。
如果沒有，請手動加上「小朋友解說法」註解。
