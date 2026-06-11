import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';

// 取得當前檔案路徑與根目錄
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const envPath = path.join(rootDir, '.env.local');
const userDir = path.join(rootDir, '.local', 'spotify-auth-browser');

async function main() {
  console.log('==================================================');
  console.log('🎵 Spotify Web Lyrics Adapter (Experimental Local-Only Helper)');
  console.log('==================================================');
  console.log('⚠️ 安全與合規提示 (Security & Compliance Notice)：');
  console.log('1. sp_dc 是您的個人登入憑證，等同於密碼，請勿洩漏或上傳至 GitHub。');
  console.log('2. 本整合非官方 API，僅限本地測試使用，使用者需自負帳號限制或封鎖之風險。');
  console.log('3. 本工具使用獨立沙盒瀏覽器，絕不讀取或儲存您的密碼。');
  console.log('==================================================\n');

  console.log('正在啟動安全沙盒瀏覽器視窗...');

  let context;
  try {
    // 啟動獨立持久化 Chrome 實例 (沙盒隔離)
    context = await chromium.launchPersistentContext(userDir, {
      headless: false,
      viewport: { width: 1200, height: 800 },
      args: ['--no-sandbox']
    });

    const page = await context.newPage();
    
    // 導向 Spotify 首頁
    console.log('正在導向至 Spotify Web Player...');
    await page.goto('https://open.spotify.com/');

    console.log('\n👉 請在瀏覽器視窗中手動登入您的 Spotify 帳號。');
    console.log('⏱️ 系統將持續監測登入狀態（超時時間：5分鐘）...\n');

    let spDcValue = null;
    const maxAttempts = 150; // 最多等待 300 秒 (150 * 2 秒)
    
    for (let i = 0; i < maxAttempts; i++) {
      // 取得瀏覽器所有 Cookies
      const cookies = await context.cookies();
      const spDcCookie = cookies.find(c => c.name === 'sp_dc');
      
      if (spDcCookie) {
        spDcValue = spDcCookie.value;
        break;
      }
      
      // 每 2 秒檢查一次
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (spDcValue) {
      // 遮罩 Cookie 以保護隱私
      const maskedCookie = spDcValue.slice(0, 6) + '...' + spDcValue.slice(-4);
      console.log(`🎉 成功獲取 sp_dc 憑證: [${maskedCookie}]`);

      // 載入或建立 .env.local 內容
      let envContent = '';
      if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
      } else {
        const examplePath = path.join(rootDir, '.env.example');
        if (fs.existsSync(examplePath)) {
          envContent = fs.readFileSync(examplePath, 'utf8');
        }
      }

      const key = 'SPOTIFY_SP_DC';
      const newline = `${key}=${spDcValue}`;

      // 使用正則表達式更新或新增憑證
      if (envContent.match(new RegExp(`^${key}\\s*=`, 'm'))) {
        envContent = envContent.replace(new RegExp(`^${key}\\s*=.*$`, 'm'), newline);
      } else {
        envContent = envContent.trim() + `\n\n# Spotify Premium 憑證 (由轉接器自動獲取)\n${newline}\n`;
      }

      fs.writeFileSync(envPath, envContent, 'utf8');
      console.log('✅ 已成功將憑證寫入至根目錄的 .env.local 檔案中！');
    } else {
      console.log('❌ 逾時未完成登入，或未能在瀏覽器中獲取到 sp_dc 憑證。');
    }
  } catch (error) {
    console.error('❌ 執行過程中發生錯誤:', error.message);
  } finally {
    if (context) {
      console.log('正在關閉瀏覽器...');
      await context.close();
    }
    console.log('執行結束。');
  }
}

main().catch(err => {
  console.error('全域錯誤:', err);
  process.exit(1);
});
