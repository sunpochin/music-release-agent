/**
 * =====================================================================
 * 🌊 Waveform 測試 — 「確定性視覺化」宣稱的可執行證明
 * =====================================================================
 * 核心宣稱：同一首歌（trackId）永遠長出同一條音波。
 * 不依賴任何外部 API — 這是刻意的設計取捨（preview/audio-features 已棄用）。
 * =====================================================================
 */
import { describe, it, expect } from 'vitest';
import {
  hashStringToSeed,
  mulberry32,
  generateWaveformBars
} from '../dashboard/src/utils/waveform.js';

describe('Waveform：確定性（normal scenario）', () => {
  it('同一個 seed 永遠產生完全相同的波形', () => {
    const first = generateWaveformBars('track-abc-123');
    const second = generateWaveformBars('track-abc-123');
    expect(first).toEqual(second);
  });

  it('不同的 seed 產生不同的波形（每首歌有自己的指紋）', () => {
    const a = generateWaveformBars('track-a');
    const b = generateWaveformBars('track-b');
    expect(a).not.toEqual(b);
  });

  it('預設產生 48 根柱子，可自訂數量', () => {
    expect(generateWaveformBars('x')).toHaveLength(48);
    expect(generateWaveformBars('x', 16)).toHaveLength(16);
  });

  it('所有高度都落在 0.15–1.0（最矮也看得見，最高不爆框）', () => {
    for (const height of generateWaveformBars('any-track', 200)) {
      expect(height).toBeGreaterThanOrEqual(0.15);
      expect(height).toBeLessThanOrEqual(1.0);
    }
  });
});

describe('Waveform：模糊輸入（ambiguous scenario）', () => {
  it('空字串與 null seed 不崩潰且各自確定性', () => {
    expect(generateWaveformBars('')).toEqual(generateWaveformBars(''));
    expect(generateWaveformBars(null)).toEqual(generateWaveformBars(null));
  });

  it('中文與特殊字元 seed 正常運作', () => {
    const bars = generateWaveformBars('鄧麗君-月亮代表我的心!@#$');
    expect(bars).toHaveLength(48);
    expect(bars).toEqual(generateWaveformBars('鄧麗君-月亮代表我的心!@#$'));
  });

  it('hashStringToSeed 對相同輸入回傳相同 32-bit 無號整數', () => {
    const seed = hashStringToSeed('hello');
    expect(seed).toBe(hashStringToSeed('hello'));
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xFFFFFFFF);
  });

  it('mulberry32 序列確定性且值域在 [0,1)', () => {
    const randA = mulberry32(42);
    const randB = mulberry32(42);
    for (let i = 0; i < 10; i++) {
      const value = randA();
      expect(value).toBe(randB());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});
