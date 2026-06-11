import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
// prompt 與 system instruction 移至單一事實來源，與 Ollama provider 共用
import { SYSTEM_INSTRUCTION, buildLyricsPrompt } from './services/lyrics-prompt.js';

dotenv.config();

export async function translateLyrics(artistName, trackName) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment variables');
  }

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
  });

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: buildLyricsPrompt(artistName, trackName) }],
      config: {
        systemInstruction: SYSTEM_INSTRUCTION
      }
    });

    return response.text;
  } catch (error) {
    console.error(`[LyricsTranslator] ❌ 獲取歌詞與翻譯失敗:`, error.message || error);
    throw error;
  }
}
