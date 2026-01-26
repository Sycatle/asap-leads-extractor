module.exports = {
  apps: [
    {
      name: 'leadflow-web',
      cwd: './web',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
    {
      name: 'leadflow-worker',
      script: 'node_modules/.bin/tsx',
      args: 'worker/index.ts orchestrator',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '0 6 * * *', // Restart tous les jours à 6h
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
