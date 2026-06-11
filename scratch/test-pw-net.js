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
  
  let token = null;
  
  page.on('request', req => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.split(' ')[1];
      console.log('Found Authorization header:', token.slice(0, 20) + '...');
    }
  });
  
  page.on('response', async res => {
    if (res.url().includes('token')) {
      console.log('Token response from:', res.url());
      try {
        const text = await res.text();
        console.log('Body:', text.slice(0, 100));
      } catch(e) {}
    }
  });
  
  await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle' });
  
  // Also check session storage or local storage
  const ls = await page.evaluate(() => JSON.stringify(localStorage));
  console.log('LocalStorage keys:', Object.keys(JSON.parse(ls)));
  
  const tokenMatch = ls.match(/"accessToken":"([^"]+)"/);
  if (tokenMatch) {
    console.log('Found accessToken in LocalStorage:', tokenMatch[1].slice(0, 20) + '...');
  }
  
  await context.close();
}
testToken();
