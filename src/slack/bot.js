require('dotenv').config()
const { App } = require('@slack/bolt')
const https = require('https')
const http = require('http')
const { askClaude } = require('../claude/handler')

function startSlackBot() {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
    console.log('Slack skipped — SLACK_BOT_TOKEN or SLACK_APP_TOKEN not set')
    return
  }

  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true
  })

  // Download a Slack file given its URL (requires bot token auth)
  function downloadSlackFile(url) {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http
      lib.get(url, { headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` } }, res => {
        const chunks = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks)))
        res.on('error', reject)
      }).on('error', reject)
    })
  }

  async function extractFileText(buffer, mimetype, filename) {
    const mime = mimetype || ''
    const name = filename || ''
    try {
      if (mime.includes('pdf') || name.match(/\.pdf$/i)) {
        const pdfParse = require('pdf-parse')
        const data = await pdfParse(buffer)
        return data.text?.replace(/\s+/g, ' ').trim().slice(0, 10000) || ''
      }
      if (mime.includes('wordprocessingml') || mime.includes('msword') || name.match(/\.docx?$/i)) {
        const mammoth = require('mammoth')
        const result = await mammoth.extractRawText({ buffer })
        return result.value?.replace(/\s+/g, ' ').trim().slice(0, 10000) || ''
      }
      if (mime.includes('spreadsheetml') || mime.includes('excel') || name.match(/\.xlsx?$/i)) {
        const XLSX = require('xlsx')
        const wb = XLSX.read(buffer, { type: 'buffer' })
        return wb.SheetNames.map(n => `Sheet: ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n])}`).join('\n\n').slice(0, 10000)
      }
      if (mime.includes('text') || name.match(/\.(txt|md|csv|json|js|ts|py|html|css|xml|yaml|yml|sh)$/i)) {
        return buffer.toString('utf8').slice(0, 10000)
      }
      return `[Binary file: ${name} (${mime}) — ${(buffer.length / 1024).toFixed(1)} KB. Cannot extract text from this format.]`
    } catch (err) {
      return `[File read error: ${err.message}]`
    }
  }

  async function handleMessage(text, files, userId, channel, thread_ts) {
    let prompt = text || ''

    if (files && files.length > 0) {
      for (const file of files) {
        try {
          const url = file.url_private_download || file.url_private
          if (!url) continue
          const buffer = await downloadSlackFile(url)
          const extracted = await extractFileText(buffer, file.mimetype, file.name)
          prompt = `[FILE: ${file.name}]\n${extracted}\n\nUser instruction: ${prompt || 'Analyse this file and summarise its content.'}`
          console.log(`Slack file: ${file.name} (${file.mimetype}) extracted ${extracted.length} chars`)
        } catch (err) {
          console.error('Slack file download error:', err.message)
          prompt += `\n[Could not read file ${file.name}: ${err.message}]`
        }
      }
    }

    if (!prompt.trim()) return

    console.log(`Slack [${userId}]: ${prompt.slice(0, 100)}`)
    try {
      const response = await askClaude(prompt, `slack_${userId}`)
      await app.client.chat.postMessage({
        channel,
        text: response,
        ...(thread_ts ? { thread_ts } : {})
      })
    } catch (err) {
      await app.client.chat.postMessage({ channel, text: `Error: ${err.message}`, ...(thread_ts ? { thread_ts } : {}) })
    }
  }

  // Direct messages and channel messages (with or without files)
  app.message(async ({ message, client }) => {
    if (message.subtype === 'bot_message' || message.bot_id) return
    const text = message.text || ''
    const files = message.files || []
    if (!text.trim() && files.length === 0) return
    await handleMessage(text, files, message.user, message.channel, null)
  })

  // @mentions in channels
  app.event('app_mention', async ({ event, client }) => {
    const text = (event.text || '').replace(/<@[^>]+>/g, '').trim()
    const files = event.files || []
    if (!text && files.length === 0) return
    await handleMessage(text, files, event.user, event.channel, event.ts)
  })

  // Handle file_shared events (when Slack sends file before message processes)
  app.event('file_shared', async ({ event }) => {
    // Files are handled via the message event which includes file metadata
    // This event is a no-op — just prevents unhandled event warnings
  })

  app.start()
    .then(() => console.log('Slack bot connected'))
    .catch(err => console.error('Slack error:', err.message))
}

module.exports = { startSlackBot }
