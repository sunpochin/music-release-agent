module.exports = {
  // 背景服務與任務定義
  apps: [
    {
      // 音樂新歌代理 Express 後端
      // 【小朋友解釋法】：
      // 不要讓 PM2 呼叫 NPM 經理 (npm run dev) 去叫小兵 (server.js)，因為 NPM 經理下班時會忘記叫小兵回家，導致 Port 埠被佔用。
      // 我們讓 PM2 直接管小兵 (server.js)，並用 watch 隨時注意小兵有沒有改寫，自動幫他重新開機！
      name: 'music-release-agent-server',
      script: 'server.js',
      watch: ['server.js', 'src'],
      exec_mode: 'fork',
      error_file: 'logs/server-err.log',
      out_file: 'logs/server-out.log',
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      // 前端 Vite Dashboard 介面
      name: 'music-release-agent-dashboard',
      script: 'npm',
      args: 'run dev',
      cwd: './dashboard',
      exec_mode: 'fork',
      watch: false,
      error_file: '../logs/dashboard-err.log',
      out_file: '../logs/dashboard-out.log',
      env: {
        NODE_ENV: 'development'
      }
    },
    {
      // 社群貼文自動發布微服務
      name: 'social-post-service',
      script: 'npm',
      args: 'run dev',
      cwd: '../social-post-service',
      exec_mode: 'fork',
      watch: false,
      error_file: '../music-release-agent/logs/social-err.log',
      out_file: '../music-release-agent/logs/social-out.log'
    },
    {
      // 歌詞翻譯 + Obsidian vault 落盤微服務
      // 未啟動時核心不受影響：/api/lyrics 回 502、/readyz 標 degraded、前端顯示離線訊息
      name: 'lyrics-vault-service',
      script: 'server.js',
      cwd: '../lyrics-vault-service',
      exec_mode: 'fork',
      watch: false,
      error_file: '../music-release-agent/logs/lyrics-err.log',
      out_file: '../music-release-agent/logs/lyrics-out.log',
      env: {
        PORT: 3013
      }
    },
    {
      // Spotify 定時發行掃描器 (每 3 小時執行一次)
      name: 'spotify-release-scanner',
      script: 'scan-releases.js',
      exec_mode: 'fork',
      instances: 1,
      autorestart: false,
      cron_restart: '0 */3 * * *',
      watch: false,
      error_file: 'logs/scanner-err.log',
      out_file: 'logs/scanner-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
