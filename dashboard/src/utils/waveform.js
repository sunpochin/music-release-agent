/**
 * =====================================================================
 * 🌊 Deterministic Waveform — 以歌曲 ID 為種子的確定性音波（純函式）
 * =====================================================================
 * [技術] 刻意「不」使用真實音訊：Spotify 的 30 秒 preview 與
 *        audio-features API 已棄用/不穩定，demo 當天翻車風險高。
 *        改用 seeded PRNG（mulberry32）：同一首歌永遠長出同一條音波，
 *        重新整理不變、離線可測、永遠不會壞。
 * [童趣] 每首歌都有自己的「指紋」（trackId）。我們把指紋丟進
 *        一台確定性的「波浪製造機」：同一個指紋進去，
 *        永遠跑出同一條波浪 — 不用聽歌也能長出這首歌專屬的樣子，
 *        而且這台機器不插網路線，永遠不會故障。
 * =====================================================================
 */

/** 字串 → 32-bit 種子（FNV-1a 簡化版） */
export function hashStringToSeed(text) {
  let hash = 2166136261;
  const str = String(text ?? '');
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32 — 小而確定性的 PRNG */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 由種子字串產生 count 根波形柱的高度（0.15–1.0）。
 * 相鄰柱子做簡單平滑，讓波形看起來像音樂而不是雜訊。
 */
export function generateWaveformBars(seedText, count = 48) {
  const rand = mulberry32(hashStringToSeed(seedText));
  const raw = Array.from({ length: count }, () => rand());

  return raw.map((value, index) => {
    const prev = raw[index - 1] ?? value;
    const next = raw[index + 1] ?? value;
    const smoothed = (prev + value * 2 + next) / 4;
    // 壓進 0.15–1.0：最矮也看得見，最高貼齊容器
    return Math.round((0.15 + smoothed * 0.85) * 1000) / 1000;
  });
}
