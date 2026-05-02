# PROJECT MEMORY — MESSAGE APP INTEGRATION
# Saved: 2026-05-02 | Owner: Prasanna Chaurasia

## Identity
- Project: Claude AI Agent — WhatsApp + Slack remote command bridge
- Trigger word: `message port`
- Path: D:/claude-projects/message-app-integration/
- GitHub: https://github.com/PrasannaChaurasia/message-app-integration

## Purpose
Send prompts from WhatsApp or Slack → Claude processes on machine → replies in chat.
Supports: text, voice notes (Whisper), images (Vision), PDFs, DOCX, XLSX, YouTube links.

## Stack
| Component | Tech |
|---|---|
| WhatsApp | @whiskeysockets/baileys (Baileys) |
| Slack | @slack/bolt — Socket Mode (no public URL needed) |
| AI | @anthropic-ai/sdk — claude-sonnet-4-6 |
| Voice | OpenAI Whisper (whisper-1) |
| Process manager | PM2 (global install) |
| Runtime | Node.js 18+ |

## Source Files
| File | Purpose |
|---|---|
| src/index.js | Entry point — starts all bots |
| src/whatsapp/bot.js | Baileys WhatsApp client |
| src/slack/bot.js | Slack Bolt Socket Mode bot |
| src/discord/bot.js | Discord (skipped — no token) |
| src/claude/handler.js | Claude API + agentic tool loop |
| src/claude/history.js | Conversation history per user |
| src/agent/tools.js | Tool definitions + executors |
| ecosystem.config.js | PM2 config |

## Environment (.env)
| Var | Value / Notes |
|---|---|
| ANTHROPIC_API_KEY | Set |
| OPENAI_API_KEY | Set — for Whisper voice transcription |
| CLAUDE_MODEL | claude-sonnet-4-6 |
| MAX_RESPONSE_LENGTH | 4000 |
| WHATSAPP_SESSION_PATH | ./session |
| ALLOWED_NUMBERS | 447776361383 |
| SLACK_BOT_TOKEN | Set (xoxb-...) |
| SLACK_APP_TOKEN | Set (xapp-...) — Socket Mode |

## Current Status (2026-05-02)
- WhatsApp: Connected as +44 7776 361383
- Slack: Connected via Socket Mode
- Discord: Skipped — no token set
- PM2: Running (process name: message-bot)
- Auto-start on login: Windows Startup folder shortcut exists

## PM2 Commands
```bash
cd D:/claude-projects/message-app-integration
npx pm2 status                  # check status
npx pm2 logs message-bot        # live logs
npx pm2 restart message-bot     # restart
npx pm2 stop message-bot        # stop
npx pm2 save                    # persist process list
```

## Auto-start Setup
- PM2 saved: C:/Users/Lenovo/.pm2/dump.pm2
- Startup shortcut: C:/Users/Lenovo/AppData/Roaming/Microsoft/Windows/Start Menu/Programs/Startup/Claude WhatsApp Bot.lnk
- start-bot.bat: D:/claude-projects/message-app-integration/start-bot.bat
- Bot restarts automatically within ~15s after Windows login

## Behaviour Notes
- No prefix required — all messages from allowed numbers go to Claude
- Self-chat works (message yourself on WhatsApp)
- Slack: DM the bot OR @mention in any channel
- Voice notes transcribed via Whisper before sending to Claude
- Images analysed via Claude Vision
- Files: PDF, DOCX, XLSX, TXT, CSV, code files all extracted and sent as text
- YouTube URLs: transcript pre-fetched and embedded automatically
- "clear" or "reset" message clears conversation history for that user
- DALL-E image generation supported via agent tools

## Phase Roadmap
- [x] Phase 1: WhatsApp bot
- [x] Phase 1b: Slack bot
- [ ] Phase 2: Discord bot (token not configured)
