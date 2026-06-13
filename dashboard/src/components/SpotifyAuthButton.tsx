import React, { useEffect, useState } from 'react';
import { LogIn, LogOut, User, Loader2 } from 'lucide-react';

interface SpotifyUser {
  display_name: string;
  images?: { url: string }[];
  email?: string;
}

export default function SpotifyAuthButton() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<SpotifyUser | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchSpotifyUserProfile = async (accessToken: string) => {
      try {
        const res = await fetch('https://api.spotify.com/v1/me', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });
        if (res.ok && isMounted) {
          const data = await res.json();
          setUser(data);
        }
      } catch (err) {
        console.error('撈取 Spotify 個人檔案失敗:', err);
      }
    };

    const checkAuth = async () => {
      try {
        setLoading(true);
        const res = await fetch('/api/auth/token');
        if (res.ok && isMounted) {
          const data = await res.json();
          setToken(data.access_token);
          await fetchSpotifyUserProfile(data.access_token);
        } else if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } catch (err) {
        console.error('檢查授權狀態時發生錯誤:', err);
        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    checkAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // 跳轉至後端 Spotify 授權登入 URL
  const handleLogin = () => {
    window.location.href = '/api/auth/login/spotify';
  };

  // 呼叫後端登出端點並清除本地狀態
  const handleLogout = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/logout', {
        method: 'POST',
      });
      if (res.ok) {
        setToken(null);
        setUser(null);
        // 重新整理以重置播放器狀態
        window.location.reload();
      }
    } catch (err) {
      console.error('登出失敗:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-3 bg-white/5 backdrop-blur-md rounded-xl border border-white/5 w-full justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-spotify-green" />
        <span className="text-xs text-gray-400">載入中...</span>
      </div>
    );
  }

  if (token && user) {
    const avatarUrl = user.images?.[0]?.url;
    return (
      <div className="flex flex-col gap-2 p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/5 w-full">
        <div className="flex items-center gap-3">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt="avatar"
              className="w-8 h-8 rounded-full object-cover border border-white/10"
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/10">
              <User size={16} className="text-gray-400" />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <p className="text-[10px] text-gray-400 font-medium">已連結 Spotify</p>
            <p className="text-xs font-semibold text-white truncate">{user.display_name}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center justify-center gap-2 w-full py-1.5 px-3 bg-white/10 hover:bg-white/20 transition-all duration-300 rounded-xl text-xs font-semibold text-gray-200 border border-white/5 hover:border-white/10 mt-1"
        >
          <LogOut size={12} />
          <span>登出</span>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={handleLogin}
      className="flex items-center justify-center gap-2 w-full py-2 px-4 bg-spotify-green hover:bg-spotify-green/90 active:scale-[0.98] text-black font-semibold rounded-2xl transition-all duration-300 shadow-[0_0_15px_rgba(29,185,84,0.15)] hover:shadow-[0_0_20px_rgba(29,185,84,0.35)] text-xs"
    >
      <LogIn size={14} />
      <span>連結 Spotify 帳號</span>
    </button>
  );
}
