require('dotenv').config()
const { App } = require('@slack/bolt')
const { askClaude } = require('../claude/handler')

function startSlackBot() {
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_APP_TOKEN) {
    console.log('⚠️  Slack skipped — SLACK_BOT_TOKEN or SLACK_APP_TOKEN not set')
    return
  }

  const app = new App({
    token: process.env.SLACK_BOT_TOKEN,
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true
  })

  // respond to direct messages
  app.message(async ({ message, say }) => {
    if (message.subtype) return
    if (!message.text) return
    console.log(`📨 Slack [${message.user}]: ${message.text.slice(0, 80)}`)
    try {
      const response = await askClaude(message.text, `slack_${message.user}`)
      await say(response)
    } catch (err) {
      await say('❌ ' + err.message)
    }
  })

  // respond to @mentions in channels
  app.event('app_mention', async ({ event, say }) => {
    const text = event.text.replace(/<@[^>]+>/g, '').trim()
    if (!text) return
    console.log(`📨 Slack mention [${event.user}]: ${text.slice(0, 80)}`)
    try {
      const response = await askClaude(text, `slack_${event.user}`)
      await say({ text: response, thread_ts: event.ts })
    } catch (err) {
      await say({ text: '❌ ' + err.message, thread_ts: event.ts })
    }
  })

  app.start().then(() => console.log('✅ Slack bot connected'))
    .catch(err => console.error('❌ Slack error:', err.message))
}

module.exports = { startSlackBot }
