import express from 'express'
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const app = express()
const port = Number(process.env.PROXY_PORT ?? 3001)
const maxBytes = 12 * 1024 * 1024
app.use(express.json({ limit: '1mb' }))

function isPrivateAddress(address: string) {
  const version = isIP(address)
  if (version === 4) {
    const octets = address.split('.').map(Number)
    return octets[0] === 0 || octets[0] === 10 || octets[0] === 127 || (octets[0] === 169 && octets[1] === 254) || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) || (octets[0] === 192 && octets[1] === 168) || octets[0] >= 224
  }
  const normalized = address.toLowerCase()
  return normalized === '::1' || normalized === '::' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:') || normalized.startsWith('::ffff:127.') || normalized.startsWith('::ffff:10.')
}

async function assertPublicUrl(value: string) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Only public HTTP and HTTPS URLs are supported.')
  if (url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local')) throw new Error('Private network addresses are not available.')
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true, verbatim: true })
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) throw new Error('Private network addresses are not available.')
  return url
}

function proxyUrl(url: URL) {
  return `/api/proxy?url=${encodeURIComponent(url.href)}`
}

function rewriteCss(css: string, base: URL) {
  const rewrite = (value: string) => {
    const url = value.trim()
    if (!url || /^(?:data:|#|blob:|javascript:)/i.test(url)) return url
    try { return proxyUrl(new URL(url, base)) } catch { return '' }
  }
  return css
    .replace(/url\(\s*(?:(["'])(.*?)\1|([^)]*?))\s*\)/gi, (_match, _quote: string, quoted: string, bare: string) => `url("${rewrite(quoted ?? bare ?? '')}")`)
    .replace(/@import\s+(?:url\(\s*)?(?:(["'])(.*?)\1|([^\s;)]+))\s*\)?/gi, (_match, _quote: string, quoted: string, bare: string) => `@import url("${rewrite(quoted ?? bare ?? '')}")`)
}

function rewriteHtml(html: string, base: URL) {
  const rewriteUrl = (value: string) => {
    if (/^(?:#|data:|javascript:|mailto:|tel:|blob:)/i.test(value)) return value
    try { return proxyUrl(new URL(value, base)) } catch { return '#' }
  }
  const rewriteSrcset = (value: string) => value.trimStart().startsWith('data:') ? value : value.split(',').map((candidate) => {
    const match = candidate.trim().match(/^(\S+)(\s+.*)?$/)
    return match ? `${rewriteUrl(match[1])}${match[2] ?? ''}` : candidate
  }).join(', ')

  return html
    .replace(/<meta\b[^>]*http-equiv\s*=\s*(["'])content-security-policy\1[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/\b(href|src|action|poster|data|srcset|style)\s*=\s*(?:(["'])(.*?)\2|([^\s>]+))/gi, (_match, attribute: string, quote: string | undefined, quoted: string | undefined, bare: string | undefined) => {
      const value = quoted ?? bare ?? ''
      const rewritten = attribute.toLowerCase() === 'style' ? rewriteCss(value, base) : attribute.toLowerCase() === 'srcset' ? rewriteSrcset(value) : rewriteUrl(value)
      return `${attribute}="${rewritten}"`
    })
    .replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (_match, attributes: string, css: string) => `<style${attributes}>${rewriteCss(css, base)}</style>`)
    .replace(/<head(\s[^>]*)?>/i, (head) => `${head}<meta name="referrer" content="no-referrer">`)
}

app.post('/api/assistant', async (request, response) => {
  const apiKey = request.get('x-groq-api-key')
  if (!apiKey || apiKey.length > 512) { response.status(401).json({ error: 'Add a valid Groq API key in Mac Assistant settings.' }); return }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    })
    response.status(upstream.status)
    response.setHeader('Content-Type', upstream.headers.get('content-type') ?? 'application/json')
    response.send(await upstream.text())
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'Groq request timed out.' : 'Could not reach Groq. Check the server connection and try again.'
    response.status(502).json({ error: message })
  } finally { clearTimeout(timeout) }
})

app.post('/api/assistant/transcribe', express.raw({ type: 'audio/*', limit: '16mb' }), async (request, response) => {
  const apiKey = request.get('x-groq-api-key')
  if (!apiKey || apiKey.length > 512) { response.status(401).json({ error: 'Add a valid Groq API key in Mac Assistant settings.' }); return }
  if (!Buffer.isBuffer(request.body) || request.body.length === 0) { response.status(400).json({ error: 'No voice recording was received.' }); return }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 60000)
  try {
    const contentType = request.get('content-type')?.split(';')[0] ?? 'audio/webm'
    const extension = contentType.includes('ogg') ? 'ogg' : contentType.includes('mp4') ? 'm4a' : contentType.includes('wav') ? 'wav' : contentType.includes('mpeg') ? 'mp3' : 'webm'
    const form = new FormData()
    form.append('model', 'whisper-large-v3-turbo')
    form.append('response_format', 'json')
    form.append('file', new Blob([new Uint8Array(request.body)], { type: contentType }), `voice-command.${extension}`)
    const upstream = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    })
    const data = await upstream.json()
    response.status(upstream.status).json(data)
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'Voice transcription timed out.' : 'Could not transcribe this recording with Groq.'
    response.status(502).json({ error: message })
  } finally { clearTimeout(timeout) }
})

app.get('/api/proxy', async (request, response) => {
  const initialUrl = request.query.url
  if (typeof initialUrl !== 'string' || initialUrl.length > 4096) { response.status(400).type('text/plain').send('A valid URL is required.'); return }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 18000)
  try {
    let target = await assertPublicUrl(initialUrl)
    let upstream: Response | undefined
    for (let hop = 0; hop < 6; hop++) {
      upstream = await fetch(target, { redirect: 'manual', signal: controller.signal, headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Mac-NO-S/1.0)', Accept: request.get('accept') ?? '*/*' } })
      if (![301, 302, 303, 307, 308].includes(upstream.status)) break
      const location = upstream.headers.get('location')
      if (!location) break
      target = await assertPublicUrl(new URL(location, target).href)
    }
    if (!upstream) throw new Error('The remote site returned no response.')
    if (upstream.status >= 300 && upstream.status < 400) { response.status(502).type('text/plain').send('The website redirected too many times.'); return }
    const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
    const declaredLength = Number(upstream.headers.get('content-length') ?? 0)
    if (declaredLength > maxBytes) { response.status(413).type('text/plain').send('This page is too large to display.'); return }
    const data = Buffer.from(await upstream.arrayBuffer())
    if (data.byteLength > maxBytes) { response.status(413).type('text/plain').send('This page is too large to display.'); return }
    response.setHeader('Content-Type', contentType)
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('Referrer-Policy', 'no-referrer')
    if (/^(?:font\/|application\/(?:font-|x-font-|vnd\.ms-fontobject))/i.test(contentType)) {
      response.setHeader('Access-Control-Allow-Origin', 'null')
      response.setHeader('Vary', 'Origin')
    }
    if (contentType.includes('text/html')) response.status(upstream.status).send(rewriteHtml(data.toString('utf8'), target))
    else if (contentType.includes('text/css')) response.status(upstream.status).send(rewriteCss(data.toString('utf8'), target))
    else response.status(upstream.status).send(data)
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'The website took too long to respond.' : error instanceof Error ? error.message : 'The remote website could not be reached.'
    response.status(502).type('text/plain').send(message)
  } finally { clearTimeout(timeout) }
})

app.get('/api/assistant/models', async (request, response) => {
  const apiKey = request.get('x-groq-api-key')
  if (!apiKey || apiKey.length > 512) { response.status(401).json({ error: 'Add a valid Groq API key in Mac Assistant settings.' }); return }
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/models', {
      signal: controller.signal,
      headers: { Authorization: `Bearer ${apiKey}` },
    })
    const data = await upstream.json()
    if (!upstream.ok) { response.status(upstream.status).json(data); return }
    const models = (Array.isArray(data.data) ? data.data : [])
      .filter((model: { id?: unknown; active?: unknown }) => typeof model.id === 'string' && model.active !== false && !/(?:whisper|embed|guard|tts|audio)/i.test(model.id))
      .map((model: { id: string; context_window?: number }) => ({ id: model.id, contextWindow: model.context_window }))
      .sort((first: { id: string }, second: { id: string }) => first.id.localeCompare(second.id))
    response.json({ models })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'Groq model discovery timed out.' : 'Could not load Groq models. Check the server connection and API key.'
    response.status(502).json({ error: message })
  } finally { clearTimeout(timeout) }
})

app.listen(port, '0.0.0.0', () => console.log(`Safari proxy listening at http://localhost:${port}`))