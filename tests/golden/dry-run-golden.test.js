/**
 * =====================================================================
 * 🏅 Golden Tests — dry-run 管線的確定性驗收測試
 * =====================================================================
 * 三類情境：
 *   1. 正常（normal）   ：標準 release → 輸出與 golden 檔案逐字相同
 *   2. 模糊（ambiguous）：slug 退化、重音字元、空 genres、中文名稱等邊界輸入
 *   3. 失敗（failure）  ：malformed fixture → 管線必須大聲失敗（非零 exit code + 可診斷訊息）
 * 全部離線、確定性執行，不碰任何外部 API。
 * =====================================================================
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateSlug,
  releaseSlug,
  getMockReview,
  validateReleases
} from '../../src/dry-run/pipeline-core.js';

const execFileAsync = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const fixturesDir = path.join(__dirname, 'fixtures');
const dryRunScript = path.join(repoRoot, 'scan-releases-dry.js');

/** 在暫存目錄執行 dry-run 管線，回傳 { stdout, stderr, code, outputDir } */
async function runDryRunPipeline(dataPath) {
  const outputDir = await fs.mkdtemp(path.join(os.tmpdir(), 'golden-gitbook-'));
  try {
    const { stdout, stderr } = await execFileAsync(process.execPath, [dryRunScript], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DRY_RUN_FAST: '1',
        DRY_RUN_DATA_PATH: dataPath,
        DRY_RUN_OUTPUT_DIR: outputDir
      }
    });
    return { stdout, stderr, code: 0, outputDir };
  } catch (error) {
    return {
      stdout: error.stdout ?? '',
      stderr: error.stderr ?? '',
      code: error.code ?? 1,
      outputDir
    };
  }
}

describe('Golden: 正常情境（normal scenario）', () => {
  let release;
  let goldenReview;

  beforeAll(async () => {
    release = JSON.parse(
      await fs.readFile(path.join(fixturesDir, 'normal-release.json'), 'utf-8')
    );
    goldenReview = await fs.readFile(
      path.join(fixturesDir, 'expected-normal-review.golden.md'),
      'utf-8'
    );
  });

  it('標準 release 的模擬樂評輸出與 golden 檔案逐字相同', () => {
    expect(getMockReview(release)).toBe(goldenReview);
  });

  it('標準 release 的檔名 slug 符合預期規則', () => {
    expect(releaseSlug(release)).toBe('test-artist-golden-hour');
  });

  it('端到端：dry-run 管線在暫存沙箱產出完整且結構正確的 GitBook 產物', async () => {
    const dataPath = path.join(os.tmpdir(), `golden-normal-${Date.now()}.json`);
    await fs.writeFile(dataPath, JSON.stringify([release]), 'utf-8');

    const result = await runDryRunPipeline(dataPath);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain('模擬全流程執行完畢');
    expect(result.stdout).toContain('掃描總數: 1 | 成功處理數: 1');

    const reviewPath = path.join(result.outputDir, 'new-releases', 'test-artist-golden-hour.md');
    const reviewContent = await fs.readFile(reviewPath, 'utf-8');
    expect(reviewContent).toBe(goldenReview);

    const summary = await fs.readFile(path.join(result.outputDir, 'SUMMARY.md'), 'utf-8');
    expect(summary).toContain('](new-releases/test-artist-golden-hour.md)');
    // 結構：必要導覽連結存在
    expect(summary).toContain('](README.md)');
    expect(summary).toContain('](new-releases/README.md)');

    await fs.rm(result.outputDir, { recursive: true, force: true });
    await fs.rm(dataPath, { force: true });
  });

  it('端到端冪等性：重複執行管線不會在 SUMMARY.md 產生重複連結', async () => {
    const dataPath = path.join(os.tmpdir(), `golden-idempotent-${Date.now()}.json`);
    await fs.writeFile(dataPath, JSON.stringify([release]), 'utf-8');

    const first = await runDryRunPipeline(dataPath);
    expect(first.code).toBe(0);

    // 第二次跑在「同一個」輸出目錄
    const { stdout } = await execFileAsync(process.execPath, [dryRunScript], {
      cwd: repoRoot,
      env: {
        ...process.env,
        DRY_RUN_FAST: '1',
        DRY_RUN_DATA_PATH: dataPath,
        DRY_RUN_OUTPUT_DIR: first.outputDir
      }
    });
    expect(stdout).toContain('模擬全流程執行完畢');

    const summary = await fs.readFile(path.join(first.outputDir, 'SUMMARY.md'), 'utf-8');
    const occurrences = summary.split('](new-releases/test-artist-golden-hour.md)').length - 1;
    expect(occurrences).toBe(1);

    await fs.rm(first.outputDir, { recursive: true, force: true });
    await fs.rm(dataPath, { force: true });
  });
});

describe('Golden: 模糊輸入情境（ambiguous scenario）', () => {
  it('名稱全為符號時 slug 退化（"!!!-???" → "-"），releaseSlug 必須退回使用 release id', () => {
    const release = {
      id: 'fallback-id-123',
      primary_artist: '!!!',
      name: '???'
    };
    // 退化情況：只剩孤立連字號，不能拿來當檔名（會變成 '-.md'）
    expect(generateSlug(`${release.primary_artist}-${release.name}`)).toBe('-');
    expect(releaseSlug(release)).toBe('fallback-id-123');
  });

  it('重音拉丁字元會被移除而非造成崩潰（Café Tacvba → caf-tacvba）', () => {
    expect(generateSlug('Café Tacvba')).toBe('caf-tacvba');
  });

  it('中文名稱在 slug 中被保留', () => {
    expect(generateSlug('鄧麗君-月亮代表我的心')).toBe('鄧麗君-月亮代表我的心');
  });

  it('連續空白與特殊符號被正規化為單一連字號', () => {
    expect(generateSlug('La  Malanga   (Salsa Classic)')).toBe('la-malanga-salsa-classic');
  });

  it('artist_genres 為空陣列時，樂評使用後備流派文字而非輸出空字串', () => {
    const release = {
      id: 'no-genre-release-00001',
      name: 'Quiet Album',
      primary_artist: 'Unknown Genre Band',
      type: 'album',
      total_tracks: 3,
      release_date: '2026-06-01',
      url: 'https://open.spotify.com/album/x',
      image: 'https://i.scdn.co/image/x',
      artist_genres: []
    };
    const review = getMockReview(release);
    expect(review).toContain('流派風格定位為：綜合拉丁風格');
    expect(review).not.toContain('流派風格定位為：。');
  });

  it('type 為 single 與 album 時輸出對應的發行類型文字', () => {
    const base = {
      id: 'type-test-000000000001',
      name: 'X',
      primary_artist: 'Y',
      total_tracks: 1,
      release_date: '2026-06-01',
      url: 'https://open.spotify.com/track/x',
      image: 'https://i.scdn.co/image/x',
      artist_genres: ['salsa']
    };
    expect(getMockReview({ ...base, type: 'single' })).toContain('單曲 (Single)');
    expect(getMockReview({ ...base, type: 'album' })).toContain('完整專輯 (Album)');
  });
});

describe('Golden: 失敗情境（failure scenario）', () => {
  it('validateReleases 對非陣列輸入丟出明確錯誤', () => {
    expect(() => validateReleases({ not: 'an array' })).toThrow('必須是 JSON 陣列');
    expect(() => validateReleases(null)).toThrow('必須是 JSON 陣列');
  });

  it('validateReleases 對空陣列丟出明確錯誤', () => {
    expect(() => validateReleases([])).toThrow('陣列為空');
  });

  it('validateReleases 一次回報所有壞欄位，且訊息包含索引與欄位名稱', () => {
    const malformed = [
      {
        id: 'x',
        name: '',
        primary_artist: 'A',
        type: 'mixtape',
        total_tracks: 'ten',
        release_date: 'someday',
        url: 'ftp://nope',
        artist_genres: 'salsa'
      }
    ];
    let message = '';
    try {
      validateReleases(malformed);
    } catch (error) {
      message = error.message;
    }
    expect(message).toContain('releases[0].name');
    expect(message).toContain('releases[0].type');
    expect(message).toContain('releases[0].total_tracks');
    expect(message).toContain('releases[0].release_date');
    expect(message).toContain('releases[0].url');
    expect(message).toContain('releases[0].artist_genres');
  });

  it('端到端：malformed fixture 使管線以非零 exit code 失敗並輸出可診斷訊息', async () => {
    const result = await runDryRunPipeline(path.join(fixturesDir, 'malformed-releases.json'));
    expect(result.code).not.toBe(0);
    const combined = result.stdout + result.stderr;
    expect(combined).toContain('schema 驗證失敗');
    expect(combined).toContain('releases[1]');
    await fs.rm(result.outputDir, { recursive: true, force: true });
  });

  it('端到端：fixture 為無效 JSON 時管線同樣大聲失敗', async () => {
    const dataPath = path.join(os.tmpdir(), `golden-broken-json-${Date.now()}.json`);
    await fs.writeFile(dataPath, '{ this is not valid json', 'utf-8');

    const result = await runDryRunPipeline(dataPath);
    expect(result.code).not.toBe(0);

    await fs.rm(result.outputDir, { recursive: true, force: true });
    await fs.rm(dataPath, { force: true });
  });
});
