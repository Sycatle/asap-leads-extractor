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
      script: 'pnpm',
      args: 'worker',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '0 6 * * *', // Restart tous les jours à 6h
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'leadflow-backup',
      script: './backup.sh',
      args: '--rotate 7',
      instances: 1,
      autorestart: false,
      watch: false,
      cron_restart: '0 2 * * *', // Backup tous les jours à 2h du matin
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
