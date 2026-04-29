require('dotenv').config()
const { Client, GatewayIntentBits } = require('discord.js')
const { askClaude } = require('../claude/handler')

function startDiscordBot() {
  if (!process.env.DISCORD_BOT_TOKEN) {
    console.log('⚠️  Discord skipped — DISCORD_BOT_TOKEN not set')
    return
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent
    ]
  })

  client.on('ready', () => {
    console.log(`✅ Discord bot connected as ${client.user.tag}`)
  })

  client.on('messageCreate', async message => {
    if (message.author.bot) return

    const isDM = message.channel.type === 1
    const isMentioned = message.mentions.has(client.user)

    if (!isDM && !isMentioned) return

    const text = message.content.replace(/<@[^>]+>/g, '').trim()
    if (!text) return

    console.log(`📨 Discord [${message.author.tag}]: ${text.slice(0, 80)}`)

    try {
      await message.channel.sendTyping()
      const response = await askClaude(text, `discord_${message.author.id}`)
      // Discord has 2000 char limit — split if needed
      if (response.length <= 2000) {
        await message.reply(response)
      } else {
        const chunks = response.match(/.{1,1990}/gs) || []
        for (const chunk of chunks) await message.channel.send(chunk)
      }
    } catch (err) {
      await message.reply('❌ ' + err.message)
    }
  })

  client.login(process.env.DISCORD_BOT_TOKEN)
    .catch(err => console.error('❌ Discord error:', err.message))
}

module.exports = { startDiscordBot }
