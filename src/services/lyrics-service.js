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
import { fetchLyricsFromSource } from './lyrics-source.js';
import {
  resolveCacheDir,
  cacheFileName,
  readCachedLyrics,
  writeCachedLyrics
} from './lyrics-cache.js';

/** Ollama provider：本地模型，零 API 費用（需本機跑 Ollama） */
export async function translateWithOllama(artistName, trackName, sourceLyrics) {
  const baseUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
  const model = process.env.OLLAMA_MODEL || 'qwen2.5:7b';

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      system: SYSTEM_INSTRUCTION,
      prompt: buildLyricsPrompt(artistName, trackName, sourceLyrics),
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
      return {
        text: hit.body,
        cached: true,
        provider: String(hit.frontmatter.provider || provider),
        source: hit.frontmatter.source ? String(hit.frontmatter.source) : undefined
      };
    }
  }

  // 2. miss → 先去歌詞圖書館（LRCLIB）借真實原文；借不到則降級為 LLM 記憶模式
  const sourced = await fetchLyricsFromSource(artistName, trackName);

  if (sourced?.instrumental) {
    const text = '### 歌曲介紹\n這是一首演奏曲（Instrumental），沒有歌詞，請直接聆聽音樂本身的故事。';
    await persistCache(cacheDir, fileName, { artistName, trackName, provider, source: 'lrclib-instrumental', text });
    return { text, cached: false, provider, source: 'lrclib-instrumental' };
  }

  const source = sourced ? 'lrclib' : 'llm-recall';
  let text;
  let finalSource = source;
  let finalProvider = provider;

  try {
    if (finalProvider === 'gemini' && !process.env.GEMINI_API_KEY) {
      // 若沒有 API 金鑰，主動丟出錯誤以觸發降級
      throw new Error('Missing GEMINI_API_KEY in environment variables');
    }

    // 3. 嘗試以設定的 provider 進行翻譯
    text = finalProvider === 'ollama'
      ? await translateWithOllama(artistName, trackName, sourced?.lyrics)
      : await translateLyrics(artistName, trackName, sourced?.lyrics);
  } catch (err) {
    // 若預設的 Gemini 翻譯失敗，嘗試降級到本地 Ollama
    if (finalProvider === 'gemini') {
      console.warn(`[LyricsService] ⚠️ Gemini 翻譯失敗 (${err.message})，嘗試降級至 Ollama...`);
      try {
        text = await translateWithOllama(artistName, trackName, sourced?.lyrics);
        finalProvider = 'ollama';
      } catch (ollamaErr) {
        // 若 Ollama 也失敗且有 LRCLIB 原文，則優雅降級顯示原文
        if (sourced?.lyrics) {
          console.warn(`[LyricsService] ⚠️ Ollama 降級也失敗 (${ollamaErr.message})，退回顯示 LRCLIB 原文`);
          text = `### 歌詞原文 (翻譯服務暫時不可用)\n\n${sourced.lyrics}`;
          finalSource = 'lrclib-untranslated';
        } else {
          // 若無原文則拋出原始錯誤，以防測試無法捕捉 GEMINI_API_KEY 錯誤
          throw err;
        }
      }
    } else {
      // 若本來就是 Ollama 且失敗，只要有原文就顯示原文
      if (sourced?.lyrics) {
        console.warn(`[LyricsService] ⚠️ Ollama 翻譯失敗 (${err.message})，退回顯示 LRCLIB 原文`);
        text = `### 歌詞原文 (翻譯服務暫時不可用)\n\n${sourced.lyrics}`;
        finalSource = 'lrclib-untranslated';
      } else {
        throw err;
      }
    }
  }

  // 4. write-through：冰一份進冷凍庫（寫入失敗不影響回應，只記 log）
  await persistCache(cacheDir, fileName, { artistName, trackName, provider: finalProvider, source: finalSource, text });

  return { text, cached: false, provider: finalProvider, source: finalSource };
}

async function persistCache(cacheDir, fileName, { artistName, trackName, provider, source, text }) {
  try {
    await writeCachedLyrics(cacheDir, fileName, {
      frontmatter: {
        artist: artistName,
        track: trackName,
        provider,
        source, // lrclib（真實歌詞）| llm-recall（模型記憶，幻覺風險誠實標示）
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
}
