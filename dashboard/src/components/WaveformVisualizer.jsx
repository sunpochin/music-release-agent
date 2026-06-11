import { useMemo } from 'react'
import { generateWaveformBars } from '../utils/waveform'

/**
 * 🌊 WaveformVisualizer — 每首歌專屬的確定性音波（純裝飾，aria-hidden）
 * 同一首歌（trackId）永遠渲染同一條波形；CSS 動畫讓它輕輕呼吸。
 * 確定性由 tests/waveform.test.js 鎖定。
 */
const WaveformVisualizer = ({ seed, barCount = 48 }) => {
  const bars = useMemo(() => generateWaveformBars(seed, barCount), [seed, barCount])
  const width = barCount * 6

  return (
    <div data-testid="waveform" data-seed={seed} aria-hidden="true" className="select-none pointer-events-none">
      <svg
        viewBox={`0 0 ${width} 48`}
        className="w-full h-10 opacity-80"
        preserveAspectRatio="none"
      >
        {bars.map((height, index) => {
          const barHeight = height * 44
          return (
            <rect
              key={index}
              x={index * 6 + 1}
              y={(48 - barHeight) / 2}
              width={4}
              height={barHeight}
              rx={2}
              className="fill-spotify-green/70 waveform-bar"
              style={{ animationDelay: `${(index % 12) * 0.12}s` }}
            />
          )
        })}
      </svg>
    </div>
  )
}

export default WaveformVisualizer
