import { chromium } from 'playwright';
import fetch from 'node-fetch';
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
  
  let accessToken = null;
  
  page.on('request', req => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      accessToken = auth.split(' ')[1];
    }
  });
  
  console.log('Navigating to Spotify...');
  await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle' });
  await context.close();
  
  if (!accessToken) {
    console.log('Failed to get accessToken');
    return;
  }
  
  console.log('Got accessToken, trying to fetch lyrics in Node.js...');
  const testTrackId = '4PTG3Z6ehGkBFmzsOhPEui';
  const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${testTrackId}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'App-Platform': 'WebPlayer',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  });
  
  console.log('Lyrics Status:', res.status);
  const text = await res.text();
  console.log('Lyrics Response:', text.slice(0, 200));
}
testToken();
