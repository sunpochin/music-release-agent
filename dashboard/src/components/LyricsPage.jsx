/**
 * 檔案用途：不依賴專輯或 Spotify 登入的歌詞翻譯工作頁。
 * 所在層：dashboard/src/components；主要關聯：main.jsx、src/routes/lyrics.js、lyrics-handoff.schema.json。
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Check, Copy, FileText, Languages, Search } from 'lucide-react'

const field = 'mt-2 w-full rounded-xl border border-white/15 bg-black/25 px-4 py-3 text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/30 disabled:opacity-60'
const action = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300'

async function request(path, body, signal) {
  const response = await fetch(`/api/lyrics/${path}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || '操作未完成，請重試。')
  return data
}

export default function LyricsPage() {
  useEffect(() => {
    const title = document.title
    const lang = document.documentElement.lang
    // 獨立頁的分頁名稱與朗讀語言也要對應歌詞工作，才不會繼續被誤認為專輯介紹。
    document.title = '歌詞翻譯'
    document.documentElement.lang = 'zh-Hant'
    return () => { document.title = title; document.documentElement.lang = lang }
  }, [])
  const [mode, setMode] = useState('search')
  const [trackName, setTrackName] = useState('')
  const [artistName, setArtistName] = useState('')
  const [results, setResults] = useState(null)
  const [selected, setSelected] = useState(null)
  const [lyrics, setLyrics] = useState('')
  const [sourceLabel, setSourceLabel] = useState('Musixmatch')
  const [sourceUrl, setSourceUrl] = useState('')
  const [credits, setCredits] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const lock = useRef(false)
  const drafts = useRef({})
  const lineCount = lyrics.split(/\r?\n/).filter(line => line.trim()).length

  function invalidate() {
    // 改了歌詞、歌曲或出處就撤銷確認與舊譯文，避免把上一份翻譯當成本次結果。
    setConfirmed(false); setResult(null); setError(''); setNotice('')
  }

  function switchMode(next) {
    if (next === mode) return
    // 切換查歌／貼上時保留本頁草稿，避免一次誤按就弄丟手動整理的原文與署名。
    drafts.current[mode] = { trackName, artistName, lyrics, sourceLabel, sourceUrl, credits, selected, results }
    const draft = drafts.current[next] || {
      trackName, artistName, lyrics: next === 'pasted' ? lyrics : '',
      sourceLabel: selected ? 'LRCLIB' : 'Musixmatch', sourceUrl: selected ? sourceUrl : '', credits,
      selected: null, results: null
    }
    invalidate(); setMode(next); setSelected(draft.selected); setResults(draft.results)
    setTrackName(draft.trackName); setArtistName(draft.artistName); setLyrics(draft.lyrics)
    setSourceLabel(draft.sourceLabel); setSourceUrl(draft.sourceUrl); setCredits(draft.credits)
  }

  async function search(event) {
    event.preventDefault()
    if (lock.current) return
    lock.current = true; setBusy('search'); invalidate(); setSelected(null); setLyrics(''); setResults(null)
    try {
      const data = await request('search', { trackName: trackName.trim(), artistName: artistName.trim() }, AbortSignal.timeout(15000))
      setResults(data.results)
    } catch (err) {
      setError(err.name === 'TimeoutError' ? '搜尋逾時了，請重試或貼上原文。' : err.message)
    } finally { lock.current = false; setBusy('') }
  }

  function choose(track) {
    invalidate(); setSelected(track); setTrackName(track.trackName); setArtistName(track.artistName)
    setLyrics(track.lyrics); setSourceLabel('LRCLIB'); setSourceUrl(track.sourceUrl); setCredits('')
  }

  async function translate(event) {
    event.preventDefault()
    if (lock.current || !confirmed) return
    lock.current = true; setBusy('translate'); setError(''); setNotice(''); setResult(null)
    try {
      const data = await request('translate', {
        trackName: trackName.trim(), artistName: artistName.trim(),
        sourceType: mode === 'search' ? 'lrclib' : 'pasted',
        lyrics, ...(mode === 'search' ? { sourceId: selected.id } : { sourceLabel, sourceUrl }), credits
      }, AbortSignal.timeout(210000))
      if (!Array.isArray(data.lines) || data.lines.length !== data.translations?.length) throw new Error('翻譯缺行，請重試。')
      setResult(data)
    } catch (err) {
      setError(err.name === 'TimeoutError' ? '翻譯等候逾時。原文仍保留，請稍後重試。' : err.message)
    } finally { lock.current = false; setBusy('') }
  }

  async function copy() {
    const text = `${result.trackName}${result.artistName ? ` — ${result.artistName}` : ''}\n\n${result.lines.map((line, i) => `${line}\n${result.translations[i]}`).join('\n\n')}\n\n來源：${result.sourceLabel}${result.source === 'user-pasted' ? '（使用者貼上）' : ''}${result.sourceUrl ? `\n${result.sourceUrl}` : ''}${result.credits ? `\n${result.credits}` : ''}`
    try { await navigator.clipboard.writeText(text); setNotice('已複製對照歌詞與來源註記。') }
    catch { setNotice('無法使用剪貼簿，請直接選取下方文字複製。') }
  }

  const ready = lyrics.trim() && lineCount <= 300 && (mode === 'pasted' || selected)

  return (
    <div className="min-h-screen bg-[#0b1316] text-slate-100 font-sans selection:bg-emerald-300/30">
      <header className="border-b border-white/10 bg-[#0b1316]/95">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link to="/lyrics" className="flex items-center gap-3 text-lg font-bold"><Languages className="text-emerald-300" aria-hidden="true" />歌詞翻譯</Link>
          <Link to="/" className="flex min-h-11 items-center gap-2 text-sm text-slate-400 hover:text-white"><ArrowLeft size={16} aria-hidden="true" />專輯介紹</Link>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-300">LYRICS / 繁體中文</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">聽懂每一句。</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-400">找到歌曲、確認原文，再翻成一句原文、一句中文。不必從專輯裡找，也不用重寫提示詞。</p>

        <div className="mt-10 grid items-start gap-7 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7" aria-labelledby="input-title">
            <h2 id="input-title" className="text-lg font-semibold">1. 準備歌詞</h2>
            <div className="mt-5 flex gap-2 rounded-xl bg-black/30 p-1" role="group" aria-label="歌詞取得方式">
              <button type="button" aria-pressed={mode === 'search'} disabled={!!busy} onClick={() => switchMode('search')} className={`${action} flex-1 px-3 text-sm ${mode === 'search' ? 'bg-white/10 text-white' : 'text-slate-400'}`}><Search size={16} aria-hidden="true" />搜尋歌曲</button>
              <button type="button" aria-pressed={mode === 'pasted'} disabled={!!busy} onClick={() => switchMode('pasted')} className={`${action} flex-1 px-3 text-sm ${mode === 'pasted' ? 'bg-white/10 text-white' : 'text-slate-400'}`}><FileText size={16} aria-hidden="true" />貼上歌詞</button>
            </div>
            <form onSubmit={mode === 'search' ? search : translate} className="mt-6 space-y-5">
              <label className="block text-sm font-medium" htmlFor="track-name">歌名<input id="track-name" className={field} required maxLength={200} disabled={!!busy} value={trackName} placeholder="例如：Deseándote" onChange={e => { invalidate(); setSelected(null); setResults(null); if (mode === 'search') setLyrics(''); setTrackName(e.target.value) }} /></label>
              <label className="block text-sm font-medium" htmlFor="artist-name">歌手 <span className="font-normal text-slate-500">（選填，可避免找到同名歌）</span><input id="artist-name" className={field} maxLength={200} disabled={!!busy} value={artistName} placeholder="輸入歌手名字" onChange={e => { invalidate(); setSelected(null); setResults(null); if (mode === 'search') setLyrics(''); setArtistName(e.target.value) }} /></label>
              {mode === 'search' ? <>
                <button type="submit" disabled={!!busy || !trackName.trim()} className={`${action} w-full bg-emerald-300 text-slate-950 hover:bg-emerald-200`}><Search size={17} aria-hidden="true" />{busy === 'search' ? '正在搜尋…' : '尋找歌詞'}</button>
                <p className="text-xs leading-6 text-slate-500">自動搜尋來源：LRCLIB。Musixmatch 原文請切換「貼上歌詞」，並保留來源與版權註記。</p>
              </> : <>
                <label className="block text-sm font-medium" htmlFor="pasted-lyrics">歌詞原文<textarea id="pasted-lyrics" className={`${field} min-h-64 leading-7`} required maxLength={20000} disabled={!!busy} value={lyrics} placeholder="只貼歌詞原文，每句一行。來源與作詞作曲請填在下方。" onChange={e => { invalidate(); setLyrics(e.target.value) }} /></label>
                <div className="text-xs text-slate-500">{lineCount} / 300 行 · 不略過重複副歌</div>
                <label className="block text-sm font-medium" htmlFor="source-label">來源名稱<input id="source-label" className={field} maxLength={200} disabled={!!busy} value={sourceLabel} placeholder="例如：Musixmatch、自己的歌詞" onChange={e => { invalidate(); setSourceLabel(e.target.value) }} /></label>
                <label className="block text-sm font-medium" htmlFor="source-url">來源連結 <span className="text-slate-500">（選填）</span><input id="source-url" type="url" pattern="https://.*" className={field} maxLength={1000} disabled={!!busy} value={sourceUrl} placeholder="https://…" onChange={e => { invalidate(); setSourceUrl(e.target.value) }} /></label>
              </>}
            </form>

            {results !== null && mode === 'search' && <div className="mt-6 border-t border-white/10 pt-5">
              <h3 className="text-sm font-semibold">選擇正確的歌曲版本</h3>
              {results.length === 0 ? <div className="mt-4 text-sm leading-7 text-slate-400">找不到符合的歌詞。試著補上歌手、移除版本副標，或<button type="button" className="ml-1 text-emerald-300 underline" onClick={() => switchMode('pasted')}>直接貼上原文</button>。</div> : <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">{results.map(track => <li key={track.id}><button type="button" disabled={!!busy} aria-pressed={selected?.id === track.id} onClick={() => choose(track)} className={`w-full rounded-xl border p-4 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300 ${selected?.id === track.id ? 'border-emerald-300/70 bg-emerald-300/10' : 'border-white/10 hover:bg-white/5'}`}><span className="flex items-center justify-between gap-3 font-semibold">{track.trackName}{selected?.id === track.id && <Check size={17} className="shrink-0 text-emerald-300" aria-hidden="true" />}</span><span className="mt-1 block text-sm text-slate-400">{track.artistName} · {track.albumName || '專輯未註明'}</span><span className="mt-2 block text-xs text-slate-500">{Math.floor(track.duration / 60)}:{String(track.duration % 60).padStart(2, '0')} · {track.instrumental ? '演奏曲，沒有歌詞' : track.lyrics ? '有歌詞原文' : '沒有歌詞原文'}</span></button></li>)}</ul>}
            </div>}
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.025] p-5 sm:p-7" aria-labelledby="preview-title">
            <h2 id="preview-title" className="text-lg font-semibold">2. 確認原文，再翻譯</h2>
            {!lyrics.trim() ? <div className="flex min-h-72 flex-col items-center justify-center px-3 text-center"><Languages size={38} className="text-slate-600" aria-hidden="true" /><p className="mt-5 text-slate-400">{selected?.instrumental ? '這是演奏曲，沒有歌詞可翻譯。' : '選一首歌，或貼上你的歌詞。'}</p><p className="mt-2 text-sm leading-6 text-slate-500">找不到原文時，會請你補上；不會讓 AI 猜歌詞。</p>{selected && <button type="button" onClick={() => switchMode('pasted')} className={`${action} mt-5 bg-white/10 text-sm`}>改用貼上歌詞</button>}</div> : <>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{trackName || '未填歌名'}</h3><p className="mt-1 text-sm text-slate-400">{artistName || '歌手未填'} · {lineCount} 行原文</p></div><span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-400">{mode === 'search' ? 'LRCLIB' : `${sourceLabel || '自行提供'} · 使用者貼上`}</span></div>
              <pre className="mt-5 max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-black/25 p-4 font-sans text-sm leading-7 text-slate-300" aria-label="待翻譯原文">{lyrics}</pre>
              <form onSubmit={translate} className="mt-5 space-y-5">
                <label className="block text-sm font-medium" htmlFor="credits">作詞作曲、版權註記 <span className="text-slate-500">（選填，照原樣保留）</span><textarea id="credits" className={`${field} min-h-24 text-sm`} maxLength={2000} disabled={!!busy} value={credits} placeholder={'作詞/作曲：…\n歌詞 © …'} onChange={e => { invalidate(); setCredits(e.target.value) }} /></label>
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-300"><input type="checkbox" checked={confirmed} disabled={!!busy} onChange={e => setConfirmed(e.target.checked)} className="mt-1 h-4 w-4 shrink-0 accent-emerald-300" />我已確認這是我要翻譯的歌曲與原文。</label>
                <button type="submit" disabled={!!busy || !ready || !confirmed || !trackName.trim()} className={`${action} w-full bg-emerald-300 text-slate-950 hover:bg-emerald-200`}><Languages size={18} aria-hidden="true" />{busy === 'translate' ? '正在逐句翻譯，請稍候…' : '產生一句原文、一句中文'}</button>
                <p className="text-xs leading-6 text-slate-500">{lineCount > 300 ? '超過 300 行，請分段翻譯。' : '只在你按下按鈕後翻譯；相同原文會優先讀取已存結果。'}</p>
              </form>
            </>}
          </section>
        </div>
        <div aria-live="polite" aria-atomic="true">{busy && <p className="mt-6 text-sm text-emerald-200" role="status">{busy === 'search' ? '正在查詢歌詞庫…' : '正在翻譯並檢查行數，原文會完整保留。'}</p>}{error && <p className="mt-6 rounded-xl border border-rose-400/30 bg-rose-400/10 p-4 text-sm text-rose-200" role="alert">{error}</p>}{notice && <p className="mt-5 text-sm text-emerald-200" role="status">{notice}</p>}</div>
        {result && <section className="mt-8 rounded-2xl border border-emerald-300/20 bg-white/[0.025] p-5 sm:p-8" aria-labelledby="result-title">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6"><div><p className="text-xs font-semibold tracking-widest text-emerald-300">翻譯完成 · {result.lines.length} 行對照</p><h2 id="result-title" className="mt-2 text-2xl font-semibold">{result.trackName}</h2><p className="mt-2 text-sm text-slate-400">{result.artistName} · {result.cached ? '使用已存翻譯' : `由 ${result.provider === 'gemini' ? 'Gemini' : 'Ollama'} 翻譯`}</p></div><button type="button" onClick={copy} className={`${action} bg-white/10 text-sm hover:bg-white/15`}><Copy size={16} aria-hidden="true" />複製對照與來源</button></div>
          {!result.saved && <p className="mt-5 rounded-xl bg-amber-300/10 p-4 text-sm text-amber-200" role="alert">翻譯已完成，但未能儲存。請先複製結果，避免關閉後遺失。</p>}
          <div className="mt-7 max-w-3xl space-y-6">{result.lines.map((line, i) => <div key={i} className="break-words"><p className="text-base leading-7 text-slate-300">{line}</p><p className="mt-1 text-lg leading-8 text-white">{result.translations[i]}</p></div>)}</div>
          <footer className="mt-8 border-t border-white/10 pt-5 text-sm leading-7 text-slate-400"><p>來源：{result.sourceLabel}{result.source === 'user-pasted' ? '（使用者貼上，未由系統查證）' : ''}</p>{result.sourceUrl && <a href={result.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-emerald-300 underline">查看歌詞來源</a>}{result.credits && <p className="mt-2 whitespace-pre-wrap">{result.credits}</p>}<p className="mt-3 text-xs text-slate-500">AI 譯文供閱讀參考，語意仍可人工核對。</p></footer>
        </section>}
      </main>
    </div>
  )
}
