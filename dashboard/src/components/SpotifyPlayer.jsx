import React, { useState } from 'react';
import { X } from 'lucide-react';

const SpotifyPlayer = ({ id, type = 'track' }) => {
  const [isMinimized, setIsMinimized] = useState(false);

  if (!id) return null;

  // type can be 'track' or 'album'
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`;

  return (
    <div 
      className={`fixed bottom-6 right-6 z-50 transition-all duration-500 ease-in-out ${
        isMinimized 
          ? 'w-14 h-14 rounded-full bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center cursor-pointer shadow-2xl hover:bg-white/20 hover:scale-105' 
          : 'w-80 h-24 rounded-2xl shadow-2xl'
      }`}
      onClick={() => isMinimized && setIsMinimized(false)}
    >
      {!isMinimized ? (
        <div className="relative w-full h-full group">
          {/* Close / Minimize Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            className="absolute -top-3 -right-3 w-8 h-8 bg-black/60 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center text-gray-300 hover:text-white hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 z-10 shadow-lg"
            title="縮小播放器"
          >
            <X size={14} />
          </button>
          
          <iframe 
            src={embedUrl} 
            width="100%" 
            height="100%" 
            frameBorder="0" 
            allowFullScreen="" 
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" 
            loading="lazy"
            className="rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-white/10 bg-black/40 backdrop-blur-3xl"
          ></iframe>
        </div>
      ) : (
        <svg viewBox="0 0 24 24" className="w-6 h-6 text-spotify-green fill-current" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.84.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.6.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
        </svg>
      )}
    </div>
  );
};

export default SpotifyPlayer;
