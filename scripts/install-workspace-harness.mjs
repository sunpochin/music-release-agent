/**
 * 檔案用途：從已版控快照還原非 Git 父工作區的 AI 入口，避免根目錄設定只存本機。
 * 所在層：music-release-agent/scripts；只有明確執行才寫入相鄰工作區。
 * 主要關聯：docs/agents/workspace-harness.json、工作區 AGENTS.md。
 */
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = resolve(process.argv[2] ?? resolve(repo, '..'));
const snapshot = JSON.parse(readFileSync(resolve(repo, 'docs/agents/workspace-harness.json'), 'utf8'));
// 為什麼先檢查所有目的地：中途遇到現有修改才停止，會留下半套規則。
for (const name of snapshot.repositories) {
  if (!existsSync(resolve(workspace, name, '.git'))) throw new Error(`Repository missing: ${name}`);
}
for (const [name, content] of Object.entries(snapshot.files)) {
  const path = resolve(workspace, name);
  if (existsSync(path) && readFileSync(path, 'utf8') !== content) {
    throw new Error(`Existing workspace file differs; review before updating: ${name}`);
  }
}
for (const [name, content] of Object.entries(snapshot.files)) {
  const path = resolve(workspace, name);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
console.log('Workspace harness restored. Run node scripts/check-harness.mjs from the workspace.');
