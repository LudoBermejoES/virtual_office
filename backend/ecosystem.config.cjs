module.exports = {
  apps: [
    {
      name: "virtual-office",
      script: "./dist/server.js",
      node_args: "--env-file=.env",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "512M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "development",
        PORT: 8123,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 8123,
      },
      error_file: "./logs/pm2-err.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true,
      autorestart: true,
      time: true,
    },
  ],
};
