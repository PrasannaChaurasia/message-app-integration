@echo off
cd /d "D:\claude-projects\message-app-integration"
npx pm2 start ecosystem.config.js
npx pm2 save
