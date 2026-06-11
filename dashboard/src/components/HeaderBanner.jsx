import React from 'react'
import { Disc3, ExternalLink } from 'lucide-react'

// 頂部專輯橫幅元件：展示專輯封面大圖、標題、歌手與發行類型，支援行動端返回按鈕
// 【小朋友解釋法】：以前手機上只有一顆「直接回大門」的按鈕。
// 但客人在「歌曲房間」時，比較自然的是先回「專輯客廳」再回大門 —
// 所以返回鍵現在是「回上一層」：歌曲頁 → 專輯頁 → 專輯清單，一層一層走。
const HeaderBanner = ({ selectedAlbum, selectedTrack, onBack, backLabel = '返回列表' }) => {
  if (!selectedAlbum) return null

  // 單曲專屬精簡標題列 (Song Mode)
  if (selectedTrack) {
    return (
      <div className="px-6 py-4 lg:px-8 lg:py-6 flex flex-col lg:flex-row lg:items-center gap-4 relative overflow-hidden text-center lg:text-left pt-16 lg:pt-6 bg-white/5 border-b border-white/10">
        {/* 手機版返回按鈕 */}
        <button
          onClick={onBack}
          aria-label={backLabel}
          className="absolute top-4 left-4 z-20 lg:hidden bg-black/60 hover:bg-black/80 hover:scale-105 active:scale-95 transition-all px-3 py-1.5 rounded-full font-bold text-xs flex items-center gap-1 border border-white/10 shadow-lg"
        >
          ← {backLabel}
        </button>

        <div className="z-10 flex items-baseline justify-center lg:justify-start gap-3 flex-wrap w-full mt-2 lg:mt-0">
          {selectedTrack.url ? (
            <a 
              href={selectedTrack.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-2xl lg:text-3xl font-black text-white leading-tight drop-shadow-md hover:text-spotify-green hover:underline decoration-2 underline-offset-4 flex items-center gap-2 transition-colors group"
              title="在 Spotify 上聆聽"
            >
              {selectedTrack.name}
              <ExternalLink size={18} className="opacity-50 group-hover:opacity-100 transition-opacity" />
            </a>
          ) : (
            <h1 className="text-2xl lg:text-3xl font-black text-white leading-tight drop-shadow-md">
              {selectedTrack.name}
            </h1>
          )}
          <p className="text-base lg:text-lg font-bold text-spotify-green">
            {selectedAlbum.artistName}
          </p>
        </div>
      </div>
    )
  }

  // 專輯全尺寸標題列 (Album Mode)
  return (
    <div className="min-h-[256px] lg:h-64 p-6 lg:p-8 flex flex-col lg:flex-row items-center lg:items-end gap-6 relative overflow-hidden text-center lg:text-left pt-20 lg:pt-8">
      {/* 手機版返回按鈕（兩層導航：歌曲 → 專輯 → 清單） */}
      <button
        onClick={onBack}
        aria-label={backLabel}
        className="absolute top-6 left-6 z-20 lg:hidden bg-black/60 hover:bg-black/80 hover:scale-105 active:scale-95 transition-all px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1 border border-white/10 shadow-lg animate-fade-in"
      >
        ← {backLabel}
      </button>

      {/* 背景高斯模糊效果 */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
         <img src={selectedAlbum.image} alt="blur" className="w-full h-full object-cover blur-3xl scale-150" />
      </div>
      <div className="absolute inset-0 bg-gradient-to-t from-spotify-dark via-spotify-dark/60 to-transparent"></div>
      
      <img src={selectedAlbum.image} alt="cover" className="w-36 h-36 lg:w-48 lg:h-48 rounded-xl shadow-2xl z-10 border border-white/10 object-cover" />
      <div className="z-10 pb-2 flex flex-col items-center lg:items-start">
        <p className="text-xs lg:text-sm font-bold uppercase tracking-widest mb-2 flex items-center gap-2">
          <Disc3 size={16} className="text-spotify-green" /> 
          {selectedAlbum.type === 'album' ? 'Album' : 'Single'}
        </p>
        <h1 className="text-3xl lg:text-5xl font-black mb-2 tracking-tight drop-shadow-md">{selectedAlbum.name}</h1>
        <p className="text-lg lg:text-xl font-bold text-spotify-green mb-3 lg:mb-4">{selectedAlbum.artistName || '未知藝人'}</p>
        <p className="text-xs lg:text-sm text-gray-300 font-medium">Released • {selectedAlbum.release_date} • {selectedAlbum.total_tracks}首歌曲</p>
      </div>
    </div>
  )
}

export default HeaderBanner
