module.exports = {
  apps: [
    {
      name: 'music-release-agent-server',
      script: 'npm',
      args: 'run dev',
      exec_mode: 'fork',
      watch: false,
      error_file: 'logs/server-err.log',
      out_file: 'logs/server-out.log'
    },
    {
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
      name: 'spotify-release-scanner',
      script: 'scan-releases.js',
      instances: 1,
      autorestart: false,
      cron_restart: '0 */3 * * *',
      watch: false,
      error_file: 'logs/scanner-pm2-err.log',
      out_file: 'logs/scanner-pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
