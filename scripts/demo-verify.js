/**
 * =====================================================================
 * ✅ demo:verify — 離線管線驗證腳本（fail-loud 版本）
 * =====================================================================
 * 驗證層次：
 *   1. 輸入資料 schema 驗證（mock-releases.json 壞掉 → 立刻失敗，附欄位明細）
 *   2. dry-run 管線執行（exit code、完成標記、掃描數量）
 *   3. 產物「存在性」驗證（目錄結構、README、SUMMARY、樂評檔案）
 *   4. 產物「內容完整性」驗證（封面圖、樂評標題、評分、聆聽連結）
 *   5. SUMMARY.md 結構驗證（標頭、必要連結、重複連結偵測）
 * 任何一層失敗都會以非零 exit code 結束並印出可診斷的錯誤訊息。
 * =====================================================================
 */
import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';
import {
  releaseSlug,
  validateReleases,
  REVIEW_REQUIRED_MARKERS
} from '../src/dry-run/pipeline-core.js';

const repoRoot = path.resolve('.');
const mockDataPath = path.join(repoRoot, 'data', 'mock-releases.json');
const mockGitbookDir = path.join(repoRoot, 'data', 'mock-gitbook');
const summaryPath = path.join(mockGitbookDir, 'SUMMARY.md');
const newReleasesDir = path.join(mockGitbookDir, 'new-releases');

function runDryScan() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['scan-releases-dry.js'], {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      stdout += text;
      process.stdout.write(text);
    });

    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      stderr += text;
      process.stderr.write(text);
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`scan:dry failed with exit code ${code}`));
    });
  });
}

async function assertPathExists(targetPath, label) {
  try {
    await fs.access(targetPath);
  } catch {
    throw new Error(`missing ${label}: ${targetPath}`);
  }
}

/** 驗證單一樂評檔案內容沒有「悄悄壞掉」：必要區塊缺一不可 */
async function assertReviewWellFormed(release, absolutePath, title) {
  const reviewContent = await fs.readFile(absolutePath, 'utf-8');
  const problems = [];

  for (const marker of REVIEW_REQUIRED_MARKERS) {
    const needle = marker.build(release);
    if (!reviewContent.includes(needle)) {
      problems.push(`缺少${marker.label}（預期包含: "${needle.slice(0, 60)}"）`);
    }
  }

  if (problems.length > 0) {
    throw new Error(`generated review for ${title} is malformed:\n  - ${problems.join('\n  - ')}`);
  }
}

/** 驗證 SUMMARY.md 結構：標頭、固定導覽連結、每個發行連結恰好出現一次 */
function assertSummaryWellFormed(summaryContent, expectedFiles) {
  if (!summaryContent.startsWith('# Table of contents')) {
    throw new Error('SUMMARY.md does not start with "# Table of contents" header');
  }

  for (const requiredLink of ['README.md', 'new-releases/README.md']) {
    if (!summaryContent.includes(`](${requiredLink})`)) {
      throw new Error(`SUMMARY.md is missing required navigation link: ${requiredLink}`);
    }
  }

  for (const expected of expectedFiles) {
    const occurrences = summaryContent.split(`](${expected.relativePath})`).length - 1;
    if (occurrences === 0) {
      throw new Error(`SUMMARY.md is missing link for ${expected.relativePath}`);
    }
    if (occurrences > 1) {
      throw new Error(
        `SUMMARY.md contains duplicate link for ${expected.relativePath} (${occurrences} occurrences) — updateSandboxSummary idempotency is broken`
      );
    }
  }
}

async function main() {
  console.log('== demo:verify ==');
  console.log('Running dry-run pipeline and validating generated artifacts...\n');

  // 第 1 層：輸入資料 schema 驗證（壞資料不該默默通過）
  let releases;
  try {
    releases = validateReleases(JSON.parse(await fs.readFile(mockDataPath, 'utf-8')));
  } catch (error) {
    throw new Error(`input fixture data/mock-releases.json is invalid: ${error.message}`);
  }

  const expectedFiles = releases.map((release) => {
    const fileName = `${releaseSlug(release)}.md`;
    return {
      release,
      title: `${release.primary_artist} - ${release.name}`,
      relativePath: `new-releases/${fileName}`,
      absolutePath: path.join(newReleasesDir, fileName)
    };
  });

  // 第 2 層：dry-run 管線執行
  const { stdout } = await runDryScan();

  if (!stdout.includes('模擬全流程執行完畢')) {
    throw new Error('dry-run output did not include completion marker');
  }

  if (!stdout.includes(`掃描總數: ${releases.length}`)) {
    throw new Error(`dry-run output did not report expected release count ${releases.length}`);
  }

  // 第 3 層：產物存在性
  await assertPathExists(mockGitbookDir, 'mock gitbook directory');
  await assertPathExists(path.join(mockGitbookDir, 'README.md'), 'mock gitbook README');
  await assertPathExists(summaryPath, 'mock SUMMARY');
  await assertPathExists(path.join(newReleasesDir, 'README.md'), 'new-releases README');

  // 第 4 層：每篇樂評的內容完整性
  for (const expected of expectedFiles) {
    await assertPathExists(expected.absolutePath, `generated review for ${expected.title}`);
    await assertReviewWellFormed(expected.release, expected.absolutePath, expected.title);
  }

  // 第 5 層：SUMMARY.md 結構與重複連結偵測
  const summaryContent = await fs.readFile(summaryPath, 'utf-8');
  assertSummaryWellFormed(summaryContent, expectedFiles);

  console.log('\nArtifact checks passed:');
  console.log(`- input fixture passed schema validation (${releases.length} releases)`);
  console.log(`- ${expectedFiles.length} review files exist and contain cover image, title, rating, and listen link`);
  console.log('- SUMMARY.md has valid structure and exactly one link per release (no duplicates)');
  console.log('- mock GitBook sandbox is structurally complete');
  console.log('\ndemo:verify passed');
}

main().catch((error) => {
  console.error(`\ndemo:verify failed: ${error.message}`);
  process.exit(1);
});
