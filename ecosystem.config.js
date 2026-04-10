module.exports = {
  apps: [
    {
      name: 'klaus-md-bot',
      script: 'start.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        APP_MODE: 'bot',
        PORT: 3000
      }
    },
    {
      name: 'klaus-md-session',
      script: 'start.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        APP_MODE: 'session',
        SESSION_SERVER_PORT: 3001,
        PORT: 3001
      }
    }
  ]
};
