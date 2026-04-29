const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const https = require('https')

const ALLOWED_PATHS = [
  'D:/claude-projects',
  'C:/revit-claude',
  'D:/portfolio'
]

function isAllowedPath(filePath) {
  const resolved = path.resolve(filePath).replace(/\\/g, '/')
  return ALLOWED_PATHS.some(p => resolved.startsWith(p.replace(/\\/g, '/')))
}

// ── File system ────────────────────────────────────────────
function read_file({ file_path }) {
  if (!isAllowedPath(file_path)) return `Access denied: outside allowed directories.`
  try { return fs.readFileSync(file_path, 'utf8').slice(0, 8000) }
  catch (err) { return `Error: ${err.message}` }
}

function list_directory({ dir_path }) {
  if (!isAllowedPath(dir_path)) return `Access denied: outside allowed directories.`
  try {
    return fs.readdirSync(dir_path, { withFileTypes: true })
      .map(i => `${i.isDirectory() ? '[DIR]' : '[FILE]'} ${i.name}`).join('\n')
  } catch (err) { return `Error: ${err.message}` }
}

function write_file({ file_path, content }) {
  if (!isAllowedPath(file_path)) return `Access denied: outside allowed directories.`
  try {
    fs.mkdirSync(path.dirname(file_path), { recursive: true })
    fs.writeFileSync(file_path, content, 'utf8')
    return `Written: ${file_path}`
  } catch (err) { return `Error: ${err.message}` }
}

// ── Shell ──────────────────────────────────────────────────
function run_command({ command, cwd }) {
  const blocked = ['rm -rf', 'del /f', 'format', 'shutdown', 'rmdir /s']
  if (blocked.some(b => command.toLowerCase().includes(b))) return `Blocked: destructive command.`
  try {
    const out = execSync(command, { cwd: cwd || 'D:/claude-projects', timeout: 30000, encoding: 'utf8' })
    return out.slice(0, 3000) || '(no output)'
  } catch (err) { return `Error: ${err.message.slice(0, 800)}` }
}

function get_project_status({ project_name }) {
  const map = {
    urbanmatrix: 'D:/claude-projects/portfolio', portfolio: 'D:/claude-projects/portfolio',
    revit: 'C:/revit-claude', 'revit-claude': 'C:/revit-claude',
    'message-app': 'D:/claude-projects/message-app-integration',
    whatsapp: 'D:/claude-projects/message-app-integration'
  }
  const p = map[project_name.toLowerCase()]
  if (!p) return `Unknown project. Options: urbanmatrix, revit, message-app`
  try {
    const log = execSync('git log --oneline -5', { cwd: p, encoding: 'utf8', timeout: 5000 }).trim()
    const status = execSync('git status --short', { cwd: p, encoding: 'utf8', timeout: 5000 }).trim()
    return `Path: ${p}\n\nRecent commits:\n${log || 'none'}\n\nChanged files:\n${status || 'clean'}`
  } catch (err) { return `Path: ${p}\n${err.message}` }
}

// ── Image generation (DALL-E 3) ────────────────────────────
function generate_image({ prompt, size }) {
  const key = process.env.OPENAI_API_KEY
  if (!key) return `ERROR: OPENAI_API_KEY not set in .env`

  const body = JSON.stringify({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: size || '1024x1024',
    response_format: 'url'
  })

  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'Content-Length': Buffer.byteLength(body)
      }
    }, res => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.data?.[0]?.url || `Error: ${data}`)
        } catch { resolve(`Parse error: ${data.slice(0, 200)}`) }
      })
    })
    req.on('error', err => resolve(`Request error: ${err.message}`))
    req.write(body)
    req.end()
  })
}

// ── HTML / document generation ─────────────────────────────
function generate_html({ content, file_name }) {
  const outPath = path.join('D:/claude-projects/message-app-integration/generated', file_name || 'output.html')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, content, 'utf8')
  return `GENERATED_FILE:${outPath}`
}

function generate_text_file({ content, file_name }) {
  const outPath = path.join('D:/claude-projects/message-app-integration/generated', file_name || 'output.txt')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, content, 'utf8')
  return `GENERATED_FILE:${outPath}`
}

// ── GitHub ─────────────────────────────────────────────────
function github({ command, cwd }) {
  try {
    const out = execSync(`gh ${command}`, { cwd: cwd || 'D:/claude-projects', timeout: 20000, encoding: 'utf8' })
    return out.slice(0, 3000) || '(done)'
  } catch (err) { return `gh error: ${err.message.slice(0, 800)}` }
}

// ── Vercel ─────────────────────────────────────────────────
function vercel_deploy({ project_path, production }) {
  const flag = production ? '--prod' : ''
  try {
    const out = execSync(`npx vercel ${flag} --yes`, { cwd: project_path || 'D:/claude-projects/portfolio', timeout: 120000, encoding: 'utf8' })
    return out.slice(0, 2000)
  } catch (err) { return `Deploy error: ${err.message.slice(0, 800)}` }
}

// ── Web search (DuckDuckGo instant) ───────────────────────
function web_search({ query }) {
  try {
    const encoded = encodeURIComponent(query)
    const out = execSync(`curl -s "https://api.duckduckgo.com/?q=${encoded}&format=json&no_html=1&skip_disambig=1"`, { timeout: 10000, encoding: 'utf8' })
    const json = JSON.parse(out)
    const results = []
    if (json.AbstractText) results.push(`Summary: ${json.AbstractText}`)
    if (json.RelatedTopics?.length) {
      json.RelatedTopics.slice(0, 5).forEach(t => {
        if (t.Text) results.push(`• ${t.Text}`)
      })
    }
    return results.length ? results.join('\n') : `No instant results. Try: https://duckduckgo.com/?q=${encoded}`
  } catch (err) { return `Search error: ${err.message}` }
}

function scrape_url({ url }) {
  try {
    const out = execSync(`curl -s -L --max-time 10 -A "Mozilla/5.0" "${url}"`, { timeout: 15000, encoding: 'utf8' })
    // strip HTML tags
    const text = out.replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    return text.slice(0, 5000)
  } catch (err) { return `Scrape error: ${err.message}` }
}

// ── Tool definitions for Claude ────────────────────────────
const TOOL_DEFINITIONS = [
  {
    name: 'read_file',
    description: 'Read contents of a file on the local machine',
    input_schema: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'] }
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory',
    input_schema: { type: 'object', properties: { dir_path: { type: 'string' } }, required: ['dir_path'] }
  },
  {
    name: 'write_file',
    description: 'Write or create a file on the local machine',
    input_schema: { type: 'object', properties: { file_path: { type: 'string' }, content: { type: 'string' } }, required: ['file_path', 'content'] }
  },
  {
    name: 'run_command',
    description: 'Run a shell command (git, npm, node, python, etc.) on the local machine',
    input_schema: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] }
  },
  {
    name: 'get_project_status',
    description: 'Get git status and recent commits for a project',
    input_schema: { type: 'object', properties: { project_name: { type: 'string' } }, required: ['project_name'] }
  },
  {
    name: 'generate_image',
    description: 'Generate an image using DALL-E 3. Returns a URL. Sizes: 1024x1024, 1792x1024, 1024x1792',
    input_schema: { type: 'object', properties: { prompt: { type: 'string' }, size: { type: 'string' } }, required: ['prompt'] }
  },
  {
    name: 'generate_html',
    description: 'Generate and save an HTML file (web page, report, dashboard). Returns file path.',
    input_schema: { type: 'object', properties: { content: { type: 'string' }, file_name: { type: 'string' } }, required: ['content'] }
  },
  {
    name: 'generate_text_file',
    description: 'Generate and save any text-based file: .txt, .md, .csv, .json, .py, .js, etc.',
    input_schema: { type: 'object', properties: { content: { type: 'string' }, file_name: { type: 'string' } }, required: ['content'] }
  },
  {
    name: 'github',
    description: 'Run a GitHub CLI command: issue list, pr list, repo view, pr create, etc.',
    input_schema: { type: 'object', properties: { command: { type: 'string' }, cwd: { type: 'string' } }, required: ['command'] }
  },
  {
    name: 'vercel_deploy',
    description: 'Deploy a project to Vercel',
    input_schema: { type: 'object', properties: { project_path: { type: 'string' }, production: { type: 'boolean' } }, required: [] }
  },
  {
    name: 'web_search',
    description: 'Search the web for any topic — news, jobs, research, documentation, anything',
    input_schema: { type: 'object', properties: { query: { type: 'string', description: 'Search query' } }, required: ['query'] }
  },
  {
    name: 'scrape_url',
    description: 'Fetch and read the content of any URL or webpage',
    input_schema: { type: 'object', properties: { url: { type: 'string', description: 'URL to fetch' } }, required: ['url'] }
  }
]

function executeTool(name, input) {
  const tools = { read_file, list_directory, write_file, run_command, get_project_status, generate_image, generate_html, generate_text_file, github, vercel_deploy, web_search, scrape_url }
  const fn = tools[name]
  if (!fn) return `Unknown tool: ${name}`
  return fn(input)
}

module.exports = { TOOL_DEFINITIONS, executeTool }
