import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

export const aiRoutes = express.Router();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

aiRoutes.post('/top-tracks-review', async (req, res) => {
  try {
    const { tracks } = req.body;
    
    if (!tracks || !Array.isArray(tracks) || tracks.length === 0) {
      return res.status(400).json({ error: 'Missing or invalid tracks array' });
    }

    const tracksText = tracks.map((t: any, i: number) => 
      `${i + 1}. ${t.name} by ${t.artists.map((a: any) => a.name).join(', ')} (Album: ${t.album.name})`
    ).join('\n');

    const prompt = `
作為一位深具洞察力且文筆優美、充滿情感溫度的音樂雜誌專欄作家（風格類似 Pitchfork 但更溫暖），
請根據使用者最近最常聽的 5 首 Spotify 歌曲，寫一段「近期最愛品味分析 (Top Tracks AI Review)」。

【用戶最近最愛的 5 首歌】
${tracksText}

【你的寫作要求】
1. 觀察這些歌曲之間的關聯（例如曲風、情緒、發行年代、或者某種潛在的氛圍），用一段引人入勝的開場白破題。
2. 點出幾首核心曲目的亮點，不用每一首都講，挑選最具代表性或最能反映心理狀態的歌曲深入分析。
3. 給這個人的近期聽歌品味下一個精緻的「標題」或「總結」（例如：「在都會喧囂中尋找寧靜的霓虹之聲」或「充滿破碎感卻不失希望的獨立靈魂」）。
4. 語言請使用繁體中文。
5. 盡量採用生動的形容詞與感官描寫，並適當使用 Markdown 語法（例如：**粗體**、引用區塊）來排版。
6. 限制在 300 到 500 字左右，不要太長，以便放在 UI 卡片中閱讀。
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        temperature: 0.7,
      }
    });

    res.json({ review: response.text });
  } catch (error: any) {
    console.error('[AI] 產生 Top Tracks Review 失敗:', error);
    res.status(500).json({ error: 'Failed to generate review', details: error.message });
  }
});
