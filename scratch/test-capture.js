import { chromium } from 'playwright';
import path from 'path';

async function testToken() {
  const userDir = path.resolve('.local', 'spotify-auth-browser');
  const context = await chromium.launchPersistentContext(userDir, {
    headless: true, // test headless
    args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
  });
  
  const page = await context.newPage();
  let accessToken = null;
  
  page.on('request', req => {
    const auth = req.headers()['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      accessToken = auth.split(' ')[1];
    }
  });
  
  await page.goto('https://open.spotify.com/', { waitUntil: 'networkidle' });
  
  const cookies = await context.cookies();
  const spDcCookie = cookies.find(c => c.name === 'sp_dc');
  
  console.log('SP_DC found:', !!spDcCookie);
  console.log('AccessToken found:', !!accessToken);
  
  await context.close();
}
testToken();
