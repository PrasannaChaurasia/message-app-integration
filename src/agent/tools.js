require('dotenv').config()
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const https = require('https')

const OUTPUT_DIR = 'D:/claude-projects/message-app-integration/generated'
fs.mkdirSync(OUTPUT_DIR, { recursive: true })

const ALLOWED_PATHS = ['D:/claude-projects', 'C:/revit-claude', 'D:/portfolio']

function isAllowedPath(p) {
  const r = path.resolve(p).replace(/\\/g, '/')
  return ALLOWED_PATHS.some(a => r.startsWith(a.replace(/\\/g, '/')))
}

function outPath(name) { return path.join(OUTPUT_DIR, name) }

// ── File system ────────────────────────────────────────────
function read_file({ file_path }) {
  if (!isAllowedPath(file_path)) return 'Access denied.'
  try { return fs.readFileSync(file_path, 'utf8').slice(0, 6000) }
  catch (e) { return `Error: ${e.message}` }
}

function list_directory({ dir_path }) {
  if (!isAllowedPath(dir_path)) return 'Access denied.'
  try {
    return fs.readdirSync(dir_path, { withFileTypes: true })
      .map(i => `${i.isDirectory() ? '[DIR] ' : '[FILE]'} ${i.name}`).join('\n')
  } catch (e) { return `Error: ${e.message}` }
}

function write_file({ file_path, content }) {
  if (!isAllowedPath(file_path)) return 'Access denied.'
  try {
    fs.mkdirSync(path.dirname(file_path), { recursive: true })
    fs.writeFileSync(file_path, content, 'utf8')
    return `Written: ${file_path}`
  } catch (e) { return `Error: ${e.message}` }
}

// ── Shell ──────────────────────────────────────────────────
function run_command({ command, cwd }) {
  const blocked = ['rm -rf', 'format c', 'shutdown', 'rmdir /s /q c:']
  if (blocked.some(b => command.toLowerCase().includes(b))) return 'Blocked: destructive command.'
  try {
    const out = execSync(command, {
      cwd: cwd || 'D:/claude-projects',
      timeout: 60000,
      encoding: 'utf8',
      shell: 'cmd.exe'
    })
    return out.slice(0, 4000) || '(no output)'
  } catch (e) { return `Error: ${e.message.slice(0, 800)}` }
}

function get_project_status({ project_name }) {
  const map = {
    urbanmatrix: 'D:/claude-projects/portfolio', portfolio: 'D:/claude-projects/portfolio',
    revit: 'C:/revit-claude', 'revit-claude': 'C:/revit-claude',
    'message-app': 'D:/claude-projects/message-app-integration',
    'message-app-integration': 'D:/claude-projects/message-app-integration'
  }
  const p = map[project_name.toLowerCase()]
  if (!p) return 'Unknown project. Use: urbanmatrix, revit, message-app'
  try {
    const log = execSync('git log --oneline -8', { cwd: p, encoding: 'utf8', timeout: 5000 }).trim()
    const status = execSync('git status --short', { cwd: p, encoding: 'utf8', timeout: 5000 }).trim()
    const branch = execSync('git branch --show-current', { cwd: p, encoding: 'utf8', timeout: 5000 }).trim()
    return `Path: ${p}\nBranch: ${branch}\nCommits:\n${log || 'none'}\nChanged:\n${status || 'clean'}`
  } catch (e) { return `${p}\n${e.message}` }
}

// ── Image generation ───────────────────────────────────────
function generate_image({ prompt, size }) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return 'OPENAI_API_KEY not set.'
  const body = JSON.stringify({ model: 'dall-e-3', prompt, n: 1, size: size || '1024x1024', response_format: 'url' })
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com', path: '/v1/images/generations', method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'Content-Length': Buffer.byteLength(body) }
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => {
        try { resolve(JSON.parse(d).data?.[0]?.url || `Error: ${d.slice(0, 200)}`) }
        catch { resolve(`Parse error: ${d.slice(0, 100)}`) }
      })
    })
    req.on('error', e => resolve(`Error: ${e.message}`))
    req.write(body); req.end()
  })
}

// ── PowerPoint ─────────────────────────────────────────────
async function create_presentation({ title, slides, file_name }) {
  try {
    const PptxGenJS = require('pptxgenjs')
    const pptx = new PptxGenJS()
    pptx.layout = 'LAYOUT_WIDE'
    pptx.title = title || 'Presentation'

    const titleSlide = pptx.addSlide()
    titleSlide.background = { color: '0A0A0A' }
    titleSlide.addText(title || 'Presentation', { x: 0.5, y: 1.8, w: '90%', h: 1.2, fontSize: 36, bold: true, color: 'FFFFFF', align: 'center' })
    titleSlide.addText('Urban Matrix — Prasanna Chaurasia', { x: 0.5, y: 3.2, w: '90%', h: 0.5, fontSize: 14, color: '666666', align: 'center', italic: true })

    const slideData = typeof slides === 'string' ? JSON.parse(slides) : slides
    for (const s of slideData) {
      const slide = pptx.addSlide()
      slide.background = { color: '0D0D0D' }
      slide.addText(s.title || '', { x: 0.5, y: 0.3, w: '90%', h: 0.65, fontSize: 22, bold: true, color: 'FFFFFF' })
      slide.addShape(pptx.ShapeType.rect, { x: 0.5, y: 1.05, w: '90%', h: 0.02, fill: { color: '2A2A2A' }, line: { color: '2A2A2A' } })
      const body = Array.isArray(s.body) ? s.body : [s.body || '']
      slide.addText(body.map(b => ({ text: b, options: { bullet: body.length > 1 } })), {
        x: 0.5, y: 1.2, w: '90%', h: 4.8, fontSize: 15, color: 'CCCCCC', valign: 'top', paraSpaceAfter: 6
      })
      if (s.notes) slide.addNotes(s.notes)
    }

    const fileName = file_name || `presentation_${Date.now()}.pptx`
    const filePath = outPath(fileName)
    await pptx.writeFile({ fileName: filePath })
    return `GENERATED_FILE:${filePath}`
  } catch (e) { return `Presentation error: ${e.message}` }
}

// ── PDF ────────────────────────────────────────────────────
async function create_pdf({ title, sections, file_name }) {
  return new Promise((resolve) => {
    try {
      const PDFDocument = require('pdfkit')
      const fileName = file_name || `document_${Date.now()}.pdf`
      const filePath = outPath(fileName)
      const doc = new PDFDocument({ margin: 60, size: 'A4' })
      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)
      doc.fontSize(22).font('Helvetica-Bold').text(title || 'Document', { align: 'center' })
      doc.moveDown(0.5).moveTo(60, doc.y).lineTo(535, doc.y).strokeColor('#CCCCCC').stroke().moveDown(1)
      const sectionData = typeof sections === 'string' ? JSON.parse(sections) : sections
      for (const s of sectionData) {
        if (s.heading) { doc.fontSize(13).font('Helvetica-Bold').fillColor('#000').text(s.heading); doc.moveDown(0.3) }
        if (s.content) { doc.fontSize(11).font('Helvetica').fillColor('#222').text(s.content, { lineGap: 4 }); doc.moveDown(0.8) }
      }
      doc.end()
      stream.on('finish', () => resolve(`GENERATED_FILE:${filePath}`))
      stream.on('error', e => resolve(`PDF error: ${e.message}`))
    } catch (e) { resolve(`PDF error: ${e.message}`) }
  })
}

// ── Spreadsheet ────────────────────────────────────────────
function create_spreadsheet({ sheet_name, headers, rows, file_name }) {
  try {
    const XLSX = require('xlsx')
    const h = typeof headers === 'string' ? JSON.parse(headers) : headers
    const r = typeof rows === 'string' ? JSON.parse(rows) : rows
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.aoa_to_sheet([h, ...r])
    XLSX.utils.book_append_sheet(wb, ws, sheet_name || 'Sheet1')
    const fileName = file_name || `spreadsheet_${Date.now()}.xlsx`
    const filePath = outPath(fileName)
    XLSX.writeFile(wb, filePath)
    return `GENERATED_FILE:${filePath}`
  } catch (e) { return `Spreadsheet error: ${e.message}` }
}

// ── HTML / text ────────────────────────────────────────────
function generate_html({ content, file_name }) {
  try {
    const fp = outPath(file_name || `output_${Date.now()}.html`)
    fs.writeFileSync(fp, content, 'utf8')
    return `GENERATED_FILE:${fp}`
  } catch (e) { return `Error: ${e.message}` }
}

function generate_text_file({ content, file_name }) {
  try {
    const fp = outPath(file_name || `output_${Date.now()}.txt`)
    fs.writeFileSync(fp, content, 'utf8')
    return `GENERATED_FILE:${fp}`
  } catch (e) { return `Error: ${e.message}` }
}

// ── GitHub ─────────────────────────────────────────────────
function github({ command, cwd }) {
  try {
    const out = execSync(`gh ${command}`, { cwd: cwd || 'D:/claude-projects', timeout: 30000, encoding: 'utf8', shell: 'cmd.exe' })
    return out.slice(0, 3000) || '(done)'
  } catch (e) { return `gh error: ${e.message.slice(0, 600)}` }
}

// ── Vercel ─────────────────────────────────────────────────
function vercel_deploy({ project_path, production }) {
  try {
    const out = execSync(`npx vercel ${production ? '--prod' : ''} --yes`, {
      cwd: project_path || 'D:/claude-projects/portfolio',
      timeout: 120000, encoding: 'utf8', shell: 'cmd.exe'
    })
    return out.slice(0, 2000)
  } catch (e) { return `Deploy error: ${e.message.slice(0, 600)}` }
}

// ── Web search ─────────────────────────────────────────────
function web_search({ query }) {
  try {
    const encoded = encodeURIComponent(query)
    const raw = execSync(
      `curl -s -L --max-time 10 -A "Mozilla/5.0" "https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1"`,
      { timeout: 15000, encoding: 'utf8', shell: 'cmd.exe' }
    )
    const json = JSON.parse(raw)
    const out = []
    if (json.AbstractText) out.push(`${json.AbstractText}\n${json.AbstractURL}`)
    if (json.Answer) out.push(`Answer: ${json.Answer}`)
    json.RelatedTopics?.slice(0, 5).forEach(t => { if (t.Text) out.push(`- ${t.Text}`) })
    if (out.length) return out.join('\n\n')
    // Fallback: scrape HTML results
    const html = execSync(
      `curl -s -L --max-time 10 -A "Mozilla/5.0" "https://html.duckduckgo.com/html/?q=${encoded}"`,
      { timeout: 15000, encoding: 'utf8', shell: 'cmd.exe' }
    )
    const snippets = []
    const re = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
    let m
    while ((m = re.exec(html)) && snippets.length < 6) {
      const t = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
      if (t.length > 30) snippets.push(`- ${t}`)
    }
    return snippets.length ? snippets.join('\n') : `No results for: ${query}`
  } catch (e) { return `Search error: ${e.message}` }
}

// ── Scrape URL ─────────────────────────────────────────────
function scrape_url({ url }) {
  try {
    const raw = execSync(
      `curl -s -L --max-time 15 -A "Mozilla/5.0" "${url}"`,
      { timeout: 20000, encoding: 'utf8', shell: 'cmd.exe' }
    )
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
      .replace(/\s+/g, ' ').trim().slice(0, 10000)
  } catch (e) { return `Scrape error: ${e.message}` }
}

// ── YouTube transcript ─────────────────────────────────────
async function fetch_youtube({ url }) {
  try {
    const { YoutubeTranscript } = require('youtube-transcript')
    const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)
    if (!match) return 'Could not extract video ID from URL.'
    const videoId = match[1]
    let title = ''
    try {
      const raw = execSync(`curl -s -L --max-time 10 -A "Mozilla/5.0" "https://www.youtube.com/watch?v=${videoId}"`, { timeout: 15000, encoding: 'utf8', shell: 'cmd.exe' })
      const tm = raw.match(/<title>([^<]+)<\/title>/)
      if (tm) title = tm[1].replace(' - YouTube', '').trim()
    } catch {}
    const segments = await YoutubeTranscript.fetchTranscript(videoId)
    const transcript = segments.map(s => s.text).join(' ').replace(/\s+/g, ' ').trim()
    return `VIDEO: ${title || videoId}\n\nTRANSCRIPT:\n${transcript.slice(0, 10000)}`
  } catch (e) { return `YouTube error: ${e.message}` }
}

// ── Notion ─────────────────────────────────────────────────
async function notion({ action, database_id, page_id, properties }) {
  const token = process.env.NOTION_TOKEN
  if (!token) return 'NOTION_TOKEN not set in .env'
  const req = (method, endpoint, body) => new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null
    const r = https.request({
      hostname: 'api.notion.com', path: `/v1/${endpoint}`, method,
      headers: { Authorization: `Bearer ${token}`, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve(d) } }) })
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
  try {
    if (action === 'query_database') {
      const result = await req('POST', `databases/${database_id}/query`, {})
      const items = result.results?.slice(0, 10).map(p => {
        const t = Object.values(p.properties || {}).find(v => v.type === 'title')?.title?.[0]?.plain_text || p.id
        return `- ${t}`
      }).join('\n')
      return `Notion database:\n${items || 'No items'}`
    }
    if (action === 'create_page') {
      const result = await req('POST', 'pages', { parent: { database_id }, properties })
      return `Created: ${result.url || result.id}`
    }
    if (action === 'get_page') {
      const result = await req('GET', `pages/${page_id}`)
      return JSON.stringify(result, null, 2).slice(0, 2000)
    }
    return 'Actions: query_database, create_page, get_page'
  } catch (e) { return `Notion error: ${e.message}` }
}

// ── Tool definitions (kept concise to save tokens) ─────────
const TOOL_DEFINITIONS = [
  { name: 'read_file', description: 'Read a file from the local machine.', input_schema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] } },
  { name: 'list_directory', description: 'List files and folders in a directory.', input_schema: { type: 'object', properties: { dir_path: { type: 'string' } }, required: ['dir_path'] } },
  { name: 'write_file', description: 'Write or create a file.', input_schema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] } },
  { name: 'run_command', description: 'Run a shell command (git, npm, node, python, curl, etc.) on the local machine via cmd.exe.', input_schema: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] } },
  { name: 'get_project_status', description: 'Get git branch, commits, and status for a project. Names: urbanmatrix, revit, message-app.', input_schema: { type: 'object', properties: { project_name: { type: 'string' } }, required: ['project_name'] } },
  { name: 'generate_image', description: 'Generate an image with DALL-E 3. Returns URL. Sizes: 1024x1024, 1792x1024, 1024x1792.', input_schema: { type: 'object', properties: { prompt: { type: 'string' }, size: { type: 'string' } }, required: ['prompt'] } },
  { name: 'create_presentation', description: 'Create a .pptx PowerPoint file. slides = JSON array of {title, body: [...], notes}.', input_schema: { type: 'object', properties: { title: { type: 'string' }, slides: { type: 'string', description: 'JSON array: [{title, body:[], notes}]' }, file_name: { type: 'string' } }, required: ['title', 'slides'] } },
  { name: 'create_pdf', description: 'Create a .pdf document. sections = JSON array of {heading, content}.', input_schema: { type: 'object', properties: { title: { type: 'string' }, sections: { type: 'string', description: 'JSON array: [{heading, content}]' }, file_name: { type: 'string' } }, required: ['title', 'sections'] } },
  { name: 'create_spreadsheet', description: 'Create a .xlsx Excel file.', input_schema: { type: 'object', properties: { sheet_name: { type: 'string' }, headers: { type: 'string', description: 'JSON array of column headers' }, rows: { type: 'string', description: 'JSON array of arrays' }, file_name: { type: 'string' } }, required: ['headers', 'rows'] } },
  { name: 'generate_html', description: 'Save an HTML file. Returns file path.', input_schema: { type: 'object', properties: { content: { type: 'string' }, file_name: { type: 'string' } }, required: ['content'] } },
  { name: 'generate_text_file', description: 'Save any plain text file (.md, .csv, .json, .py, .js, etc.).', input_schema: { type: 'object', properties: { content: { type: 'string' }, file_name: { type: 'string' } }, required: ['content'] } },
  { name: 'web_search', description: 'Search the web for any topic — news, jobs, prices, research, docs.', input_schema: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
  { name: 'scrape_url', description: 'Fetch and read the text content of any URL.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'fetch_youtube', description: 'Get title and transcript of a YouTube video.', input_schema: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] } },
  { name: 'github', description: 'Run a GitHub CLI command (without the "gh" prefix): issue list, pr create, repo view, etc.', input_schema: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] } },
  { name: 'vercel_deploy', description: 'Deploy a project to Vercel.', input_schema: { type: 'object', properties: { project_path: { type: 'string' }, production: { type: 'boolean' } }, required: [] } },
  { name: 'notion', description: 'Interact with Notion. Actions: query_database, create_page, get_page. Requires NOTION_TOKEN in .env.', input_schema: { type: 'object', properties: { action: { type: 'string' }, database_id: { type: 'string' }, page_id: { type: 'string' }, properties: { type: 'object' } }, required: ['action'] } }
]

async function executeTool(name, input) {
  const map = { read_file, list_directory, write_file, run_command, get_project_status, generate_image, create_presentation, create_pdf, create_spreadsheet, generate_html, generate_text_file, web_search, scrape_url, fetch_youtube, github, vercel_deploy, notion }
  const fn = map[name]
  if (!fn) return `Unknown tool: ${name}`
  const result = fn(input)
  return result instanceof Promise ? await result : result
}

module.exports = { TOOL_DEFINITIONS, executeTool }
