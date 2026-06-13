import { Info, Calendar, Layers, ExternalLink, Music4, Loader2, AlertCircle, RotateCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

// 格式化歌曲長度（毫秒轉為分:秒）
const formatDuration = (ms) => {
  if (!ms) return '0:00';
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

/**
 * 💿 AlbumPanel — 專輯資訊面板（發行屬性、AI 介紹、曲目清單、Spotify 連結）
 *
 * 【小朋友解釋法】：
 * 這是「專輯的名片」。點左邊選單選一張專輯，右邊就換上這張名片。
 * 兩種擺法：
 * - variant="full"（專輯頁）：名片置中、放大、曲目清單完整展開
 * - variant="compact"（歌曲頁桌機）：名片縮成側欄，把舞台讓給歌詞
 */
const AlbumPanel = ({
  selectedAlbum,
  albumReview,
  tracks = [],
  selectedTrack,
  tracksLoading,
  tracksError,
  retryTracks,
  variant = 'compact'
}) => {
  const navigate = useNavigate()
  if (!selectedAlbum) return null

  const isFull = variant === 'full'

  return (
    <div className={`w-full ${isFull ? 'max-w-2xl mx-auto' : 'lg:w-1/3'} bg-black/20 border border-white/5 rounded-[32px] p-8 backdrop-blur-[60px] shadow-2xl shadow-black/50 flex flex-col justify-between`}>
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2 text-white/90 mb-8">
          <Info size={20} /> 專輯資訊
        </h2>

        <div className="space-y-4 text-sm text-gray-300">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex items-center gap-3 bg-black/20 p-4 rounded-2xl">
              <Calendar size={18} className="text-spotify-green shrink-0" />
              <div>
                <p className="text-xs text-gray-400">發行日期</p>
                <p className="font-semibold">{selectedAlbum.release_date}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-black/20 p-4 rounded-2xl">
              <Layers size={18} className="text-spotify-green shrink-0" />
              <div>
                <p className="text-xs text-gray-400">曲目總數</p>
                <p className="font-semibold">{selectedAlbum.total_tracks} 首歌曲</p>
              </div>
            </div>
          </div>

          <div className="bg-black/20 p-5 rounded-2xl space-y-2">
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">作品介紹</p>
            <p className="leading-relaxed text-gray-200">
              {/* 若有從本地 AI 樂評載入介紹，則優先顯示，否則回退至預設元數據描述 */}
              {albumReview?.introduction ? (
                albumReview.introduction
              ) : (
                <>
                  此發行作品由藝人 <strong className="text-spotify-green">{selectedAlbum.artistName || '未知藝人'}</strong> 創作，類型為 <strong className="text-white">{selectedAlbum.type === 'album' ? '專輯 (Album)' : '單曲 (Single)'}</strong>，共收錄 {selectedAlbum.total_tracks} 首曲目。這張作品於 {selectedAlbum.release_date} 正式發行。
                </>
              )}
            </p>
          </div>

          {/* 專輯曲目清單 */}
          <div className={`bg-black/20 p-5 rounded-2xl space-y-3 flex flex-col ${isFull ? '' : 'max-h-[300px]'}`}>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-wider flex items-center gap-1">
               <Music4 size={14} className="text-spotify-green" /> 專輯曲目清單
            </p>

            {tracksLoading ? (
              <div className="flex items-center justify-center py-6 text-gray-400 gap-2">
                <Loader2 size={16} className="animate-spin text-spotify-green" />
                <span className="text-xs">讀取歌曲中...</span>
              </div>
            ) : tracksError ? (
              <div className="flex flex-col items-center py-4 gap-3">
                <p className="text-xs text-red-400 flex items-center gap-1"><AlertCircle size={14} /> 曲目載入失敗</p>
                <button
                  onClick={retryTracks}
                  className="text-xs bg-white/10 hover:bg-white/20 transition-all px-3 py-1.5 rounded-lg flex items-center gap-1"
                >
                  <RotateCw size={12} /> 再試一次
                </button>
              </div>
            ) : (!Array.isArray(tracks) || tracks.length === 0) ? (
              <p className="text-xs text-gray-500 py-2">無曲目資料</p>
            ) : (
              <div className={`overflow-y-auto space-y-1 pr-1 ${isFull ? '' : 'max-h-[220px]'}`} role="list" aria-label="專輯曲目清單（可用 j/k 或上下鍵切換）">
                {tracks.map((track) => (
                  <button
                    key={track.id}
                    aria-current={selectedTrack?.id === track.id ? 'true' : undefined}
                    onClick={() => {
                      // 使用 React Router navigate 跳轉，避免整頁重新整理
                      navigate(`/album/${selectedAlbum.id}/song/${track.id}`);
                    }}
                    className={`w-full text-left p-2 rounded-lg transition-all text-xs flex items-center justify-between gap-3 group ${
                      selectedTrack?.id === track.id
                        ? 'bg-spotify-green/20 text-white font-bold'
                        : 'hover:bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className={`w-4 text-center font-mono ${
                        selectedTrack?.id === track.id ? 'text-spotify-green' : 'text-gray-500'
                      }`}>
                        {track.track_number}
                      </span>
                      <span className="truncate group-hover:text-white transition-colors">
                        {track.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-500 font-mono">
                      {formatDuration(track.duration_ms)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-8">
        <a
          href={selectedAlbum.url}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full bg-white/10 backdrop-blur-md hover:bg-white/20 transition-all duration-300 text-white px-4 py-4 rounded-2xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg"
        >
          <ExternalLink size={16} />
          在 Spotify 上聆聽
        </a>
      </div>
    </div>
  )
}

export default AlbumPanel
