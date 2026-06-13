import { ShieldCheck, FlaskConical, AlertTriangle, Music } from 'lucide-react'
import { lyricsSourceMeta, TONE_CLASS } from '../utils/lyricsSource'

const TONE_ICON = {
  verified: ShieldCheck,
  experimental: FlaskConical,
  unverified: AlertTriangle,
  neutral: Music
}

/**
 * 🏷️ LyricsSourceBadge — 把歌詞來源的可信度攤在用戶眼前
 * 誠實的產品不把「這段是 AI 憑記憶生成的」藏起來；llm-recall 用紅色警示。
 */
const LyricsSourceBadge = ({ source, isSynced }) => {
  const meta = lyricsSourceMeta(source)
  if (!meta.show) return null

  const Icon = TONE_ICON[meta.tone] || Music
  return (
    <div
      data-testid="lyrics-source-badge"
      data-tone={meta.tone}
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[11px] font-medium ${TONE_CLASS[meta.tone]}`}
    >
      <Icon size={13} />
      <span>{meta.label}{isSynced ? ' (動態同步)' : ''}</span>
    </div>
  )
}

export default LyricsSourceBadge
