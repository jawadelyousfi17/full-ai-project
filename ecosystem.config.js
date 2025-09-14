module.exports = {
  apps: [
    {
      name: 'ai-backend',
      script: 'src/api/server.js',
      cwd: '/home/jawad/full-ai-project',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      error_file: './logs/backend-error.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    },
    {
      name: 'ai-frontend',
      script: 'npm',
      args: 'run dev',
      cwd: '/home/jawad/full-ai-project/frontend',
      env: {
        NODE_ENV: 'development',
        VITE_API_HOST: 'http://localhost:3000',
        VITE_HOST: 'localhost',
        VITE_PORT: 5173
      },
      instances: 1,
      autorestart: true,
      watch: false,
      error_file: './logs/frontend-error.log',
      out_file: './logs/frontend-out.log',
      log_file: './logs/frontend-combined.log',
      time: true
    }
  ]
};
