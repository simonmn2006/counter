module.exports = {
  apps: [
    {
      name: "production-tracker",
      script: "npm",
      args: "run dev",
      env: {
        NODE_ENV: "development",
        PORT: 3000
      },
      // Restart logic
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      restart_delay: 3000,
      // Logging
      error_file: "./logs/pm2-error.log",
      out_file: "./logs/pm2-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      // Ensure it runs from the correct directory
      cwd: __dirname
    }
  ]
};
