module.exports = {
  apps: [
    {
      name: "virtual-office",
      script: "./dist/server.js",
      instances: "max",
      exec_mode: "cluster",
      max_memory_restart: "512M",
      kill_timeout: 5000,
      env: {
        NODE_ENV: "development",
        PORT: 8080,
      },
      env_production: {
        NODE_ENV: "production",
        PORT: 8080,
      },
      error_file: "./logs/pm2-err.log",
      out_file: "./logs/pm2-out.log",
      time: true,
    },
  ],
};
