import fetch from 'node-fetch';
async function check() {
  const res = await fetch('https://open.spotify.com/embed/track/2lAgFL0Vh2UlcOimU8uaLZ');
  const text = await res.text();
  const match = text.match(/<title>(.*?)<\/title>/);
  if (match) {
    console.log('Title:', match[1]);
  }
}
check();
