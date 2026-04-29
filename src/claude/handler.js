require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
const maxLength = parseInt(process.env.MAX_RESPONSE_LENGTH || '4000')

async function askClaude(prompt) {
  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    system: 'You are Claude, an AI assistant connected to WhatsApp. Keep responses clear and concise. If the response is long, summarise key points first.',
    messages: [{ role: 'user', content: prompt }]
  })

  const text = message.content[0].text
  return text.length > maxLength ? text.slice(0, maxLength) + '\n\n[Response truncated]' : text
}

module.exports = { askClaude }
