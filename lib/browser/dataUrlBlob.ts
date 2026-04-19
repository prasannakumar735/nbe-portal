/**
 * Convert a data URL to a Blob without using `fetch(dataUrl)`, which is blocked
 * under strict CSP `connect-src` unless `data:` is explicitly allowed.
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const trimmed = dataUrl.trim()
  if (!trimmed.startsWith('data:')) {
    throw new Error('Invalid data URL')
  }
  const comma = trimmed.indexOf(',')
  if (comma < 0) {
    throw new Error('Invalid data URL')
  }
  const meta = trimmed.slice('data:'.length, comma)
  const payload = trimmed.slice(comma + 1)
  const isBase64 = /;base64/i.test(meta)
  const mimeMatch = meta.match(/^([^;]+)/)
  const mime = (mimeMatch?.[1] || 'application/octet-stream').trim() || 'application/octet-stream'

  if (isBase64) {
    const binary = atob(payload.replace(/\s/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes], { type: mime })
  }

  const decoded = decodeURIComponent(payload)
  return new Blob([decoded], { type: mime })
}
