export function createTranslationMap(markdown: string): Record<string, string> {
  const map: Record<string, string> = {};
  if (!markdown) return map;
  
  const lines = markdown.split('\n').map(l => l.trim());
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check if line is bolded original text, e.g. **Hello World**
    if (line.startsWith('**') && line.endsWith('**')) {
      const original = line.replace(/\*\*/g, '').trim();
      const nextLine = lines[i + 1];
      // If the next line exists and is not a header or another bold line
      if (nextLine && !nextLine.startsWith('#') && !nextLine.startsWith('**')) {
        map[original] = nextLine.trim();
        // Also normalize original to handle punctuation differences
        const normalized = original.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/g, '').replace(/\s+/g, '');
        if (normalized) {
          map[normalized] = nextLine.trim();
        }
      }
    }
  }
  return map;
}

export function getTranslation(original: string, map: Record<string, string>): string | null {
  if (!original) return null;
  if (map[original.trim()]) return map[original.trim()];
  
  const normalized = original.toLowerCase().replace(/[^\w\s\u4e00-\u9fa5\u3040-\u30ff\u3400-\u4dbf]/g, '').replace(/\s+/g, '');
  if (normalized && map[normalized]) return map[normalized];
  
  return null;
}
