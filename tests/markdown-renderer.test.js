/**
 * =====================================================================
 * 🛡️ Markdown 轉譯器測試 — README「杜絕 XSS」宣稱的可執行證明
 * =====================================================================
 * README 宣稱：「先對特殊 HTML 字元進行轉義（Escape），杜絕 XSS 腳本注入」。
 * 本檔案以三類情境鎖定該宣稱：
 *   1. 惡意輸入（XSS payload 必須以純文字輸出，不得出現可執行標籤）
 *   2. 正常輸入（標題、清單、粗體、分隔線轉譯正確）
 *   3. 模糊輸入（空值、純空白、混合語法不崩潰、輸出仍安全）
 * =====================================================================
 */
import { describe, it, expect } from 'vitest';
import { parseMarkdownToHtml, escapeHtml } from '../dashboard/src/utils/markdown.js';

describe('Markdown 轉譯器：XSS 防護（failure/malicious scenario）', () => {
  it('script 標籤被轉義為純文字，不得輸出可執行的 <script>', () => {
    const html = parseMarkdownToHtml('<script>alert("xss")</script>');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('img onerror 注入被轉義，不得輸出 <img 標籤', () => {
    const html = parseMarkdownToHtml('<img src=x onerror=alert(1)>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('藏在 Markdown 標題內的注入同樣被轉義', () => {
    const html = parseMarkdownToHtml('## Hello <svg onload=alert(1)>');
    expect(html).toContain('<h2');
    expect(html).not.toContain('<svg');
    expect(html).toContain('&lt;svg onload=alert(1)&gt;');
  });

  it('藏在清單與粗體內的注入同樣被轉義', () => {
    const html = parseMarkdownToHtml('- **<iframe src=evil>** item');
    expect(html).not.toContain('<iframe');
    expect(html).toContain('&lt;iframe src=evil&gt;');
  });

  it('& 字元被正確轉義，避免二次解碼繞過', () => {
    expect(escapeHtml('&lt;script&gt;')).toBe('&amp;lt;script&amp;gt;');
  });

  it('輸出中唯一的 HTML 標籤是轉譯器自己產生的白名單標籤', () => {
    const payload = '## T\n- a\n**q**\ntext <b onclick=x>bad</b>\n---';
    const html = parseMarkdownToHtml(payload);
    const tags = [...html.matchAll(/<\/?([a-z0-9]+)[\s>/]/gi)].map((m) => m[1].toLowerCase());
    const whitelist = new Set(['h2', 'h3', 'hr', 'div', 'span', 'p', 'strong', 'br']);
    for (const tag of tags) {
      expect(whitelist.has(tag), `unexpected tag <${tag}> in output`).toBe(true);
    }
  });
});

describe('Markdown 轉譯器：正常情境（normal scenario）', () => {
  it('H2 / H3 標題轉譯為對應層級元素', () => {
    expect(parseMarkdownToHtml('## 主標題')).toContain('<h2');
    expect(parseMarkdownToHtml('### 副標題')).toContain('<h3');
  });

  it('無序清單轉譯為帶項目符號的區塊，且支援內嵌粗體', () => {
    const html = parseMarkdownToHtml('- **重點** 說明');
    expect(html).toContain('•');
    expect(html).toContain('<strong class="text-white">重點</strong>');
  });

  it('純粗體段落轉譯為金句樣式段落', () => {
    const html = parseMarkdownToHtml('**精選歌詞**');
    expect(html).toContain('italic');
    expect(html).toContain('精選歌詞');
    expect(html).not.toContain('**');
  });

  it('水平分隔線轉譯為 <hr>', () => {
    expect(parseMarkdownToHtml('---')).toContain('<hr');
  });

  it('一般段落支援行內粗體', () => {
    const html = parseMarkdownToHtml('這是**重要**的一句話');
    expect(html).toContain('<p');
    expect(html).toContain('<strong class="text-white">重要</strong>');
  });
});

describe('Markdown 轉譯器：模糊輸入情境（ambiguous scenario）', () => {
  it('空字串與 null/undefined 回傳空字串而非崩潰', () => {
    expect(parseMarkdownToHtml('')).toBe('');
    expect(parseMarkdownToHtml(null)).toBe('');
    expect(parseMarkdownToHtml(undefined)).toBe('');
  });

  it('純空白行輸出 <br/>', () => {
    expect(parseMarkdownToHtml('   ')).toBe('<br/>');
  });

  it('未閉合的粗體標記不崩潰、原樣保留為文字', () => {
    const html = parseMarkdownToHtml('這是**沒有閉合的粗體');
    expect(html).toContain('<p');
    expect(html).toContain('**沒有閉合的粗體');
  });

  it('多行混合文件轉譯後行數一致（逐行轉譯不丟行）', () => {
    const input = '## A\n\n- b\n---\ntext';
    const html = parseMarkdownToHtml(input);
    expect(html.split('\n')).toHaveLength(5);
  });
});
