/**
 * =====================================================================
 * 🛡️ 安全的輕量 Markdown 轉譯器（純函式，無 React 依賴）
 * =====================================================================
 * [技術] 先對整行做 HTML escape，再做格式判斷，確保任何 `<script>`、
 *        `<img onerror>` 等惡意內容都無法以可執行 HTML 的形式輸出。
 *        抽成純模組的原因：讓根目錄的 vitest 可以直接對它做
 *        確定性單元測試（XSS 防護是 README 的明確宣稱，必須有可執行證明）。
 * [童趣] 想像 AI 給我們的內容是一張可能藏有壞人（惡意腳本）的畫。
 *        如果直接貼到牆上（dangerouslySetInnerHTML），壞人就會跑出來做壞事。
 *        所以我們有一道安檢門（escapeHtml）：在最開始就把每一行文字
 *        貼上安全膠帶（轉譯），後續的格式判斷都只針對已轉譯的安全內容，
 *        這樣壞人就絕對無法活過來作怪了！
 * =====================================================================
 */

/** 將 HTML 特殊字元轉義，杜絕 XSS */
export const escapeHtml = (text: string) => text
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;');

/** 將 Markdown 語法安全且語意化地轉譯為具有 Tailwind 樣式的 HTML */
export function parseMarkdownToHtml(markdown: string) {
  if (!markdown) return '';

  const lines = markdown.split('\n');
  return lines.map(line => {
    const escapedLine = escapeHtml(line.trim());

    // 處理副標題 H3 (例如 ### 歌曲意境與背景)
    if (escapedLine.startsWith('###')) {
      return `<h3 class="text-sm font-bold text-spotify-green mt-4 mb-2 flex items-center gap-1">${escapedLine.replace('###', '').trim()}</h3>`;
    }

    // 處理主標題 H2
    if (escapedLine.startsWith('##')) {
      return `<h2 class="text-base font-bold text-white mt-6 mb-3">${escapedLine.replace('##', '').trim()}</h2>`;
    }

    // 處理水平分隔線 ---
    if (escapedLine === '---') {
      return '<hr class="border-white/10 my-4" />';
    }

    // 處理無序清單 -
    if (escapedLine.startsWith('-')) {
      let content = escapedLine.substring(1).trim();
      // 處理粗體 text
      content = content.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
      return `<div class="flex items-start gap-2 my-1 text-xs text-gray-300"><span class="text-spotify-green">•</span><span>${content}</span></div>`;
    }

    // 處理純粗體段落 (通常是精選歌詞或金句)
    if (escapedLine.startsWith('**') && escapedLine.endsWith('**')) {
      return `<p class="text-sm italic font-medium text-spotify-green/90 bg-spotify-green/5 border-l-2 border-spotify-green py-2 px-3 my-3 rounded-r-lg">${escapedLine.replace(/\*\*/g, '')}</p>`;
    }

    // 處理一般段落，支援內建粗體與 LRC 時間碼
    if (escapedLine) {
      let formatted = escapedLine.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white">$1</strong>');
      
      // 處理 LRC 時間碼 [mm:ss.xx]
      formatted = formatted.replace(/\[(\d{2}):(\d{2}(?:\.\d{2,3})?)\]/g, (match, m, s) => {
        const timeMs = Math.floor((parseInt(m, 10) * 60 + parseFloat(s)) * 1000);
        return `<span class="time-badge cursor-pointer inline-flex items-center justify-center px-1.5 py-0.5 mx-1 rounded-md bg-white/10 text-white/50 text-[10px] font-mono hover:bg-spotify-green hover:text-black transition-colors" data-time-ms="${timeMs}">${match}</span>`;
      });
      
      return `<p class="text-xs text-gray-300 leading-relaxed my-2">${formatted}</p>`;
    }
    return '<br/>';
  }).join('\n');
}
