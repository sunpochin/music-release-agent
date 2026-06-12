// @ts-check
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

// 繁體中文註解：定義執行指令並捕獲狀態的輔助函式
async function runCheck(command) {
  try {
    const { stdout, stderr } = await execAsync(command);
    return {
      success: true,
      exitCode: 0,
      stdout: stdout.trim(),
      stderr: stderr.trim()
    };
  } catch (error) {
    return {
      success: false,
      exitCode: error.code || 1,
      stdout: (error.stdout || '').trim(),
      stderr: (error.stderr || '').trim()
    };
  }
}

async function main() {
  console.log('🚀 開始執行全域驗證流程...');

  // 繁體中文註解：分別執行 eslint, tsc, 以及 vitest
  const lintResult = await runCheck('npm run lint');
  console.log(`- ESLint 檢查完畢 (Exit: ${lintResult.exitCode})`);

  const typecheckResult = await runCheck('npm run typecheck');
  console.log(`- TypeScript 檢查完畢 (Exit: ${typecheckResult.exitCode})`);

  const testResult = await runCheck('npm run test');
  console.log(`- 單元測試執行完畢 (Exit: ${testResult.exitCode})`);

  const allPassed = lintResult.success && typecheckResult.success && testResult.success;

  const report = {
    timestamp: new Date().toISOString(),
    success: allPassed,
    checks: {
      lint: {
        success: lintResult.success,
        exitCode: lintResult.exitCode,
        errors: lintResult.success ? [] : [lintResult.stderr || lintResult.stdout]
      },
      typecheck: {
        success: typecheckResult.success,
        exitCode: typecheckResult.exitCode,
        errors: typecheckResult.success ? [] : [typecheckResult.stderr || typecheckResult.stdout]
      },
      test: {
        success: testResult.success,
        exitCode: testResult.exitCode,
        errors: testResult.success ? [] : [testResult.stderr || testResult.stdout]
      }
    }
  };

  const reportPath = path.join(process.cwd(), 'verify-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`🎉 驗證報告已寫入至: ${reportPath}`);

  if (!allPassed) {
    console.error('❌ 部分驗證項目失敗，請查看 verify-report.json。');
    process.exit(1);
  } else {
    console.log('✅ 所有驗證項目皆順利通過！');
  }
}

main().catch((err) => {
  console.error('報告產生失敗:', err);
  process.exit(1);
});
