/**
 * =====================================================================
 * 🎼 Lyrics Service — 快取優先的歌詞翻譯協調器
 * =====================================================================
 * [技術] 流程：讀快取（hit 即回，零 token）→ miss 才呼叫 provider
 *        （LYRICS_PROVIDER=gemini|ollama，預設 gemini）→ write-through。
 *        forceRefresh 跳過讀取、直接重生並覆寫（手動失效的唯一入口）。
 * [童趣] 點菜流程：先看冷凍庫有沒有現成的（有就直接上桌）；
 *        沒有才請廚師現做，做完順手冰一份進冷凍庫。
 *        客人說「我要現做的！」（forceRefresh）才會跳過冷凍庫。
 * =====================================================================
 */
import { translateLyrics } from '../lyrics-translator.js';
import { PROMPT_VERSION, SYSTEM_INSTRUCTION, buildLyricsPrompt } from './lyrics-prompt.js';
import {
  resolveCacheDir,
  cacheFileName,
  readCachedLyrics,
  writeCachedLyrics
} from './lyrics-cache.js';

/** Ollama provider：本地模型，零 API 費用（需本機跑 Ollama） */
export async function translateWithOllama(artistName, trackName) {
  const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      system: SYSTEM_INSTRUCTION,
      prompt: buildLyricsPrompt(artistName, trackName),
      stream: false
    })
  });

  if (!response.ok) {
    throw new Error(`Ollama 回應異常 (${response.status})：請確認本機 Ollama 已啟動且已 pull ${model}`);
  }

  const data = await response.json();
  if (!data.response) {
    throw new Error('Ollama 回應中沒有翻譯內容');
  }
  return data.response;
}

/**
 * 取得歌詞翻譯（快取優先）。
 * @returns {{ text: string, cached: boolean, provider: string }}
 */
export async function getLyricsWithCache({ artistName, trackName, forceRefresh = false }) {
  const provider = (process.env.LYRICS_PROVIDER || 'gemini').toLowerCase();
  const cacheDir = resolveCacheDir();
  const fileName = cacheFileName({ artistName, trackName, provider, promptVersion: PROMPT_VERSION });

  // 1. 冷凍庫優先（forceRefresh 時跳過）
  if (!forceRefresh) {
    const hit = await readCachedLyrics(cacheDir, fileName);
    if (hit) {
      return { text: hit.body, cached: true, provider: String(hit.frontmatter.provider || provider) };
    }
  }

  // 2. miss → 請廚師現做
  const text = provider === 'ollama'
    ? await translateWithOllama(artistName, trackName)
    : await translateLyrics(artistName, trackName);

  // 3. write-through：冰一份進冷凍庫（寫入失敗不影響回應，只記 log）
  try {
    await writeCachedLyrics(cacheDir, fileName, {
      frontmatter: {
        artist: artistName,
        track: trackName,
        provider,
        promptVersion: PROMPT_VERSION,
        language: 'zh-Hant',
        createdAt: new Date().toISOString(),
        tags: 'lyrics, ai-translation'
      },
      body: text
    });
  } catch (error) {
    console.error('[LyricsService] 快取寫入失敗（不影響本次回應）:', error.message);
  }

  return { text, cached: false, provider };
}
