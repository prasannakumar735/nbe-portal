/** Prefer current-style IDs like P0823; fall back to legacy PJ####; otherwise any P####. */
export function extractDoorSerial(label: string): string | null {
  const raw = String(label ?? '')
  if (!raw.trim()) return null

  const pLeadingZero = raw.match(/\bP0\d+\b/i)?.[0]
  if (pLeadingZero) return pLeadingZero.toUpperCase()

  const spaced = raw.match(/\bP\s+0*\d+\b/i)?.[0]
  if (spaced) return spaced.replace(/\s+/g, ' ').trim().toUpperCase()

  const pj = raw.match(/\bPJ\d+\b/i)?.[0]
  if (pj) return pj.toUpperCase()

  const p = raw.match(/\bP\d+\b/i)?.[0]
  return p ? p.toUpperCase() : null
}

/** Display like reference art: "P 0940" when compact form is P0940. */
export function formatDoorSerialForLabel(serial: string): string {
  const compact = serial.replace(/\s+/g, '').toUpperCase()
  const pMatch = compact.match(/^P(0*\d+)$/)
  if (pMatch) {
    const digits = pMatch[1]
    return `P ${digits}`
  }
  return serial.trim()
}

/** Digits (and legacy J…) after the leading P on the label; template already prints "Serial No. P". */
export function buildDoorSerialSuffix(doorLabel: string): string {
  const serial = extractDoorSerial(doorLabel)
  if (!serial) return ''

  const compact = serial.replace(/\s+/g, '').toUpperCase()
  if (!compact.startsWith('P') || compact.length <= 1) return ''

  return compact.slice(1)
}

export function buildDoorSerialLine(doorLabel: string): string {
  const suffix = buildDoorSerialSuffix(doorLabel)
  if (!suffix) return ''
  return `Serial No. P ${suffix}`
}
