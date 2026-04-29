require('dotenv').config()
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, downloadMediaMessage } = require('@whiskeysockets/baileys')
const qrcode = require('qrcode-terminal')
const pino = require('pino')
const fs = require('fs')
const path = require('path')
const https = require('https')
const OpenAI = require('openai')
const { askClaude } = require('../claude/handler')

const SESSION_DIR = './baileys-session'
const MEDIA_DIR = path.join(__dirname, '../../received-media')
const ALLOWED = process.env.ALLOWED_NUMBERS ? process.env.ALLOWED_NUMBERS.split(',').map(n => n.trim()) : []

fs.mkdirSync(MEDIA_DIR, { recursive: true })

const processed = new Set()

// OpenAI client for Whisper
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

// 🎤 Transcribe audio buffer using OpenAI Whisper
async function transcribeAudio(audioBuffer, mimeType) {
  const ext = mimeType?.includes('ogg') ? 'ogg'
    : mimeType?.includes('mp4') ? 'mp4'
    : mimeType?.includes('mpeg') ? 'mp3'
    : mimeType?.includes('webm') ? 'webm'
    : 'ogg'

  const tmpPath = path.join(MEDIA_DIR, `voice_${Date.now()}.${ext}`)
  fs.writeFileSync(tmpPath, audioBuffer)

  try {
    console.log(`🎤 Transcribing voice note (${(audioBuffer.length / 1024).toFixed(1)} KB)...`)
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-1',
      language: 'en'
    })
    console.log(`✅ Transcribed: "${transcription.text}"`)
    return transcription.text
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpPath) } catch {}
  }
}

async function startWhatsAppBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['Claude Terminal', 'Chrome', '1.0.0'],
    generateHighQualityLinkPreview: false,
    syncFullHistory: false
  })

  let MY_JID = null
  let MY_LID = null

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
      MY_JID = sock.user?.id || ''
      MY_LID = (sock.user?.lid || '').split(':')[0].split('@')[0]
      console.log(`✅ WhatsApp connected | You: ${MY_JID} | LID: ${MY_LID}`)
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

      // STRICT RULES:
      // fromMe=true → only respond if jid is MY OWN number (self-chat)
      // fromMe=false → only respond if sender is in ALLOWED list
      const myNum = (MY_JID || '').split(':')[0].split('@')[0]
      const myLid = MY_LID || ''
      const chatNum = jid.split('@')[0]
      const isSelfChat = (myNum && chatNum === myNum) || (myLid && chatNum === myLid)

      // log every message for debugging
      console.log(`MSG jid=${jid} fromMe=${fromMe} isSelfChat=${isSelfChat} myNum=${myNum} chatNum=${chatNum}`)

      if (fromMe && !isSelfChat) continue // sent to someone else — ignore
      if (!fromMe && !isSelfChat && !isAllowed(jid)) {
        console.log(`🚫 Ignored from ${jid}`)
        continue
      }

      let text = msg.message?.conversation
        || msg.message?.extendedTextMessage?.text
        || msg.message?.imageMessage?.caption
        || msg.message?.documentMessage?.caption
        || ''

      let imageBase64 = null
      let imageMime = null

      // Handle document/file messages — PDF, DOCX, XLSX, TXT, CSV, code files, etc.
      const documentMessage = msg.message?.documentMessage
      if (documentMessage) {
        try {
          await sock.sendPresenceUpdate('composing', jid)
          const docBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage.bind(sock) })
          const mime = documentMessage.mimetype || ''
          const fileName = documentMessage.fileName || 'file'
          let extractedText = ''

          if (mime.includes('pdf')) {
            const pdfParse = require('pdf-parse')
            const data = await pdfParse(docBuffer)
            extractedText = data.text?.replace(/\s+/g, ' ').trim().slice(0, 10000) || ''
          } else if (mime.includes('wordprocessingml') || mime.includes('msword') || fileName.match(/\.docx?$/i)) {
            const mammoth = require('mammoth')
            const result = await mammoth.extractRawText({ buffer: docBuffer })
            extractedText = result.value?.replace(/\s+/g, ' ').trim().slice(0, 10000) || ''
          } else if (mime.includes('spreadsheetml') || mime.includes('excel') || fileName.match(/\.xlsx?$/i)) {
            const XLSX = require('xlsx')
            const wb = XLSX.read(docBuffer, { type: 'buffer' })
            extractedText = wb.SheetNames.map(name => {
              const ws = wb.Sheets[name]
              return `Sheet: ${name}\n${XLSX.utils.sheet_to_csv(ws)}`
            }).join('\n\n').slice(0, 10000)
          } else if (mime.includes('text') || fileName.match(/\.(txt|md|csv|json|js|ts|py|html|css|xml|yaml|yml|sh|bat)$/i)) {
            extractedText = docBuffer.toString('utf8').slice(0, 10000)
          } else {
            extractedText = `[Binary file: ${fileName} (${mime}) — ${(docBuffer.length / 1024).toFixed(1)} KB. Cannot extract text from this format.]`
          }

          const caption = documentMessage.caption || text || ''
          const userQuestion = caption.trim() || 'Analyse this file and summarise its content.'
          text = `[FILE: ${fileName}]\n${extractedText}\n\nUser instruction: ${userQuestion}`
          console.log(`File received: ${fileName} (${mime}) ${(docBuffer.length/1024).toFixed(1)}KB, extracted ${extractedText.length} chars`)
        } catch (err) {
          console.error('Document processing error:', err.message)
          text = documentMessage.caption || `A file was shared (${documentMessage.fileName || 'unknown'}) but could not be read: ${err.message}`
        }
      }

      // Handle video messages — extract audio and transcribe
      const videoMessage = msg.message?.videoMessage
      if (videoMessage) {
        try {
          await sock.sendPresenceUpdate('composing', jid)
          const videoBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage.bind(sock) })
          const tmpPath = path.join(MEDIA_DIR, `video_${Date.now()}.mp4`)
          fs.writeFileSync(tmpPath, videoBuffer)
          const transcribed = await transcribeAudio(videoBuffer, 'audio/mp4')
          try { fs.unlinkSync(tmpPath) } catch {}
          if (transcribed && transcribed.trim()) {
            await sock.sendMessage(jid, { text: `Transcribed from video: "${transcribed}"` })
            text = (videoMessage.caption ? videoMessage.caption + '\n' : '') + transcribed
          } else {
            text = videoMessage.caption || 'A video was shared.'
          }
        } catch (err) {
          console.error('Video processing error:', err.message)
          text = videoMessage.caption || 'A video was shared (could not transcribe audio).'
        }
      }

      // Handle image messages — send to Claude Vision
      const imageMessage = msg.message?.imageMessage
      if (imageMessage) {
        try {
          const imgBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage.bind(sock) })
          imageBase64 = imgBuffer.toString('base64')
          imageMime = (imageMessage.mimetype || 'image/jpeg').split(';')[0]
          if (!text.trim()) text = 'Analyse this image and describe what you see.'
        } catch (err) {
          console.error('Image download error:', err.message)
        }
      }

      // Handle voice/audio messages
      const audioMessage = msg.message?.audioMessage
      if (audioMessage) {
        try {
          await sock.sendPresenceUpdate('composing', jid)
          const audioBuffer = await downloadMediaMessage(msg, 'buffer', {}, { logger: pino({ level: 'silent' }), reuploadRequest: sock.updateMediaMessage.bind(sock) })
          const mimeType = audioMessage.mimetype || 'audio/ogg'
          const transcribed = await transcribeAudio(audioBuffer, mimeType)

          if (!transcribed || !transcribed.trim()) {
            await sock.sendMessage(jid, { text: "Could not make out the audio. Please try again or type your message." })
            continue
          }

              // Echo the transcription so the user knows what was heard
          await sock.sendMessage(jid, { text: `Transcribed: "${transcribed}"` })
          text = transcribed
        } catch (err) {
          console.error('Voice transcription error:', err.message)
          await sock.sendMessage(jid, { text: `Voice transcription failed: ${err.message}` })
          continue
        }
      }

      if (!text.trim()) continue

      console.log(`📨 [${fromMe ? 'me' : jid}]: ${text.slice(0, 80)}`)

      try {
        await sock.sendPresenceUpdate('composing', jid)
        const response = await askClaude(text, jid, imageBase64, imageMime)

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
