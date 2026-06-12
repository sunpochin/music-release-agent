/**
 * =====================================================================
 * ✅ verify-readme-commands — 文件與 package.json 的 drift 偵測
 * =====================================================================
 * 「README 的每個 claim 必須對應一個可執行指令」的前提是：
 * README 寫的指令真的存在。本腳本掃描文件中所有 `npm run <script>`
 * 引用，比對 package.json 的 scripts，任何不存在的引用即 exit 1。
 *
 * 背景：README 曾寫 `npm run spotify:capture-cookie` 但實際 script 叫
 * `auth:spotify` — evaluator 照著跑直接失敗。這類 drift 由本腳本在 CI 抓。
 * =====================================================================
 */
import fs from 'fs';
import path from 'path';

const repoRoot = path.resolve('.');
const DOCS_TO_CHECK = [
  'README.md',
  'DEVELOPER.md',
  'DEMO_SCRIPT.md',
  'PM2_DAEMON_GUIDE.md',
  'docs/architecture.md',
  'docs/readiness_and_observability.md'
].filter((f) => fs.existsSync(path.join(repoRoot, f)));

// npm 內建指令（不需要對應 scripts 條目）
const NPM_BUILTINS = new Set(['test', 'start', 'install', 'ci']);

const pkg = JSON.parse(fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf-8'));
const knownScripts = new Set(Object.keys(pkg.scripts ?? {}));

const failures = [];
let totalRefs = 0;

for (const doc of DOCS_TO_CHECK) {
  const content = fs.readFileSync(path.join(repoRoot, doc), 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, idx) => {
    // 匹配 `npm run <name>` 與 `npm <builtin>`（允許 npx 前綴情境略過）
    for (const match of line.matchAll(/npm run ([\w:.-]+)/g)) {
      totalRefs += 1;
      const scriptName = match[1];
      if (!knownScripts.has(scriptName)) {
        failures.push(`${doc}:${idx + 1} 引用了不存在的 script "npm run ${scriptName}"`);
      }
    }
    for (const match of line.matchAll(/npm (test|start)\b/g)) {
      totalRefs += 1;
      if (!NPM_BUILTINS.has(match[1]) && !knownScripts.has(match[1])) {
        failures.push(`${doc}:${idx + 1} 引用了不存在的指令 "npm ${match[1]}"`);
      }
    }
  });
}

console.log(`verify-readme-commands — 掃描 ${DOCS_TO_CHECK.length} 份文件，共 ${totalRefs} 個 npm 指令引用`);

if (failures.length > 0) {
  console.error('\n文件與 package.json 已漂移：');
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error('\n修法：更新文件或補上對應的 package.json script。');
  process.exit(1);
}

console.log('verify-readme-commands passed — 所有文件引用的指令皆存在');
