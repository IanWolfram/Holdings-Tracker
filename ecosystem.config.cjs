module.exports = {
  apps: [
    {
      name: "pulse",
      script: "npm",
      args: "run dev",
      cwd: __dirname,
      watch: false,
      autorestart: true,
      max_restarts: 5,
      restart_delay: 5000,
      env: {
        NODE_ENV: "development",
        WORLD_SYNC_ENABLED: "true", // Force enable background agent when running via PM2
      },
      // Keep logs in .pm2/logs/ under the project
      out_file: ".pm2/logs/pulse-out.log",
      error_file: ".pm2/logs/pulse-err.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
