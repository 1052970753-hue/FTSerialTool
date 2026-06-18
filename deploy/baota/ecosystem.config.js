module.exports = {
  apps: [
    {
      name: "ft-update-server",
      script: "server/start.js",
      cwd: "/www/wwwroot/ft-updateserver",
      env: {
        FT_PORT: 8765,
        FT_VERSION: "1.2.18",
        FT_UPLOAD_DIR: "/www/wwwroot/ft-updateserver/uploads",
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "200M",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      error_file: "/www/wwwroot/ft-updateserver/logs/error.log",
      out_file: "/www/wwwroot/ft-updateserver/logs/out.log",
      merge_logs: true,
    },
  ],
};
