import { chromium } from 'playwright';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const spDc = process.env.SPOTIFY_SP_DC;

async function testToken() {
  const context = await chromium.launchPersistentContext('', {
    headless: true,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  await context.addCookies([
    { name: 'sp_dc', value: spDc, domain: '.spotify.com', path: '/' }
  ]);
  
  const page = await context.newPage();
  
  // Navigate to Spotify to set the origin/referer right
  await page.goto('https://open.spotify.com/', { waitUntil: 'domcontentloaded' });
  
  // Now try fetching the token
  const result = await page.evaluate(async () => {
    const res = await fetch('https://open.spotify.com/get_access_token?reason=transport&productType=web_player');
    const status = res.status;
    const text = await res.text();
    return { status, text };
  });
  
  console.log('Status:', result.status);
  console.log('Response:', result.text);
  
  await context.close();
}
testToken();
