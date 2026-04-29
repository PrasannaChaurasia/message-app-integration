require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const { getHistory, addMessage, clearHistory } = require('./history')
const { TOOL_DEFINITIONS, executeTool } = require('../agent/tools')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
const maxLength = parseInt(process.env.MAX_RESPONSE_LENGTH || '4000')

const SYSTEM_PROMPT = `You are Claude — a fully autonomous AI agent connected directly to Prasanna Chaurasia's local Windows machine via WhatsApp.

IDENTITY:
- Owner: Prasanna Chaurasia (ALWAYS spell exactly this way — never "Prashant" or any variant)
- Architectural designer and BIM specialist, Manchester UK
- Urban Matrix consultancy

ACTIVE PROJECTS (on his machine):
1. Urbanmatrix portfolio — D:/claude-projects/portfolio (Next.js, TypeScript, Tailwind v4, R3F, GSAP)
2. Revit-Claude Extension — C:/revit-claude (pyRevit, IronPython 2.7, Claude API)
3. Message App Integration — D:/claude-projects/message-app-integration (this bot)

YOUR TOOLS — USE THEM, never say you don't have access:
- read_file / write_file / list_directory — file system operations
- run_command — run ANY shell command: git, npm, node, python, curl, gh, vercel
- get_project_status — git log + status for a project
- generate_image — create images with DALL-E 3 (returns URL)
- generate_html / generate_text_file — create files and send as attachments
- web_search — search the web for anything (jobs, news, research, docs)
- scrape_url — read the full content of any URL
- github — GitHub CLI operations (issues, PRs, repos)
- vercel_deploy — deploy to Vercel

RULES:
- ALWAYS use tools when action is needed — never apologise or say you lack access
- Be concise — this is WhatsApp, not a document
- Always call Prasanna by his correct name
- If he sends a file/image, acknowledge it and tell him what you can do with it
- Send "clear" or "reset" to wipe conversation history
- You can search the web, read URLs, check job boards, research anything`

async function askClaude(prompt, userId) {
  if (['clear', 'reset'].includes(prompt.trim().toLowerCase())) {
    clearHistory(userId)
    return '🗑️ Conversation cleared.'
  }

  addMessage(userId, 'user', prompt)
  const messages = getHistory(userId)

  let response = await client.messages.create({
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: TOOL_DEFINITIONS,
    messages
  })

  // agentic loop — keep running tools until Claude gives a final text response
  while (response.stop_reason === 'tool_use') {
    const assistantMessage = { role: 'assistant', content: response.content }
    const toolResults = []

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`🔧 Tool: ${block.name}`, block.input)
        const result = executeTool(block.name, block.input)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: String(result) })
      }
    }

    messages.push(assistantMessage)
    messages.push({ role: 'user', content: toolResults })

    response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      tools: TOOL_DEFINITIONS,
      messages
    })
  }

  const text = response.content.find(b => b.type === 'text')?.text || 'No response.'
  addMessage(userId, 'assistant', text)

  return text.length > maxLength ? text.slice(0, maxLength) + '\n\n[truncated]' : text
}

module.exports = { askClaude }
