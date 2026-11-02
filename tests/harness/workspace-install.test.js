/**
 * 檔案用途：驗證父工作區還原不覆寫現有檔案，且預檢失敗不留下半套設定。
 * 所在層：tests/harness；只用暫存資料夾與假 Git 入口。
 * 主要關聯：scripts/install-workspace-harness.mjs、docs/agents/workspace-harness.json。
 */
import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const installer = fileURLToPath(new URL('../../scripts/install-workspace-harness.mjs', import.meta.url));
const snapshot = JSON.parse(readFileSync(new URL('../../docs/agents/workspace-harness.json', import.meta.url), 'utf8'));
function fixture(run) {
  const cwd = mkdtempSync(join(tmpdir(), 'workspace-harness-'));
  try {
    for (const name of snapshot.repositories) mkdirSync(join(cwd, name, '.git'), { recursive: true });
    run(cwd, () => execFileSync(process.execPath, [installer, cwd], { stdio: 'pipe' }));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
}
it('restores the versioned workspace and permits an identical second run', () => {
  fixture((cwd, install) => {
    install();
    install();
    for (const [name, content] of Object.entries(snapshot.files)) {
      expect(readFileSync(join(cwd, name), 'utf8')).toBe(content);
    }
  });
});
it('preflights every destination before writing and preserves different existing content', () => {
  fixture((cwd, install) => {
    writeFileSync(join(cwd, 'TECHNICAL.md'), 'local work');
    expect(install).toThrow();
    expect(readFileSync(join(cwd, 'TECHNICAL.md'), 'utf8')).toBe('local work');
    expect(existsSync(join(cwd, 'AGENTS.md'))).toBe(false);
  });
});
