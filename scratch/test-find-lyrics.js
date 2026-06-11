import { chromium } from 'playwright';
import path from 'path';

async function testToken() {
  const userDir = path.resolve('.local', 'spotify-auth-browser');
  const context = await chromium.launchPersistentContext(userDir, {
    headless: false,
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await context.newPage();
  
  page.on('response', async res => {
    if (res.url().includes('color-lyrics/v2/track/')) {
      console.log('Lyrics URL:', res.url());
      console.log('Status:', res.status());
      if (res.status() === 200) {
        try {
           const json = await res.json();
           console.log('Lyrics found:', json.lyrics.lines[0].words);
        } catch(e) {}
      }
    }
  });
  
  await page.goto('https://open.spotify.com/search/lyrics', { waitUntil: 'domcontentloaded' });
  console.log('Please click on a track with lyrics...');
  
  // wait 15 seconds for me to click
  await new Promise(r => setTimeout(r, 15000));
  
  await context.close();
}
testToken();
