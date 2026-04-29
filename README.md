<div align="center">

# Claude Code — Message App Integration

**Control Claude Code remotely from WhatsApp (and soon Discord & Slack)**

Send a prompt from your phone. Claude executes the task on your machine and replies — right inside your chat.

[![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square&logo=node.js)](https://nodejs.org)
[![Claude API](https://img.shields.io/badge/Claude-API-orange?style=flat-square)](https://anthropic.com)
[![WhatsApp](https://img.shields.io/badge/WhatsApp-Bot-25D366?style=flat-square&logo=whatsapp)](https://github.com/pedroslopez/whatsapp-web.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

</div>

---

## What This Does

This project bridges **Claude Code** with **messaging apps**. Once set up, you can type a prompt into WhatsApp from your phone and Claude will:

- Answer questions
- Generate or edit code
- Run tasks on your local machine
- Reply to you directly inside WhatsApp

**No terminal. No laptop open. Just your phone.**

---

## How It Works

```
Your Phone (WhatsApp)
        │
        │  Send: "Refactor the auth module in my project"
        ▼
  WhatsApp Bot  (whatsapp-web.js running on your machine)
        │
        ▼
  Claude API  (Anthropic)
        │
        ▼
  Response sent back to your WhatsApp chat
```

The bot runs as a background process on your machine using PM2. You scan a QR code once — after that it stays connected automatically.

---

## Supported Platforms

| Platform | Status | Auth Method |
|---|---|---|
| WhatsApp | ✅ Ready | QR Scan (free, no API key) |
| Discord | 🔜 Coming soon | Bot token |
| Slack | 🔜 Coming soon | App token |
| Telegram | 🔜 Planned | Bot token |

---

## Prerequisites

Before starting, make sure you have:

| Requirement | Version | Check |
|---|---|---|
| Node.js | 18 or higher | `node -v` |
| npm | 8 or higher | `npm -v` |
| Anthropic API key | — | [Get one here](https://console.anthropic.com) |
| WhatsApp | Active account on your phone | — |
| Google Chrome | Installed | Required by whatsapp-web.js |

---

## Installation

### Step 1 — Clone the repository

```bash
git clone https://github.com/PrasannaChaurasia/message-app-integration.git
cd message-app-integration
```

### Step 2 — Install dependencies

```bash
npm install
```

> This installs `whatsapp-web.js`, the Anthropic SDK, `qrcode-terminal`, `dotenv`, and `pm2`.

### Step 3 — Configure your environment

Copy the example env file:

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
WHATSAPP_SESSION_PATH=./session
ALLOWED_NUMBERS=          # Optional: comma-separated phone numbers allowed to send commands
                          # Leave blank to allow all contacts
                          # Format: 447911123456 (country code, no + or spaces)
MAX_RESPONSE_LENGTH=4000  # WhatsApp character limit per message
```

> **Get your Anthropic API key:** Log in at [console.anthropic.com](https://console.anthropic.com) → API Keys → Create Key.

### Step 4 — Run the bot

**Option A — Run directly (terminal stays open, good for testing):**

```bash
npm start
```

**Option B — Run as background service with PM2 (recommended for daily use):**

```bash
npm run pm2:start
```

This starts the bot as a persistent background process. It will:
- Survive terminal closes
- Auto-restart on crashes
- Auto-start on system reboot (run `npm run pm2:save` once to enable)

### Step 5 — Scan the QR code

When the bot starts for the first time, a QR code will appear in your terminal.

1. Open WhatsApp on your phone
2. Go to **Settings → Linked Devices → Link a Device**
3. Scan the QR code shown in the terminal

The session is saved locally. You only need to scan once — the bot reconnects automatically after restarts.

---

## Usage

Once the bot is running and linked, send any message to **your own WhatsApp number** from another device, or send it from the linked session.

> **Recommended:** Message yourself (your own number) or use a dedicated WhatsApp account for the bot.

### Example commands

```
What is the current date and time?
```

```
Write a Python function that reads a CSV and returns the top 5 rows
```

```
Explain what async/await does in JavaScript
```

```
Generate a README template for a REST API project
```

### Trigger prefix (optional)

If you set `COMMAND_PREFIX` in `.env`, only messages starting with that prefix are processed:

```env
COMMAND_PREFIX=/claude
```

Then send:

```
/claude What files are in my project?
```

Leave it blank to process all incoming messages.

---

## PM2 — Managing the Background Service

| Command | What it does |
|---|---|
| `npm run pm2:start` | Start the bot in background |
| `npm run pm2:stop` | Stop the bot |
| `npm run pm2:restart` | Restart the bot |
| `npm run pm2:logs` | View live logs |
| `npm run pm2:status` | Check if bot is running |
| `npm run pm2:save` | Save config so bot auto-starts on reboot |

---

## Folder Structure

```
message-app-integration/
├── src/
│   ├── index.js              ← Entry point
│   ├── whatsapp/
│   │   └── bot.js            ← WhatsApp bot logic
│   └── claude/
│       └── handler.js        ← Claude API handler
├── local-agent/
│   └── agent.js              ← Local file/CLI task handler (advanced)
├── docs/
│   └── whatsapp-setup.md     ← Detailed WhatsApp setup guide
├── .env.example              ← Environment variable template
├── .gitignore
├── ecosystem.config.js       ← PM2 config
├── package.json
└── README.md
```

---

## Security

- Your Anthropic API key is stored in `.env` — never committed to git
- The `.gitignore` excludes `.env` and the WhatsApp session folder
- Use `ALLOWED_NUMBERS` in `.env` to restrict which phone numbers can send commands
- The WhatsApp session is stored locally — no data is sent to third-party servers except Anthropic's API

---

## Troubleshooting

**QR code not showing:**
- Make sure Google Chrome is installed
- Try deleting the `./session` folder and restarting

**Bot not responding:**
- Check your `ANTHROPIC_API_KEY` is valid
- Run `npm run pm2:logs` to see error output

**Session disconnects after phone restart:**
- This is normal — WhatsApp Web requires the phone to be online
- The bot reconnects automatically once your phone is back online

**Messages from wrong number getting through:**
- Set `ALLOWED_NUMBERS` in `.env` to restrict access

---

## Roadmap

- [x] WhatsApp integration (Phase 1)
- [ ] Discord bot (Phase 2)
- [ ] Slack bot (Phase 2)
- [ ] Local file task execution via PM2 agent
- [ ] Telegram bot (Phase 3)
- [ ] Web dashboard for session management

---

## Contributing

Pull requests are welcome. For major changes, open an issue first to discuss what you would like to change.

1. Fork the repository
2. Create your branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m "Add your feature"`
4. Push: `git push origin feature/your-feature`
5. Open a Pull Request

---

## License

MIT — free to use, modify, and distribute.

---

<div align="center">

Built by [Prasanna Chaurasia](https://github.com/PrasannaChaurasia) — Urban Matrix, Manchester UK

</div>
