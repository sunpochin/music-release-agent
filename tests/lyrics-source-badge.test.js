/**
 * =====================================================================
 * 🏷️ Lyrics Source Provenance 測試 — 「誠實標示可信度」的可執行證明
 * =====================================================================
 * 核心宣稱：AI 記憶模式（llm-recall）絕不能被偽裝成可信來源。
 * 三類情境：可信來源、實驗性/未驗證來源、未知/空來源的保守處理。
 * =====================================================================
 */
import { describe, it, expect } from 'vitest';
import { lyricsSourceMeta, TONE_CLASS } from '../dashboard/src/utils/lyricsSource.js';

describe('Lyrics source provenance：可信來源（verified）', () => {
  it('lrclib 標示為已驗證、verified tone', () => {
    const meta = lyricsSourceMeta('lrclib');
    expect(meta.verified).toBe(true);
    expect(meta.tone).toBe('verified');
    expect(meta.show).toBe(true);
    expect(meta.label).toContain('LRCLIB');
  });

  it('演奏曲 instrumental 顯示中性徽章', () => {
    const meta = lyricsSourceMeta('lrclib-instrumental');
    expect(meta.tone).toBe('neutral');
    expect(meta.show).toBe(true);
  });
});

describe('Lyrics source provenance：高風險來源必須誠實標示', () => {
  it('llm-recall 絕不可標為 verified，且用 neutral 語氣', () => {
    const meta = lyricsSourceMeta('llm-recall');
    expect(meta.verified).toBe(false);
    expect(meta.tone).toBe('neutral');
    expect(meta.label).toContain('無歌詞原文');
  });

  it('spotify 轉接器標為 experimental，不偽裝成官方', () => {
    const meta = lyricsSourceMeta('spotify');
    expect(meta.verified).toBe(false);
    expect(meta.tone).toBe('experimental');
    expect(meta.label).toContain('實驗性');
    expect(meta.label).not.toContain('官方');
  });

  it('未翻譯的記憶模式同樣保持 neutral', () => {
    expect(lyricsSourceMeta('llm-recall-untranslated').verified).toBe(false);
    expect(lyricsSourceMeta('llm-recall-untranslated').tone).toBe('neutral');
  });

});

describe('Lyrics source provenance：未知/空來源的保守處理（ambiguous）', () => {
  it('空 / undefined / null / none → 不顯示徽章', () => {
    for (const empty of [undefined, null, '', 'none']) {
      expect(lyricsSourceMeta(empty).show).toBe(false);
    }
  });

  it('未知來源一律保守歸為 unverified，不裝沒看到', () => {
    const meta = lyricsSourceMeta('some-future-source');
    expect(meta.verified).toBe(false);
    expect(meta.tone).toBe('unverified');
    expect(meta.show).toBe(true);
  });

  it('每個 tone 都有對應的樣式 class', () => {
    for (const tone of ['verified', 'experimental', 'unverified', 'neutral']) {
      expect(TONE_CLASS[tone]).toBeTruthy();
    }
  });
});
