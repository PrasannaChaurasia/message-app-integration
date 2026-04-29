require('dotenv').config()
const { Client, LocalAuth } = require('whatsapp-web.js')
const qrcode = require('qrcode-terminal')
const { askClaude } = require('../claude/handler')

const allowedNumbers = process.env.ALLOWED_NUMBERS
  ? process.env.ALLOWED_NUMBERS.split(',').map(n => n.trim())
  : []

const prefix = process.env.COMMAND_PREFIX || ''

function isAllowed(from) {
  if (allowedNumbers.length === 0) return true
  const number = from.replace('@c.us', '')
  return allowedNumbers.includes(number)
}

function extractPrompt(body) {
  if (!prefix) return body.trim()
  if (body.startsWith(prefix)) return body.slice(prefix.length).trim()
  return null
}

function startWhatsAppBot() {
  const client = new Client({
    authStrategy: new LocalAuth({ dataPath: process.env.WHATSAPP_SESSION_PATH || './session' }),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  })

  client.on('qr', qr => {
    console.log('\n📱 Scan this QR code in WhatsApp → Settings → Linked Devices → Link a Device\n')
    qrcode.generate(qr, { small: true })
  })

  client.on('ready', () => {
    console.log('✅ WhatsApp bot is connected and ready')
  })

  client.on('auth_failure', () => {
    console.error('❌ WhatsApp authentication failed — delete ./session and restart')
  })

  client.on('disconnected', reason => {
    console.warn(`⚠️  WhatsApp disconnected: ${reason} — reconnecting...`)
    client.initialize()
  })

  client.on('message', async msg => {
    if (msg.fromMe) return
    if (!isAllowed(msg.from)) return

    const prompt = extractPrompt(msg.body)
    if (!prompt) return

    console.log(`📨 Message from ${msg.from}: ${prompt.slice(0, 80)}`)

    try {
      await msg.reply('⏳ Processing...')
      const response = await askClaude(prompt)
      await msg.reply(response)
    } catch (err) {
      console.error('Claude error:', err.message)
      await msg.reply('❌ Error: ' + err.message)
    }
  })

  client.initialize()
}

module.exports = { startWhatsAppBot }
