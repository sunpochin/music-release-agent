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
  
  await page.goto('https://open.spotify.com/', { waitUntil: 'domcontentloaded' });
  
  const html = await page.content();
  console.log('HTML size:', html.length);
  
  // Try to find token in the HTML
  const sessionMatch = html.match(/"accessToken":"([^"]+)"/);
  if (sessionMatch) {
    console.log('Found accessToken in HTML:', sessionMatch[1].slice(0, 20) + '...');
  } else {
    console.log('No accessToken found in HTML');
  }
  
  await context.close();
}
testToken();
