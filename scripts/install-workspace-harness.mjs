/**
 * 檔案用途：從已版控快照還原非 Git 父工作區的 AI 入口，避免根目錄設定只存本機。
 * 所在層：music-release-agent/scripts；只有明確執行才寫入相鄰工作區。
 * 主要關聯：docs/agents/workspace-harness.json、工作區 AGENTS.md。
 */
import { existsSync, lstatSync, readFileSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { dirname, resolve, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workspace = realpathSync(resolve(process.argv[2] ?? resolve(repo, '..')));
const snapshot = JSON.parse(readFileSync(resolve(repo, 'docs/agents/workspace-harness.json'), 'utf8'));
// 為什麼先檢查所有目的地：中途遇到現有修改才停止，會留下半套規則。
for (const name of snapshot.repositories) {
  if (!existsSync(resolve(workspace, name, '.git'))) throw new Error(`Repository missing: ${name}`);
}
const pending = [];
function inspect(path) {
  try { return lstatSync(path); }
  catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}
for (const [name, content] of Object.entries(snapshot.files)) {
  const path = resolve(workspace, name);
  const local = relative(workspace, path);
  if (local.startsWith('..') || path === workspace) throw new Error(`Invalid workspace path: ${name}`);
  const parents = local.split(sep).slice(0, -1);
  let parent = workspace;
  // 為什麼連父路徑也檢查：scripts 若是檔案或 symlink，不能寫完根目錄才發現衝突。
  for (const part of parents) {
    parent = resolve(parent, part);
    const info = inspect(parent);
    if (info && (info.isSymbolicLink() || !info.isDirectory())) throw new Error(`Invalid parent: ${name}`);
  }
  const info = inspect(path);
  if (info && (info.isSymbolicLink() || !info.isFile())) throw new Error(`Invalid destination: ${name}`);
  if (info && readFileSync(path, 'utf8') !== content) throw new Error(`Existing workspace file differs: ${name}`);
  if (!info) pending.push([path, content]);
}
for (const [path] of pending) mkdirSync(dirname(path), { recursive: true });
for (const [path, content] of pending) {
  // 為什麼用 wx：預檢後若有人新增檔案或 symlink 就失敗，不覆寫；相同既有檔完全不寫。
  writeFileSync(path, content, { flag: 'wx' });
}
console.log('Workspace harness restored. Run node scripts/check-harness.mjs from the workspace.');
