const fs = require('fs')
const path = require('path')

const HISTORY_DIR = path.join(__dirname, '../../history')
const MAX_MESSAGES = 20

if (!fs.existsSync(HISTORY_DIR)) fs.mkdirSync(HISTORY_DIR, { recursive: true })

function historyFile(userId) {
  return path.join(HISTORY_DIR, `${userId.replace(/[^a-z0-9]/gi, '_')}.json`)
}

function getHistory(userId) {
  const file = historyFile(userId)
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return [] }
}

function addMessage(userId, role, content) {
  const history = getHistory(userId)
  history.push({ role, content })
  const trimmed = history.slice(-MAX_MESSAGES)
  fs.writeFileSync(historyFile(userId), JSON.stringify(trimmed, null, 2))
  return trimmed
}

function clearHistory(userId) {
  const file = historyFile(userId)
  if (fs.existsSync(file)) fs.unlinkSync(file)
}

module.exports = { getHistory, addMessage, clearHistory }
