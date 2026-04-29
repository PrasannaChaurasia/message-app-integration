require('dotenv').config()
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const https = require('https')
const { askClaude } = require('../claude/handler')

const SESSION_DIR = './baileys-session'
const MEDIA_DIR = path.join(__dirname, '../../received-media')
const ALLOWED = process.env.ALLOWED_NUMBERS ? process.env.ALLOWED_NUMBERS.split(',').map(n => n.trim()) : []

fs.mkdirSync(MEDIA_DIR, { recursive: true })

const processed = new Set()

function isAllowed(jid) {
  if (ALLOWED.length === 0) return true
  const num = jid.replace(/[^0-9]/g, '')
  return ALLOWED.some(a => num.endsWith(a) || a.endsWith(num))
}

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      const chunks = []
      res.on('data', c => chunks.push(c))
      res.on('end', () => resolve(Buffer.concat(chunks)))
      res.on('error', reject)
    }).on('error', reject)
  })
}

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Claude Terminal', 'Chrome', '1.0.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log('\n📱 Scan this QR code → WhatsApp → Settings → Linked Devices → Link a Device\n')
      qrcode.generate(qr, { small: true })

      // also save as image
      try {
        const QRCode = require('qrcode')
        const qrPath = path.join(__dirname, '../../whatsapp-qr.png')
        await QRCode.toFile(qrPath, qr, { width: 512, margin: 2 })
        console.log('✅ QR image saved → ' + qrPath)
        require('child_process').exec(`start "" "${qrPath}"`)
      } catch {}
    }

    if (connection === 'open') {
      const me = sock.user?.id || ''
      console.log(`✅ WhatsApp connected | You: ${me}`)
      console.log(`🔒 Allowed numbers: ${ALLOWED.length ? ALLOWED.join(', ') : 'all'}`)
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = code !== DisconnectReason.loggedOut
      console.log(`⚠️ Disconnected (code ${code}) — ${shouldReconnect ? 'reconnecting...' : 'logged out'}`)
      if (shouldReconnect) {
        setTimeout(() => startWhatsAppBot(), 3000)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      const jid = msg.key.remoteJid
      const fromMe = msg.key.fromMe
      const msgId = msg.key.id

      if (!jid || msgId && processed.has(msgId)) continue
      if (msgId) { processed.add(msgId); setTimeout(() => processed.delete(msgId), 60000) }

      // only process messages from yourself (self-chat / saved messages)
      if (!fromMe) {
        if (!isAllowed(jid)) {
          console.log(`🚫 Ignored from ${jid}`)
          continue
        }
      }

      // extract text
      const text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.message?.imageMessage?.caption
        || msg.message?.documentMessage?.caption
        || ''

      if (!text.trim()) continue

      console.log(`📨 [${fromMe ? 'me' : jid}]: ${text.slice(0, 80)}`)

      try {
        await sock.sendPresenceUpdate('composing', jid)
        const response = await askClaude(text, jid)

        // check for DALL-E image URL
        const imageUrlMatch = response.match(/https:\/\/oaidalleapiprodscus[^\s"]+/i)
        if (imageUrlMatch) {
          try {
            const imgBuffer = await downloadImage(imageUrlMatch[0])
            await sock.sendMessage(jid, { image: imgBuffer, caption: response.replace(imageUrlMatch[0], '').trim() })
            await sock.sendPresenceUpdate('available', jid)
            continue
          } catch (e) { console.error('Image send error:', e.message) }
        }

        // check for generated file
        if (response.startsWith('GENERATED_FILE:')) {
          const filePath = response.replace('GENERATED_FILE:', '').trim()
          if (fs.existsSync(filePath)) {
            const fileBuffer = fs.readFileSync(filePath)
            const ext = path.extname(filePath).slice(1)
            await sock.sendMessage(jid, { document: fileBuffer, mimetype: 'application/octet-stream', fileName: path.basename(filePath) })
            await sock.sendPresenceUpdate('available', jid)
            continue
          }
        }

        await sock.sendMessage(jid, { text: response })
        await sock.sendPresenceUpdate('available', jid)
      } catch (err) {
        console.error('Error:', err.message)
        await sock.sendMessage(jid, { text: '❌ ' + err.message })
      }
    }
  })
}

module.exports = { startWhatsAppBot }
