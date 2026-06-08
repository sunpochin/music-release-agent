module.exports = {
  apps: [
    {
      name: 'music-release-agent-server',
      script: 'server.js',
      instances: 1,
      autorestart: true,
      watch: ['server.js', 'src'],
      ignore_watch: ['node_modules', 'logs', '*.log', 'data', 'spotify_tokens.json'],
      env: {
        NODE_ENV: 'development'
      },
      error_file: 'logs/server-err.log',
      out_file: 'logs/server-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'spotify-release-scanner',
      script: 'scan-releases.js',
      instances: 1,
      autorestart: false,
      // 每 3 小時執行一次
      cron_restart: '0 */3 * * *',
      watch: false,
      error_file: 'logs/scanner-err.log',
      out_file: 'logs/scanner-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'music-release-agent-dashboard',
      script: 'npm',
      args: 'run dev',
      cwd: 'dashboard',
      instances: 1,
      autorestart: true,
      watch: false,
      error_file: '../logs/dashboard-err.log',
      out_file: '../logs/dashboard-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    },
    {
      name: 'social-post-service',
      script: 'server.js',
      cwd: '../social-post-service',
      instances: 1,
      autorestart: true,
      watch: ['server.js', 'src'],
      ignore_watch: ['node_modules', 'logs', '*.log'],
      env: {
        NODE_ENV: 'development'
      },
      error_file: 'logs/pm2-err.log',
      out_file: 'logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};

