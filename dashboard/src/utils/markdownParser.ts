/**
 * markdownParser.ts
 * 將 AI 回傳的 Markdown 字串解析為結構化的 Block 陣列，
 * 供 React 直接渲染，免去 dangerouslySetInnerHTML 的 XSS 風險與 DOM 操作。
 */

export type MarkdownBlock =
  | { type: 'heading', level: number, text: string }
  | { type: 'hr' }
  | { type: 'lyric', timeMs: number, text: string, translation?: string }
  | { type: 'paragraph', text: string }

export function parseMarkdownToBlocks(markdown: string): MarkdownBlock[] {
  if (!markdown) return []

  const lines = markdown.split('\n')
  const blocks: MarkdownBlock[] = []
  
  // 記錄上一個看到的帶有時間戳的 lyric block，用來合併翻譯
  let lastLyricBlock: { type: 'lyric', timeMs: number, text: string, translation?: string } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    // 1. Heading 3
    if (line.startsWith('###')) {
      blocks.push({ type: 'heading', level: 3, text: line.replace('###', '').trim() })
      lastLyricBlock = null
      continue
    }

    // 2. Heading 2
    if (line.startsWith('##')) {
      blocks.push({ type: 'heading', level: 2, text: line.replace('##', '').trim() })
      lastLyricBlock = null
      continue
    }

    // 3. HR
    if (line === '---') {
      blocks.push({ type: 'hr' })
      lastLyricBlock = null
      continue
    }

    // 4. Lyric Line ([mm:ss.xx] or [mm:ss])
    const timeMatch = line.match(/^\[(\d{2}):(\d{2}(?:\.\d{2,3})?)\](.*)/)
    if (timeMatch) {
      const minutes = parseInt(timeMatch[1], 10)
      const seconds = parseFloat(timeMatch[2])
      const timeMs = Math.floor((minutes * 60 + seconds) * 1000)
      const text = timeMatch[3].trim()

      // 如果當前的時間戳跟上一句一模一樣，我們視為它是翻譯，合併進上一句！
      if (lastLyricBlock && lastLyricBlock.timeMs === timeMs) {
        lastLyricBlock.translation = text
      } else {
        const newBlock = { type: 'lyric' as const, timeMs, text }
        blocks.push(newBlock)
        lastLyricBlock = newBlock
      }
      continue
    }

    // 5. Paragraph (or lists/quotes treated as paragraphs for simplicity)
    blocks.push({ type: 'paragraph', text: line })
    lastLyricBlock = null
  }

  return blocks
}
