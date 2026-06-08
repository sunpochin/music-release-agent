module.exports = {
  apps: [
    {
      name: 'spotify-release-scanner',
      script: 'scan-releases.js',
      // 僅執行單個實例
      instances: 1,
      // 執行完畢後不要自動重啟 (Traditional Chinese comment)
      autorestart: false,
      // 每 3 小時觸發執行一次 (0 */3 * * *)
      cron_restart: '0 */3 * * *',
      // 關閉檔案變動監聽，避免開發時頻繁觸發
      watch: false,
      // 設定日誌路徑
      error_file: 'logs/pm2-err.log',
      out_file: 'logs/pm2-out.log',
      // 日誌前綴加上時間戳記
      log_date_format: 'YYYY-MM-DD HH:mm:ss'
    }
  ]
};
