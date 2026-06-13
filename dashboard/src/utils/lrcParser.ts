export interface LrcLine {
  timeMs: number;
  text: string;
}

/**
 * 將 LRC 格式字串解析為帶有時間戳與文字的陣列
 * @param lrcString 例如 "[01:23.45] 歌詞內容\n..."
 * @returns LrcLine[]
 */
export function parseLrc(lrcString: string): LrcLine[] {
  if (!lrcString) return [];
  
  const lines = lrcString.split('\n');
  const result: LrcLine[] = [];
  
  // 匹配 [mm:ss.xx] 或是 [mm:ss.xxx]
  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d{2,3})?)\]/;
  
  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      // 使用全域正則表達式清除可能存在的多個時間標籤 (例如 [01:20.00][02:30.00] lyrics)
      const text = line.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim();
      
      const timeMs = Math.floor((minutes * 60 + seconds) * 1000);
      
      // 有時候會有純時間戳沒有歌詞的行，我們依然保留它作為間奏的過渡
      result.push({ timeMs, text });
    }
  }
  
  // 確保依照時間排序
  return result.sort((a, b) => a.timeMs - b.timeMs);
}
