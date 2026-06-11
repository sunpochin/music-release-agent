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
  
  await page.goto('https://open.spotify.com/track/3yfqSUWxFvZELEM4PmlwIR', { waitUntil: 'networkidle' });
  
  // Wait a bit to see if lyrics endpoint is called
  const lyricsResponse = await page.evaluate(async (token) => {
    const res = await fetch('https://spclient.wg.spotify.com/color-lyrics/v2/track/3yfqSUWxFvZELEM4PmlwIR', {
       headers: { 'Authorization': `Bearer ${token}`, 'App-Platform': 'WebPlayer' }
    });
    return { status: res.status, text: await res.text() };
  }, accessToken);
  
  console.log('Lyrics Fetch Status (Browser):', lyricsResponse.status);
  console.log('Lyrics Fetch Body (Browser):', lyricsResponse.text.slice(0, 100));
  
  await context.close();
}
testToken();
