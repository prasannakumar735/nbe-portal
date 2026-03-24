import type { ContactInput } from '@/lib/types/contact.types'

function escapeVCardValue(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;')
}

function line(label: string, value?: string | null): string | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return `${label}:${escapeVCardValue(trimmed)}`
}

export function generateVCard(
  contact: Pick<
    ContactInput,
    'first_name' | 'last_name' | 'company' | 'title' | 'phone' | 'email' | 'website' | 'street' | 'city' | 'state' | 'postcode' | 'country'
  >
): string {
  const firstName = contact.first_name?.trim() ?? ''
  const lastName = contact.last_name?.trim() ?? ''
  const fullName = [firstName, lastName].filter(Boolean).join(' ')
  const website = contact.website?.trim() ?? ''
  const street = contact.street?.trim() ?? ''
  const city = contact.city?.trim() ?? ''
  const state = contact.state?.trim() ?? ''
  const postcode = contact.postcode?.trim() ?? ''
  const country = contact.country?.trim() ?? ''
  const hasAddress = Boolean(street || city || state || postcode || country)

  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCardValue(lastName)};${escapeVCardValue(firstName)};;;`,
    `FN:${escapeVCardValue(fullName || 'Contact')}`,
    line('ORG', contact.company),
    line('TITLE', contact.title),
    line('TEL;TYPE=CELL', contact.phone),
    line('EMAIL;TYPE=INTERNET', contact.email),
    website ? `URL:${escapeVCardValue(website)}` : null,
    hasAddress
      ? `ADR;TYPE=WORK:;;${escapeVCardValue(street)};${escapeVCardValue(city)};${escapeVCardValue(state)};${escapeVCardValue(postcode)};${escapeVCardValue(country)}`
      : null,
    'END:VCARD',
  ].filter(Boolean)

  return lines.join('\r\n')
}
