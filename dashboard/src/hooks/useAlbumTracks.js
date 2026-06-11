import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * 🎼 useAlbumTracks — 專輯曲目清單的載入 hook（三態：loading / error / data）
 *
 * 【小朋友解釋法】：
 * 這是「歌單送貨員」的工作守則，從 App.jsx 大客廳搬進自己的小辦公室：
 * 1. 防舊貨蓋新貨：快速換專輯時，舊的送貨員可能比較慢才把歌單送來。
 *    每次換專輯就把上一張的「有效標記」(active) 設成失效，
 *    舊歌單就算送到也直接丟掉。
 * 2. 防重複叫貨：同一張專輯只是切換單曲路由（/album/1 → /album/1/song/2）時，
 *    不需要重新叫歌單（prevAlbumIdRef 記住上一次的專輯編號）。
 * 3. 送貨失敗要說出來：以前送貨失敗只在倉庫小聲嘀咕（console.error），
 *    客人看到的是「無曲目資料」，以為專輯是空的。
 *    現在失敗會大聲告訴畫面（tracksError），還附「再試一次」的門鈴（retryTracks）。
 */
export function useAlbumTracks(selectedAlbum) {
  const [tracks, setTracks] = useState([])
  const [tracksLoading, setTracksLoading] = useState(false)
  const [tracksError, setTracksError] = useState(null)
  const prevAlbumIdRef = useRef(null)
  const [reloadKey, setReloadKey] = useState(0)

  // 「再試一次」門鈴：清掉防重複標記，讓 effect 重新叫貨
  const retryTracks = useCallback(() => {
    prevAlbumIdRef.current = null
    setReloadKey((key) => key + 1)
  }, [])

  useEffect(() => {
    let active = true
    let settled = false

    if (selectedAlbum) {
      // 同一張專輯只是切換單曲路由時，不重新獲取歌單
      if (prevAlbumIdRef.current === selectedAlbum.id) {
        return
      }
      prevAlbumIdRef.current = selectedAlbum.id

      setTracks([])
      setTracksError(null)
      setTracksLoading(true)

      fetch(`/api/albums/${selectedAlbum.id}/tracks`)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          return res.json()
        })
        .then((data) => {
          if (!active) return
          setTracks(Array.isArray(data) ? data : [])
        })
        .catch((err) => {
          if (active) {
            console.error('Failed to fetch album tracks', err)
            setTracksError(err.message || '載入曲目失敗')
          }
        })
        .finally(() => {
          settled = true
          if (active) setTracksLoading(false)
        })
    } else {
      prevAlbumIdRef.current = null
      setTracks([])
      setTracksError(null)
    }

    return () => {
      active = false
      // 【關鍵防卡死】這輪叫貨在「貨送到之前」就被取消（StrictMode 雙重 effect、
      // selectedAlbum 物件 identity 變化等），結果會被 active 守門員丟棄 —
      // 此時必須撤銷防重複標記，否則下一輪 effect 會以為「已經叫過貨」而
      // 直接 early-return，畫面就永遠卡在「讀取歌曲中...」。
      // （這是從原版 App.jsx 繼承的潛在 race，由 deep-link e2e 測試曝光）
      if (!settled) {
        prevAlbumIdRef.current = null
      }
    }
  }, [selectedAlbum, reloadKey])

  return { tracks, tracksLoading, tracksError, retryTracks }
}
