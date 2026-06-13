import React, { useState, useEffect } from 'react'
import { Link2, Check } from 'lucide-react'

// 複製目前頁面連結的小按鈕（桌面端分享體驗；行動端已有原生分享）
const CopyLinkButton = () => {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
    } catch {
      // 剪貼簿 API 不可用（非 HTTPS 等）→ 退回選取提示
      window.prompt('複製這個連結分享給朋友：', window.location.href)
    }
  }

  return (
    <button
      onClick={handleCopy}
      aria-label="複製歌曲頁連結"
      className="bg-white/10 hover:bg-white/20 transition-all text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto"
    >
      {copied ? <Check size={16} className="text-spotify-green" /> : <Link2 size={16} />}
      {copied ? '已複製！' : '複製連結'}
    </button>
  )
}

export default CopyLinkButton
