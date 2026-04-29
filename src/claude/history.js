const fs = require('fs')
const path = require('path')

const HISTORY_DIR = path.join(__dirname, '../../history')
const MAX_MESSAGES = 8
const MAX_ENTRY_CHARS = 800  // max chars stored per message in history

fs.mkdirSync(HISTORY_DIR, { recursive: true })

function historyFile(userId) {
  return path.join(HISTORY_DIR, `${userId.replace(/[^a-z0-9]/gi, '_')}.json`)
}

function getHistory(userId) {
  const file = historyFile(userId)
  if (!fs.existsSync(file)) return []
  try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return [] }
}

function truncate(content) {
  if (typeof content !== 'string') return '[non-text content]'
  if (content.length <= MAX_ENTRY_CHARS) return content
  return content.slice(0, MAX_ENTRY_CHARS) + '...[truncated]'
}

function addMessage(userId, role, content) {
  let history = getHistory(userId)

  // Strip file content from user messages before storing — keep only the user's question
  let stored = content
  if (role === 'user' && typeof content === 'string') {
    const fileMatch = content.match(/\[FILE:[^\]]+\][\s\S]*?User instruction:\s*(.+)/i)
    if (fileMatch) stored = fileMatch[1].trim()
    const ytMatch = content.match(/\[YOUTUBE:[^\]]+\][\s\S]*?User message:\s*(.+)/i)
    if (ytMatch) stored = ytMatch[1].trim()
  }

  history.push({ role, content: truncate(stored) })

  // Keep only last MAX_MESSAGES, enforce alternating roles to avoid malformed history
  const cleaned = []
  for (const msg of history) {
    if (cleaned.length && cleaned[cleaned.length - 1].role === msg.role) {
      cleaned[cleaned.length - 1] = msg // replace duplicate same-role with latest
    } else {
      cleaned.push(msg)
    }
  }

  const trimmed = cleaned.slice(-MAX_MESSAGES)
  fs.writeFileSync(historyFile(userId), JSON.stringify(trimmed, null, 2))
  return trimmed
}

function clearHistory(userId) {
  const file = historyFile(userId)
  if (fs.existsSync(file)) fs.unlinkSync(file)
}

module.exports = { getHistory, addMessage, clearHistory }
