import fs from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

const repoRoot = path.resolve('.');
const mockDataPath = path.join(repoRoot, 'data', 'mock-releases.json');
const mockGitbookDir = path.join(repoRoot, 'data', 'mock-gitbook');
const summaryPath = path.join(mockGitbookDir, 'SUMMARY.md');
const newReleasesDir = path.join(mockGitbookDir, 'new-releases');

function generateSlug(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u4e00-\u9fa5]+/g, '')
    .replace(/\-\-+/g, '-');
}

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

async function main() {
  console.log('== demo:verify ==');
  console.log('Running dry-run pipeline and validating generated artifacts...\n');

  const releases = JSON.parse(await fs.readFile(mockDataPath, 'utf-8'));
  const expectedFiles = releases.map((release) => {
    const fileName = `${generateSlug(`${release.primary_artist}-${release.name}`) || release.id}.md`;
    return {
      title: `${release.primary_artist} - ${release.name}`,
      relativePath: `new-releases/${fileName}`,
      absolutePath: path.join(newReleasesDir, fileName)
    };
  });

  const { stdout } = await runDryScan();

  if (!stdout.includes('模擬全流程執行完畢')) {
    throw new Error('dry-run output did not include completion marker');
  }

  if (!stdout.includes(`掃描總數: ${releases.length}`)) {
    throw new Error(`dry-run output did not report expected release count ${releases.length}`);
  }

  await assertPathExists(mockGitbookDir, 'mock gitbook directory');
  await assertPathExists(path.join(mockGitbookDir, 'README.md'), 'mock gitbook README');
  await assertPathExists(summaryPath, 'mock SUMMARY');
  await assertPathExists(path.join(newReleasesDir, 'README.md'), 'new-releases README');

  const summaryContent = await fs.readFile(summaryPath, 'utf-8');

  for (const expected of expectedFiles) {
    await assertPathExists(expected.absolutePath, `generated review for ${expected.title}`);

    const reviewContent = await fs.readFile(expected.absolutePath, 'utf-8');
    if (!reviewContent.includes(expected.title.split(' - ')[1])) {
      throw new Error(`generated review is missing album name for ${expected.title}`);
    }

    if (!summaryContent.includes(expected.relativePath)) {
      throw new Error(`SUMMARY.md is missing link for ${expected.relativePath}`);
    }
  }

  console.log('\nArtifact checks passed:');
  console.log(`- ${expectedFiles.length} review files exist`);
  console.log('- SUMMARY.md contains the expected release links');
  console.log('- mock GitBook sandbox is structurally complete');
  console.log('\ndemo:verify passed');
}

main().catch((error) => {
  console.error(`\ndemo:verify failed: ${error.message}`);
  process.exit(1);
});
