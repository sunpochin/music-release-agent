import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export async function translateLyrics(artistName, trackName) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('Missing GEMINI_API_KEY in environment variables');
  }

  const prompt = `
請為我尋找並翻譯以下歌曲的歌詞：
- 歌手：${artistName}
- 歌名：${trackName}

請提供：
1. 一段簡短的歌曲背景或意境介紹（約 50 字）。
2. 完整原文歌詞與「繁體中文」翻譯對照。
3. 排版請使用 Markdown 格式，例如：

### 歌曲介紹
[介紹內容]

### 歌詞對照
**[原文]**
[中文翻譯]

**[原文]**
[中文翻譯]

請確保翻譯感性且通順，符合音樂的意境。
`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ text: prompt }],
      config: {
        systemInstruction: "你是一位精通多國語言且極具文學素養的資深樂評人，擅長將外文歌詞翻譯為優美、感性且富含意境的繁體中文。"
      }
    });

    return response.text;
  } catch (error) {
    console.error(`[LyricsTranslator] ❌ 獲取歌詞與翻譯失敗:`, error.message || error);
    throw error;
  }
}
