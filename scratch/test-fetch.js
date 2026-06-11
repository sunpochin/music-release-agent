import dotenv from 'dotenv';
import { fetchSpotifyLyrics } from '../src/services/spotify-lyrics.js';
import { fetchLyricsFromSource } from '../src/services/lyrics-source.js';

dotenv.config();

const trackId = '5293jtumKeZzx7u4LRVj4Z';
const artistName = "Carlos D'Castro";
const trackName = "Y Si Te Quedas, ¿Qué?";

async function run() {
  console.log('--- 嘗試從 Spotify 抓取 ---');
  if (process.env.SPOTIFY_SP_DC) {
    const res = await fetchSpotifyLyrics(trackId, process.env.SPOTIFY_SP_DC);
    console.log('Spotify 結果:', res);
  } else {
    console.log('未設定 SPOTIFY_SP_DC');
  }

  console.log('\n--- 嘗試從 LRCLIB 抓取 ---');
  const res2 = await fetchLyricsFromSource(artistName, trackName);
  console.log('LRCLIB 結果:', res2);
}

run();
