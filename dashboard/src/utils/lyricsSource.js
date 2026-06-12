/**
 * =====================================================================
 * 🏷️ Lyrics Source Provenance — 歌詞來源徽章的純對映（可離線測試）
 * =====================================================================
 * [技術] 後端為每筆歌詞標記 source（lrclib / spotify / llm-recall …）。
 *        誠實的產品必須把這個「可信度」攤在用戶眼前，而不是只藏在
 *        cache frontmatter。本模組把 source 對映成徽章的文字/語氣/可信度。
 *        抽成純函式 → 由 tests/lyrics-source-badge.test.js 鎖定。
 * [童趣] 每道菜上桌都附一張「產地標籤」：是正版食譜（LRCLIB）、
 *        是廚師憑記憶做的（AI 記憶模式，可能記錯）、還是演奏曲沒有歌詞。
 *        客人一眼就看得出可不可信，廚房不裝神祕。
 * =====================================================================
 */

/**
 * @param {string|undefined} source 後端回傳的歌詞來源標記
 * @returns {{ label: string, tone: 'verified'|'experimental'|'unverified'|'neutral', verified: boolean, show: boolean }}
 */
export function lyricsSourceMeta(source) {
  switch (source) {
    case 'lrclib':
      return { label: '來源：LRCLIB 歌詞庫（真實原文）', tone: 'verified', verified: true, show: true };
    case 'spotify':
      return { label: '來源：Spotify（實驗性）', tone: 'experimental', verified: false, show: false };
    case 'lrclib-instrumental':
      return { label: '演奏曲（無歌詞）', tone: 'neutral', verified: true, show: true };
    case 'llm-recall':
      return { label: '來源：AI 背景分析（無歌詞原文）', tone: 'neutral', verified: false, show: true };
    case 'lrclib-untranslated':
      return { label: '來源：LRCLIB 原文（翻譯服務暫時不可用）', tone: 'verified', verified: true, show: true };
    case 'llm-recall-untranslated':
      return { label: 'AI 背景分析（未翻譯，無歌詞原文）', tone: 'neutral', verified: false, show: true };

    case 'service-down':
      // companion 不可達是基礎設施狀態而非內容可信度問題 → 中性徽章
      return { label: '歌詞服務離線', tone: 'neutral', verified: false, show: true };

    case 'none':
    case undefined:
    case null:
    case '':
      return { label: '', tone: 'neutral', verified: false, show: false };
    default:
      // 未知來源一律保守歸類為未驗證，不裝沒看到
      return { label: `來源：${source}（未驗證）`, tone: 'unverified', verified: false, show: true };
  }
}

/** 徽章語氣 → Tailwind class（集中管理避免散落） */
export const TONE_CLASS = {
  verified: 'bg-spotify-green/15 text-spotify-green border-spotify-green/30',
  experimental: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  unverified: 'bg-red-500/15 text-red-300 border-red-500/30',
  neutral: 'bg-white/10 text-gray-300 border-white/20'
};
