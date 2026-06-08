module.exports = {
  // 背景服務與任務定義
  apps: [
    {
      // 音樂新歌代理 Express 後端
      name: 'music-release-agent-server',
      script: 'npm',
      args: 'run dev',
      exec_mode: 'fork',
      watch: false,
      error_file: 'logs/server-err.log',
      out_file: 'logs/server-out.log'
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
      out_file: '../logs/dashboard-out.log'
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
