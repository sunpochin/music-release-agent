import React, { forwardRef } from 'react';

const ShareCard = forwardRef(({ album, lyrics, artistName, introduction }, ref) => {
  if (!album) return null;

  return (
    <div 
      ref={ref}
      className="w-[360px] h-[640px] bg-gradient-to-br from-[#121212] to-[#282828] text-white p-6 flex flex-col justify-between overflow-hidden shadow-2xl relative"
      style={{ fontFamily: 'system-ui, sans-serif' }}
    >
      {/* Background blur decoration */}
      <div className="absolute -top-20 -right-20 w-64 h-64 bg-spotify-green/20 rounded-full blur-[80px]"></div>
      <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-spotify-green/10 rounded-full blur-[80px]"></div>

      {/* Top Header */}
      <div className="z-10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-spotify-green rounded-full flex items-center justify-center font-bold text-black shadow-lg shadow-spotify-green/30">
            M
          </div>
          <span className="text-sm font-bold tracking-wider text-gray-300">MUSIC RELEASE</span>
        </div>
      </div>

      {/* Album Art & Info */}
      <div className="z-10 flex flex-col items-center mt-6">
        <img 
          src={album.image} 
          alt={album.name} 
          crossOrigin="anonymous"
          className="w-48 h-48 rounded-xl shadow-2xl mb-6 object-cover border border-white/10"
        />
        <h2 className="text-2xl font-black text-center mb-1 leading-tight">{album.name}</h2>
        <p className="text-spotify-green font-medium text-lg">{album.artistName || artistName || '未知藝人'}</p>
      </div>

      {/* Lyrics Snippet */}
      <div className="z-10 flex-1 flex flex-col justify-center mt-6">
        <div className="bg-white/5 backdrop-blur-md border border-white/10 p-5 rounded-2xl relative">
          <div className="absolute -top-3 left-4 text-4xl text-spotify-green opacity-50 font-serif">"</div>
          <div className="text-base font-medium text-gray-200 leading-relaxed max-h-[140px] overflow-hidden text-ellipsis line-clamp-5">
            {/* 優先顯示歌詞片段，其次顯示本地 AI 樂評介紹，最後才使用預設文案 */}
            {lyrics ? (
              // 移除 Markdown 格式標籤（如 #, *, _, -）並整理空白以確保圖卡顯示純文字
              lyrics.replace(/[#*_\-]/g, '').replace(/\s+/g, ' ').trim().slice(0, 150) + '...'
            ) : introduction ? (
              introduction
            ) : (
              `這首來自《${album.name}》的動人旋律已正式發行。\n點擊一同感受音符中的溫度與 AI 歌詞深度解析！`
            )}
          </div>
          <div className="absolute -bottom-6 right-4 text-4xl text-spotify-green opacity-50 font-serif">"</div>
        </div>
      </div>

      {/* Footer */}
      <div className="z-10 text-center mt-4 pt-4 border-t border-white/10">
        <p className="text-xs text-gray-400">Powered by Gemini AI ✦</p>
      </div>
    </div>
  );
});

ShareCard.displayName = 'ShareCard';

export default ShareCard;
