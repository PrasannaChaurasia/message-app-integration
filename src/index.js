require('dotenv').config()
const { startWhatsAppBot } = require('./whatsapp/bot')

console.log('🚀 Starting Claude Message App Integration...')
console.log(`   Model : ${process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'}`)
console.log(`   Prefix: ${process.env.COMMAND_PREFIX || '(none — all messages processed)'}`)
console.log(`   Access: ${process.env.ALLOWED_NUMBERS || '(all contacts allowed)'}`)
console.log('')

startWhatsAppBot()
