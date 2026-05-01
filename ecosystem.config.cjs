/**
 * PM2 ecosystem for cozza-ai API on the Aruba VPS.
 * Usage on the server:
 *   pm2 start ecosystem.config.cjs --only cozza-ai-api --update-env
 *   pm2 save
 *   pm2 logs cozza-ai-api
 */
module.exports = {
  apps: [
    {
      name: 'cozza-ai-api',
      cwd: '/var/www/cozza-ai/apps/api',
      script: 'dist/server.js',
      node_args: '--enable-source-maps',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '300M',
      kill_timeout: 5000,
      // Env loaded by app via dotenv (apps/api/.env). PORT can be overridden here.
      env: {
        NODE_ENV: 'production',
        PORT: 3025,
        HOST: '127.0.0.1',
      },
      out_file: '/var/log/pm2/cozza-ai-api.out.log',
      error_file: '/var/log/pm2/cozza-ai-api.err.log',
      merge_logs: true,
      time: true,
    },
  ],
};
