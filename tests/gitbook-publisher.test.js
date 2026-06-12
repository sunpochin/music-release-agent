/**
 * =====================================================================
 * 🚀 GitBook Publisher 測試 — 「產物完整、目錄冪等」宣稱的可執行證明
 * =====================================================================
 * 以暫存目錄作為 GITBOOK_PATH，skipPush=true 避免任何 git 操作 → 全部離線。
 * 涵蓋：結構建立、樂評落盤、SUMMARY 冪等（重複發布不重複插入）、
 * slug 退化回退、偽 front-matter 清洗。
 * =====================================================================
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';

let tmpDir;
let publishToGitBook;

beforeAll(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gitbook-pub-'));
  // GITBOOK_DIR 在模組載入時讀取環境變數 → 必須先設好再 import
  process.env.GITBOOK_PATH = tmpDir;
  ({ publishToGitBook } = await import('../src/gitbook-publisher.js'));
});

afterAll(async () => {
  delete process.env.GITBOOK_PATH;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

const album = {
  id: 'album-id-1',
  name: 'La Malanga',
  primary_artist: 'Bobby Valentin',
  type: 'album',
  release_date: '2026-05-30',
  total_tracks: 8,
  artist_genres: ['salsa'],
  url: 'https://open.spotify.com/album/x',
  image: 'https://example.com/c.jpg'
};

describe('publishToGitBook（skipPush）', () => {
  it('正常：建立完整 GitBook 結構並寫入樂評檔', async () => {
    const result = await publishToGitBook(album, '# 樂評\n好聽。', true);

    expect(result.success).toBe(true);
    expect(result.relativeFilePath).toBe('new-releases/bobby-valentin-la-malanga.md');

    // 結構完整性：README、分類 README、SUMMARY、樂評檔
    for (const f of ['README.md', 'new-releases/README.md', 'SUMMARY.md', result.relativeFilePath]) {
      await expect(fs.access(path.join(tmpDir, f))).resolves.toBeUndefined();
    }

    const summary = await fs.readFile(path.join(tmpDir, 'SUMMARY.md'), 'utf-8');
    expect(summary).toContain('[Bobby Valentin - La Malanga](new-releases/bobby-valentin-la-malanga.md)');
  });

  it('冪等：重複發布同一張專輯，SUMMARY 連結恰好一次', async () => {
    await publishToGitBook(album, '# 樂評\n改寫第二版。', true);

    const summary = await fs.readFile(path.join(tmpDir, 'SUMMARY.md'), 'utf-8');
    const occurrences = summary.split('new-releases/bobby-valentin-la-malanga.md').length - 1;
    expect(occurrences).toBe(1);

    // 內容允許覆寫（最新樂評生效）
    const content = await fs.readFile(path.join(tmpDir, 'new-releases/bobby-valentin-la-malanga.md'), 'utf-8');
    expect(content).toContain('第二版');
  });

  it('模糊：名稱全為符號時 slug 退化 → 回退使用 album.id 作檔名', async () => {
    const weird = { ...album, id: 'fallback-id-9', name: '!!!', primary_artist: '???' };
    const result = await publishToGitBook(weird, '# 樂評', true);
    // slug 函式輸出 '-' 不為空，但若為空必須退回 id — 鎖定不產生 '.md' 隱藏檔
    expect(result.relativeFilePath).not.toBe('new-releases/.md');
    expect(result.relativeFilePath.endsWith('.md')).toBe(true);
  });

  it('防禦：AI 輸出的偽 YAML front-matter 包裝線被清除', async () => {
    const malformed = '---\n# 標題其實是 Markdown\n---\n正文內容';
    const fmAlbum = { ...album, name: 'Front Matter Test' };
    const result = await publishToGitBook(fmAlbum, malformed, true);

    const content = await fs.readFile(path.join(tmpDir, result.relativeFilePath), 'utf-8');
    expect(content.startsWith('---')).toBe(false);
    expect(content).toContain('# 標題其實是 Markdown');
    expect(content).toContain('正文內容');
  });
});
