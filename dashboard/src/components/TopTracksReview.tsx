import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useSpotifyApi } from '../hooks/useSpotifyApi';
import { parseMarkdownToHtml } from '../utils/markdown';

export default function TopTracksReview() {
  const [loading, setLoading] = useState(false);
  const [review, setReview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { fetchTopTracks } = useSpotifyApi();

  const handleGenerateReview = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const tracks = await fetchTopTracks();
      
      if (!tracks || tracks.length === 0) {
        setError('找不到您最近常聽的歌曲 😢');
        setLoading(false);
        return;
      }

      const res = await fetch('/api/review/top-tracks-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ tracks })
      });

      if (!res.ok) {
        throw new Error('分析失敗，請稍後再試');
      }

      const data = await res.json();
      setReview(data.review);
    } catch (err: any) {
      console.error(err);
      setError(err.message || '發生未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 border-t border-white/10 pt-4">
      <div className="flex items-center justify-between px-2 mb-3">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Sparkles size={14} className="text-purple-400" />
          品味分析
        </h2>
      </div>

      {!review && !loading && (
        <button
          onClick={handleGenerateReview}
          className="w-full relative group overflow-hidden rounded-xl bg-white/5 border border-white/10 p-4 transition-all hover:bg-white/10 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.15)]"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="relative flex flex-col items-center gap-2">
            <Sparkles size={20} className="text-purple-400" />
            <span className="text-sm font-bold text-gray-200">一鍵生成近期聽歌品味分析</span>
            <span className="text-[10px] text-gray-400">Gemini 2.5 專屬生成</span>
          </div>
        </button>
      )}

      {loading && (
        <div className="w-full rounded-xl bg-white/5 border border-white/10 p-6 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-purple-400" size={24} />
          <span className="text-xs text-gray-400 animate-pulse">大腦運算中... 正在品味你的靈魂</span>
        </div>
      )}

      {error && (
        <div className="w-full rounded-xl bg-red-500/10 border border-red-500/20 p-4 text-center">
          <span className="text-xs text-red-400">{error}</span>
          <button onClick={() => setError(null)} className="text-xs text-white/50 hover:text-white block w-full mt-2">重試</button>
        </div>
      )}

      {review && !loading && (
        <div className="w-full rounded-xl bg-gradient-to-br from-purple-900/40 to-blue-900/40 border border-purple-500/30 p-4 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles size={48} />
          </div>
          <div 
            className="prose prose-invert prose-sm max-w-none text-gray-300 relative z-10 
            prose-headings:text-purple-300 prose-headings:font-bold prose-headings:mb-2 
            prose-p:leading-relaxed prose-p:mb-2 prose-strong:text-purple-200"
            dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(review) }}
          />
          <button 
            onClick={() => setReview(null)}
            className="mt-4 w-full text-center text-[10px] text-gray-500 hover:text-gray-300 transition-colors"
          >
            清除分析
          </button>
        </div>
      )}
    </div>
  );
}
