import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const spDc = process.env.SPOTIFY_SP_DC;

async function testToken() {
  const url = 'https://open.spotify.com/api/token?reason=init&productType=web-player';
  const res = await fetch(url, {
    headers: {
      'Cookie': `sp_dc=${spDc}`,
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
  });
  console.log('Status:', res.status);
  const text = await res.text();
  console.log('Response:', text.slice(0, 200));
}
testToken();
