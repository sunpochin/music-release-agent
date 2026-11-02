/** 檔案用途：音樂庫導覽；所在層：dashboard/src/components；主要關聯：App.jsx、LyricsPage.jsx。 */
import React from 'react'
import { Link } from 'react-router-dom'
import { Music } from 'lucide-react'
import SpotifyAuthButton from './SpotifyAuthButton'
import TopTracksReview from './TopTracksReview'

// 側邊欄元件：展示關注藝人的最新專輯列表，以及 Spotify 帳號登入/登出狀態
const Sidebar = ({ albums, selectedAlbum, handleSelectAlbum }: any) => {
  return (
    <aside className={`w-full lg:w-80 bg-black/40 backdrop-blur-[40px] flex flex-col border-r border-white/5 z-10 ${selectedAlbum ? 'hidden lg:flex' : 'flex'}`}>
      <div className="p-6 flex flex-col gap-4 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-spotify-green rounded-full flex items-center justify-center shadow-[0_0_15px_rgba(29,185,84,0.4)]">
            <Music className="text-black" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">Music Release</h1>
        </div>
        {/* 翻譯不需要先選專輯，讓使用者從首頁就找得到獨立入口。 */}
        <Link to="/lyrics" className="rounded-xl bg-spotify-green px-4 py-3 text-center font-bold text-black hover:bg-green-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white">歌詞翻譯</Link>
        <SpotifyAuthButton />
        <TopTracksReview />
      </div>

      
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-4 px-2">Latest Releases</h2>
        {albums.length === 0 && <p className="text-sm text-gray-500 px-2">Loading albums...</p>}
        {albums.map((album, idx) => (
          <button 
            key={idx}
            onClick={() => handleSelectAlbum(album)}
            // 根據選中狀態決定按鈕樣式
            className={`w-full text-left p-3 rounded-xl transition-all duration-300 flex gap-4 items-center group ${selectedAlbum?.id === album.id ? 'bg-white/10 shadow-lg' : 'hover:bg-white/5'}`}
          >
            <img src={album.image} alt="cover" className="w-12 h-12 rounded-md object-cover shadow-md group-hover:scale-105 transition-transform" />
            <div className="flex-1 overflow-hidden">
              <h3 className="font-semibold text-sm truncate text-gray-100 group-hover:text-white">{album.name}</h3>
              <p className="text-xs text-gray-400 truncate mt-1">{album.release_date}</p>
            </div>
          </button>
        ))}
      </div>
    </aside>
  )
}

export default Sidebar
