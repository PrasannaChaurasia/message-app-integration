require('dotenv').config()
const Anthropic = require('@anthropic-ai/sdk')
const { getHistory, addMessage, clearHistory } = require('./history')
const { TOOL_DEFINITIONS, executeTool } = require('../agent/tools')

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const model = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6'
const maxLength = parseInt(process.env.MAX_RESPONSE_LENGTH || '4000')

const SYSTEM_PROMPT = `You are an autonomous AI agent on Prasanna Chaurasia's Windows machine, accessible via WhatsApp and Slack.

Owner: Prasanna Chaurasia, architectural designer and BIM specialist, Manchester UK, Urban Matrix consultancy.
Tone: professional, direct, no emojis, no filler. Always address him as Prasanna.

PROJECTS ON HIS MACHINE:
- Urbanmatrix portfolio: D:/claude-projects/portfolio (Next.js, TypeScript, Tailwind v4, R3F, GSAP)
- Revit-Claude extension: C:/revit-claude (pyRevit, IronPython 2.7, Claude API)
- Message App: D:/claude-projects/message-app-integration (Node.js, Baileys, Slack Bolt)

TOOLS - use them directly, never say you lack access:
read_file, write_file, list_directory, run_command, get_project_status,
create_presentation (pptx), create_pdf, create_spreadsheet (xlsx), generate_html, generate_text_file,
generate_image (DALL-E 3), fetch_youtube, web_search, scrape_url, github, vercel_deploy, notion

RULES:
1. When asked to create a document, call the generation tool and deliver the actual file
2. File and video content is already embedded in the message - analyse it directly
3. YouTube transcripts are pre-embedded - explain from them without calling fetch_youtube again
4. web_search when you need current information - never say you cannot browse
5. Be concise - messaging interface, not a document editor
6. No emojis, no decorative symbols, plain structured text only
7. Send "clear" to reset history`

const YT_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]{11})/

async function prefetchYouTube(text) {
  const match = text.match(YT_REGEX)
  if (!match) return null
  try {
    const { YoutubeTranscript } = require('youtube-transcript')
    const { execSync } = require('child_process')
    const videoId = match[1]
    const url = `https://www.youtube.com/watch?v=${videoId}`
    let title = ''
    try {
      const raw = execSync(`curl -s -L --max-time 10 -A "Mozilla/5.0" "${url}"`, { timeout: 15000, encoding: 'utf8' })
      const tm = raw.match(/<title>([^<]+)<\/title>/)
      if (tm) title = tm[1].replace(' - YouTube', '').trim()
    } catch {}
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    const transcript = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim()
    return `[YOUTUBE: ${title || videoId}]\n${transcript.slice(0, 4000)}`
  } catch {
    return null
  }
}

// Retry Claude API call with backoff on rate limit (429)
async function callClaude(params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await client.messages.create(params)
    } catch (err) {
      const is429 = err?.status === 429 || err?.message?.includes('rate_limit')
      if (is429 && i < retries - 1) {
        const wait = (i + 1) * 20000 // 20s, 40s
        console.log(`Rate limit hit — waiting ${wait / 1000}s before retry ${i + 1}`)
        await new Promise(r => setTimeout(r, wait))
      } else {
        throw err
      }
    }
  }
}

async function askClaude(prompt, userId, imageBase64, imageMime) {
  if (['clear', 'reset'].includes(prompt.trim().toLowerCase())) {
    clearHistory(userId)
    return 'Conversation history cleared.'
  }

  // Pre-fetch YouTube transcript and embed it so Claude gets it without a tool call
  let enrichedPrompt = prompt
  if (YT_REGEX.test(prompt)) {
    const ytContext = await prefetchYouTube(prompt)
    if (ytContext) enrichedPrompt = `${ytContext}\n\nUser message: ${prompt}`
  }

  // Build user content - support images (Claude Vision)
  let userContent
  if (imageBase64 && imageMime) {
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: imageMime, data: imageBase64 } },
      { type: 'text', text: enrichedPrompt || 'Analyse this image.' }
    ]
  } else {
    userContent = enrichedPrompt
  }

  addMessage(userId, 'user', prompt)
  const history = getHistory(userId)
  const messages = history.slice(0, -1)
  messages.push({ role: 'user', content: userContent })

  const baseParams = {
    model,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    tools: TOOL_DEFINITIONS,
    messages
  }

  let response = await callClaude(baseParams)

  // Agentic loop
  while (response.stop_reason === 'tool_use') {
    const assistantMsg = { role: 'assistant', content: response.content }
    const toolResults = []

    for (const block of response.content) {
      if (block.type === 'tool_use') {
        console.log(`Tool: ${block.name}`, JSON.stringify(block.input).slice(0, 100))
        const result = await executeTool(block.name, block.input)
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: String(result) })
      }
    }

    messages.push(assistantMsg)
    messages.push({ role: 'user', content: toolResults })

    response = await callClaude({ ...baseParams, messages })
  }

  const text = response.content.find(b => b.type === 'text')?.text || 'No response.'
  addMessage(userId, 'assistant', text)
  return text.length > maxLength ? text.slice(0, maxLength) + '\n\n[truncated — ask for more]' : text
}

module.exports = { askClaude }
