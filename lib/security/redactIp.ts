/** Truncate IPv4 / IPv6 for logs (privacy + reduce cardinality). */
export function redactIpForLogs(ip: string): string {
  const t = ip.trim()
  if (!t || t === 'unknown') return 'unknown'
  if (t.includes('.')) {
    const p = t.split('.')
    if (p.length === 4) return `${p[0]}.${p[1]}.x.x`
  }
  if (t.includes(':')) {
    const p = t.split(':').filter(Boolean)
    if (p.length >= 2) return `${p[0]}:${p[1]}:…`
  }
  return '…'
}
