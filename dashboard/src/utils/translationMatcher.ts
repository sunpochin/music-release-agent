export function createTranslationMap(markdown: string): Record<number, string> {
  const map: Record<number, string> = {};
  if (!markdown) return map;
  
  const lines = markdown.split('\n').map(l => l.trim()).filter(l => l);
  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d{2,3})?)\]/;
  
  // 記錄上一個看到的 timeMs，用來收集同一時間戳的多行（例如日文原文、羅馬音、中文翻譯）
  let lastTimeMs = -1;
  let linesAtSameTime: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = timeRegex.exec(line);
    
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseFloat(match[2]);
      const timeMs = Math.floor((minutes * 60 + seconds) * 1000);
      const text = line.replace(timeRegex, '').trim();

      if (timeMs !== lastTimeMs) {
        // 新的時間戳出現了，把上一個時間戳收集到的「最後一行」當作中文翻譯存起來
        if (lastTimeMs !== -1 && linesAtSameTime.length > 1) {
          // 依照 prompt，最後一行通常是繁體中文翻譯
          map[lastTimeMs] = linesAtSameTime[linesAtSameTime.length - 1];
        }
        lastTimeMs = timeMs;
        linesAtSameTime = [];
      }
      
      if (text) {
        linesAtSameTime.push(text);
      }
    }
  }

  // 處理最後一組
  if (lastTimeMs !== -1 && linesAtSameTime.length > 1) {
    map[lastTimeMs] = linesAtSameTime[linesAtSameTime.length - 1];
  }

  return map;
}

export function getTranslation(timeMs: number, map: Record<number, string>): string | null {
  // 允許極小誤差 (例如 10 毫秒內)
  for (let offset = -10; offset <= 10; offset++) {
    if (map[timeMs + offset]) return map[timeMs + offset];
  }
  return null;
}
