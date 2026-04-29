module.exports = {
  apps: [
    {
      name: 'message-bot',
      script: 'src/index.js',
      watch: false,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
