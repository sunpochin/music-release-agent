import { getRawLyrics } from '../src/services/lyrics-service.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local', override: true });

async function run() {
  console.log('Token:', process.env.SPOTIFY_ACCESS_TOKEN ? 'yes' : 'no');
  const res = await getRawLyrics({
    artistName: 'Tony Succar',
    trackName: 'Toki no Nagare ni Mi o Makase',
    trackId: '2lAgFL0Vh2UlcOimU8uaLZ',
    forceRefresh: true
  });
  console.log('Result:', res ? (res.lyrics ? res.lyrics.slice(0, 30) : res) : 'null');
}
run();
