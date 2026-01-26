module.exports = {
  apps: [
    {
      name: 'leadflow-web',
      cwd: './web',
      script: 'node_modules/.bin/next',
      args: 'start -p 3000',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_file: '../.env',
    },
    {
      name: 'leadflow-worker',
      script: './worker/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      cron_restart: '0 6 * * *', // Restart tous les jours à 6h
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
      },
      env_file: './.env',
    },
  ],
};
