import React from 'react'
import { Disc3 } from 'lucide-react'

// 頂部專輯橫幅元件：展示專輯封面大圖、標題、歌手與發行類型，支援行動端返回按鈕
const HeaderBanner = ({ selectedAlbum, setSelectedAlbum }) => {
  if (!selectedAlbum) return null

  return (
    <div className="min-h-[256px] lg:h-64 p-6 lg:p-8 flex flex-col lg:flex-row items-center lg:items-end gap-6 relative overflow-hidden text-center lg:text-left pt-20 lg:pt-8">
      {/* 手機版返回按鈕 */}
      <button 
        onClick={() => setSelectedAlbum(null)}
        className="absolute top-6 left-6 z-20 lg:hidden bg-black/60 hover:bg-black/80 hover:scale-105 active:scale-95 transition-all px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1 border border-white/10 shadow-lg animate-fade-in"
      >
        ← 返回列表
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
