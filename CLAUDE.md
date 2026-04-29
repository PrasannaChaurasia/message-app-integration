# CLAUDE.md — Level 2 — Message App Integration

## Project
- **Name:** message-app-integration
- **Trigger:** message port
- **Path:** D:/claude-projects/message-app-integration/
- **GitHub:** https://github.com/PrasannaChaurasia/message-app-integration

## Purpose
Remote command bridge — send prompts from WhatsApp → Claude API processes → replies in chat.
Phase 1: WhatsApp only (whatsapp-web.js, QR scan, free).

## Stack
- Node.js 18+
- whatsapp-web.js (WhatsApp client)
- @anthropic-ai/sdk (Claude API)
- PM2 (background process manager)
- dotenv

## Status
- [x] WhatsApp bot
- [x] Claude handler
- [x] PM2 config
- [ ] Discord (Phase 2)
- [ ] Slack (Phase 2)

## Key Files
| File | Purpose |
|---|---|
| src/index.js | Entry point |
| src/whatsapp/bot.js | WhatsApp bot |
| src/claude/handler.js | Claude API calls |
| ecosystem.config.js | PM2 process config |
| .env.example | Env var template |

## Env Vars Required
- ANTHROPIC_API_KEY
- ALLOWED_NUMBERS (optional — restrict access by phone number)
- COMMAND_PREFIX (optional — e.g. /claude)
- CLAUDE_MODEL (default: claude-sonnet-4-6)

## Run Commands
```bash
npm start              # Direct run (terminal open)
npm run pm2:start      # Background daemon
npm run pm2:logs       # View logs
npm run pm2:save       # Persist across reboots
```
