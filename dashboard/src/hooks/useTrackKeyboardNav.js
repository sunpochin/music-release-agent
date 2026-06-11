import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * ⌨️ useTrackKeyboardNav — j/k（或 ↓/↑）在專輯曲目間切換
 *
 * 【小朋友解釋法】：
 * 這是房間裡的「遙控器」：按 j（或 ↓）下一首、按 k（或 ↑）上一首，
 * 手不用離開鍵盤就能逛完整張專輯。
 * 兩條安全守則：
 * 1. 客人正在打字（input/textarea）時遙控器自動失靈，不會打個字就切歌
 * 2. 已經是第一首/最後一首就不動，不會掉出懸崖
 */
export function useTrackKeyboardNav({ selectedAlbum, tracks, selectedTrack }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!selectedAlbum || !Array.isArray(tracks) || tracks.length === 0) return

    const handleKeyDown = (event) => {
      // 打字中不切歌
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.tagName === 'BUTTON' ||
          target.isContentEditable)
      ) {
        return
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return

      let direction = 0
      if (event.key === 'j' || event.key === 'ArrowDown') direction = 1
      if (event.key === 'k' || event.key === 'ArrowUp') direction = -1
      if (direction === 0) return

      const currentIndex = selectedTrack
        ? tracks.findIndex((t) => t.id === selectedTrack.id)
        : -1
      const nextIndex = currentIndex + direction

      // 尚未選歌時按 j 從第一首開始；超出邊界不動
      const boundedIndex = currentIndex === -1 && direction === 1 ? 0 : nextIndex
      if (boundedIndex < 0 || boundedIndex >= tracks.length) return

      event.preventDefault()
      navigate(`/album/${selectedAlbum.id}/song/${tracks[boundedIndex].id}`)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedAlbum, tracks, selectedTrack, navigate])
}
