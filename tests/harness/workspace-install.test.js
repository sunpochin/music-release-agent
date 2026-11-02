/**
 * 檔案用途：驗證父工作區還原不覆寫現有檔案，且預檢失敗不留下半套設定。
 * 所在層：tests/harness；只用暫存資料夾與假 Git 入口。
 * 主要關聯：scripts/install-workspace-harness.mjs、docs/agents/workspace-harness.json。
 */
import { it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, symlinkSync, statSync } from 'node:fs';
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
    const before = statSync(join(cwd, 'AGENTS.md')).mtimeMs;
    install();
    expect(statSync(join(cwd, 'AGENTS.md')).mtimeMs).toBe(before);
    for (const [name, content] of Object.entries(snapshot.files)) {
      expect(readFileSync(join(cwd, name), 'utf8')).toBe(content);
    }
  });
});
it('rejects a parent file or parent symlink before creating any root files', () => {
  for (const symlink of [false, true]) fixture((cwd, install) => {
    if (symlink) symlinkSync(join(cwd, 'missing-directory'), join(cwd, 'scripts'));
    else writeFileSync(join(cwd, 'scripts'), 'local work');
    expect(install).toThrow();
    expect(existsSync(join(cwd, 'AGENTS.md'))).toBe(false);
  });
});
it('rejects a dangling destination symlink without creating its outside target', () => {
  fixture((cwd, install) => {
    const outside = join(cwd, 'outside-file');
    symlinkSync(outside, join(cwd, 'TECHNICAL.md'));
    expect(install).toThrow();
    expect(existsSync(outside)).toBe(false);
    expect(existsSync(join(cwd, 'AGENTS.md'))).toBe(false);
  });
});
it('preserves a file created between preflight and the exclusive write', () => {
  fixture((cwd) => {
    // 為什麼攔截實際寫入：穩定重現另一個程序在預檢後搶先建立檔案的時序。
    const preload = join(cwd, 'race.cjs');
    writeFileSync(preload, `const fs = require('node:fs');
const original = fs.writeFileSync;
fs.writeFileSync = function(path, ...args) {
  if (path.endsWith('/AGENTS.md')) original(path, 'concurrent edit');
  return original(path, ...args);
};
require('node:module').syncBuiltinESMExports();`);
    expect(() => execFileSync(process.execPath, ['--require', preload, installer, cwd], { stdio: 'pipe' })).toThrow();
    expect(readFileSync(join(cwd, 'AGENTS.md'), 'utf8')).toBe('concurrent edit');
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
