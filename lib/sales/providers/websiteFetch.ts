const MAX_HTML_BYTES = 512_000
/** Per-request timeout; failed/ slow pages return null and the crawl continues. */
export const FETCH_TIMEOUT_MS = 8_000
const USER_AGENT = 'NBE-Sales-Engine-ContactBot/1.0 (+https://nbe.com.au)'

export function assertPublicWebsiteUrl(raw: string): URL {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    throw new Error('Invalid website URL.')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Website must use HTTP or HTTPS.')
  }
  const host = url.hostname.toLowerCase()
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host.endsWith('.local') ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    throw new Error('Website host is not allowed.')
  }
  return url
}

export function normalizeWebsiteUrl(raw: string): string {
  const trimmed = raw.trim()
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
  return assertPublicWebsiteUrl(withScheme).toString()
}

export const MAX_CONTACT_HUB_PAGES = 6
export const MAX_CONTACT_BRANCH_PAGES = 10
export const MAX_CONTACT_SCAN_PAGES = 1 + MAX_CONTACT_HUB_PAGES + MAX_CONTACT_BRANCH_PAGES

/** Returns HTML or null on timeout, HTTP error, or non-HTML response. */
export async function fetchHtmlPage(url: string): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null
    }
    const buf = await res.arrayBuffer()
    if (buf.byteLength > MAX_HTML_BYTES) return null
    return new TextDecoder('utf-8', { fatal: false }).decode(buf)
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export const EMAIL_PATTERN =
  /\b[A-Za-z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}\b/g

export const PHONE_PATTERN =
  /(?:\+?61|0)[\s.-]?(?:2|3|4|7|8)[\s.-]?\d{4}[\s.-]?\d{4}\b/g
