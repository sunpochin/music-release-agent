import React, { useState, useEffect, useRef } from 'react';
import { Plus, ListMusic, Loader2, Check, Music } from 'lucide-react';
import { useSpotifyApi, SpotifyPlaylist } from '../hooks/useSpotifyApi';

interface AddToPlaylistButtonProps {
  trackUri?: string;
}

export default function AddToPlaylistButton({ trackUri }: AddToPlaylistButtonProps) {
  const [open, setOpen] = useState(false);
  const [playlists, setPlaylists] = useState<SpotifyPlaylist[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  
  const { fetchPlaylists, createPlaylist, addTrackToPlaylist } = useSpotifyApi();
  const menuRef = useRef<HTMLDivElement>(null);

  // 點擊外部關閉選單
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  // 開啟時撈取歌單
  useEffect(() => {
    if (open && playlists.length === 0) {
      setLoading(true);
      fetchPlaylists()
        .then(setPlaylists)
        .catch(console.error)
        .finally(() => setLoading(false));
    }
  }, [open, fetchPlaylists, playlists.length]);

  const handleAdd = async (playlistId: string | null) => {
    if (!trackUri) return;
    try {
      setAddingTo(playlistId || 'new');
      let targetId = playlistId;
      
      // 如果沒有傳入 playlistId，代表要建立新歌單
      if (!targetId) {
        const newPlaylist = await createPlaylist('Music Release Agent 推薦');
        targetId = newPlaylist.id;
        setPlaylists([newPlaylist, ...playlists]);
      }
      
      await addTrackToPlaylist(targetId, trackUri);
      
      setAdded(true);
      setTimeout(() => {
        setAdded(false);
        setOpen(false);
      }, 2000);
    } catch (err) {
      console.error('加入歌單失敗', err);
      alert('加入歌單失敗，請稍後再試');
    } finally {
      setAddingTo(null);
    }
  };

  if (!trackUri) return null;

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="bg-white/10 hover:bg-white/20 transition-all text-white px-4 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-lg w-full sm:w-auto border border-white/10"
      >
        {added ? <Check size={16} className="text-spotify-green" /> : <Plus size={16} />}
        {added ? '已加入！' : '收錄至歌單'}
      </button>

      {open && (
        <div className="absolute bottom-full right-0 mb-2 w-64 max-h-80 overflow-y-auto bg-black/90 backdrop-blur-3xl border border-white/10 rounded-2xl p-2 shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
          
          <button
            onClick={() => handleAdd(null)}
            disabled={addingTo !== null}
            className="w-full text-left px-3 py-3 rounded-xl text-sm text-spotify-green hover:bg-spotify-green/10 transition-all flex items-center gap-3 font-semibold border border-spotify-green/20 mb-2"
          >
            {addingTo === 'new' ? <Loader2 size={16} className="animate-spin" /> : <ListMusic size={16} />}
            ✨ 建立新歌單並加入
          </button>
          
          <div className="h-px bg-white/10 my-2 mx-2" />
          
          <div className="px-3 py-1 text-[10px] font-bold tracking-wider text-gray-500 uppercase">
            加入現有歌單
          </div>

          {loading ? (
            <div className="p-4 flex justify-center">
              <Loader2 size={16} className="animate-spin text-gray-400" />
            </div>
          ) : (
            playlists.map((pl) => (
              <button
                key={pl.id}
                onClick={() => handleAdd(pl.id)}
                disabled={addingTo !== null}
                className="w-full text-left px-3 py-2 rounded-xl text-xs text-gray-300 hover:text-white hover:bg-white/10 transition-all flex items-center gap-3"
              >
                {pl.images && pl.images.length > 0 ? (
                  <img src={pl.images[0].url} alt="" className="w-6 h-6 rounded" />
                ) : (
                  <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center">
                    <Music size={12} className="text-gray-500" />
                  </div>
                )}
                <span className="truncate flex-1 font-medium">{pl.name}</span>
                {addingTo === pl.id && <Loader2 size={12} className="animate-spin text-spotify-green" />}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
