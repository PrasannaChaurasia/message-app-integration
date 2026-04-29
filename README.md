<div align="center">

# Claude AI Agent — WhatsApp & Slack Integration

**A fully autonomous AI agent in your pocket. Send a message. Get real work done.**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![Claude](https://img.shields.io/badge/Claude-Sonnet_4.6-D97757?style=flat-square)](https://anthropic.com)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)
[![PM2](https://img.shields.io/badge/PM2-Ready-2B037A?style=flat-square)](https://pm2.keymetrics.io)

Built by [Prasanna Chaurasia](https://github.com/PrasannaChaurasia) — Urban Matrix, Manchester UK

</div>

---

## Overview

Connect Claude to WhatsApp and Slack as a fully agentic AI assistant. It does not just answer questions — it uses tools to search the web, read and generate files, run shell commands, analyse images and documents, transcribe voice notes and videos, and deploy code. All from a message.

---

## Capabilities

| Category | What It Can Do |
|---|---|
| **Conversation** | Full Claude Sonnet responses with per-user conversation history |
| **Web** | Real-time web search, read any URL, fetch YouTube transcripts |
| **Documents In** | Read PDF, DOCX, XLSX, TXT, CSV sent via WhatsApp or Slack |
| **Documents Out** | Generate `.pptx`, `.pdf`, `.xlsx`, `.html`, any text file |
| **Images** | Analyse images (Claude Vision) + generate images (DALL-E 3) |
| **Audio/Video** | Transcribe WhatsApp voice notes and video messages (Whisper) |
| **File System** | Read and write files on the host machine |
| **Shell** | Run git, npm, node, python, curl directly |
| **GitHub** | Issues, PRs, repo management via GitHub CLI |
| **Deploy** | Deploy projects to Vercel from a message |
| **Notion** | Query and create Notion pages (optional) |

---

## Quick Start

```bash
# Clone
git clone https://github.com/PrasannaChaurasia/message-app-integration.git
cd message-app-integration

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Edit .env with your API keys (see below)

# Start
npm start
```

Scan the QR code with WhatsApp → Settings → Linked Devices → Link a Device.

---

## Environment Variables

```env
# ── Required ────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...          # anthropic.com/console

# ── Required for voice, video, image generation ─────────────
OPENAI_API_KEY=sk-proj-...            # platform.openai.com/api-keys

# ── Slack (optional) ────────────────────────────────────────
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...

# ── Discord (optional) ──────────────────────────────────────
DISCORD_BOT_TOKEN=...

# ── Optional configuration ───────────────────────────────────
ALLOWED_NUMBERS=447700000000          # Comma-separated. Leave empty = allow all
CLAUDE_MODEL=claude-sonnet-4-6
MAX_RESPONSE_LENGTH=4000
NOTION_TOKEN=secret_...               # Optional Notion integration
```

---

## Slack App Setup

1. Go to [api.slack.com/apps](https://api.slack.com/apps) and create a new app
2. Enable **Socket Mode** — generate an App-Level Token with `connections:write` scope → this is your `SLACK_APP_TOKEN`
3. Under **OAuth & Permissions**, add Bot Token Scopes: `chat:write`, `im:history`, `im:read`, `channels:history`, `app_mentions:read`, `files:read`
4. Under **Event Subscriptions** → Subscribe to bot events: `message.im`, `app_mention`, `file_shared`
5. Install to workspace → copy the Bot Token → this is your `SLACK_BOT_TOKEN`

---

## Run 24/7 with PM2

```bash
# Install PM2
npm install -g pm2

# Start and persist across reboots
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# Useful commands
pm2 status                # Check running status
pm2 logs message-bot      # Live logs
pm2 restart message-bot   # Restart
pm2 stop message-bot      # Stop
```

---

## Project Structure

```
message-app-integration/
├── src/
│   ├── index.js              # Entry point
│   ├── whatsapp/bot.js       # WhatsApp via Baileys (no Puppeteer/Chrome)
│   ├── slack/bot.js          # Slack via Bolt + Socket Mode
│   ├── discord/bot.js        # Discord via discord.js
│   ├── claude/
│   │   ├── handler.js        # Agentic loop — Claude + tool use
│   │   └── history.js        # Per-user conversation history
│   └── agent/tools.js        # 17 registered tools
├── .env.example
├── ecosystem.config.js       # PM2 config
└── package.json
```

---

## How the Agent Works

```
Message received (WhatsApp / Slack / Discord)
          │
          ▼
  Media extraction
  PDF → text  |  Image → base64  |  Audio/Video → Whisper transcript
          │
          ▼
  Claude API  (claude-sonnet-4-6)
  System prompt + 17 tool definitions + conversation history
          │
          ▼
  Agentic loop
  ┌─────────────────────────────────┐
  │  Claude decides → calls tool    │
  │  Tool runs → result returned    │
  │  Claude continues or calls more │
  └──────────── until done ─────────┘
          │
          ▼
  Final response sent
  Text reply  |  File attachment (PPTX / PDF / XLSX / HTML)
```

---

## Example Prompts

**Research + generate PDF:**
```
Research UK architecture job market: salary ranges, top hiring firms,
visa sponsorship availability, and required qualifications. Save as PDF.
```

**Explain a YouTube video:**
```
Explain this YouTube video to me in simple terms:
https://www.youtube.com/watch?v=WR-kVYU-lBU
```

**Generate a presentation:**
```
Create a 6-slide PowerPoint on AI tools in architecture 2025.
Dark professional theme.
```

**Generate an image:**
```
Generate a photorealistic image of a minimalist residential building
in Manchester at dusk, glass facade, street level view.
```

**Read a URL and summarise:**
```
Read this article and give me a structured PDF summary:
https://example.com/article
```

**Project git status:**
```
What is the current git status of the Urbanmatrix portfolio?
```

**Shell command:**
```
Run npm run build in D:/claude-projects/portfolio and tell me if it passes.
```

**Commands:**
- `clear` or `reset` — wipe your conversation history

---

## Security

- `ALLOWED_NUMBERS` in `.env` restricts who can interact via WhatsApp
- The bot ignores all WhatsApp group messages
- Messages sent to others from your linked device are ignored
- File system access is locked to configured project directories
- `.env`, session files, history, and generated files are excluded from git

---

## Tech Stack

| | Library | Purpose |
|---|---|---|
| WhatsApp | [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) | No Chrome, no Puppeteer |
| Slack | [@slack/bolt](https://slack.dev/bolt-js) | Socket Mode |
| Discord | [discord.js](https://discord.js.org) | Bot gateway |
| AI | [@anthropic-ai/sdk](https://npmjs.com/package/@anthropic-ai/sdk) | Claude Sonnet |
| Voice/Video | OpenAI Whisper | Transcription |
| Images | OpenAI DALL-E 3 | Generation |
| PDF out | [pdfkit](https://pdfkit.org) | |
| PPTX out | [pptxgenjs](https://gitbrent.github.io/PptxGenJS) | |
| XLSX out | [xlsx](https://npmjs.com/package/xlsx) | |
| PDF in | [pdf-parse](https://npmjs.com/package/pdf-parse) | |
| DOCX in | [mammoth](https://npmjs.com/package/mammoth) | |
| Process | [PM2](https://pm2.keymetrics.io) | 24/7 uptime |

---

## Contributing

Pull requests welcome. Open an issue first for major changes.

---

## License

MIT
