import { generateVCard } from '@/lib/generateVCard'
import type { Contact, ContactInput } from '@/lib/types/contact.types'

const FALLBACK_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || ''

export function getContactDisplayName(contact: Pick<ContactInput, 'first_name' | 'last_name'>): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact'
}

export function buildContactUrl(slug: string): string {
  if (!FALLBACK_BASE_URL) return `/contact/${slug}`
  return `${FALLBACK_BASE_URL.replace(/\/$/, '')}/contact/${slug}`
}

export function getContactQrPayload(
  contact: Pick<
    Contact,
    | 'slug'
    | 'qr_type'
    | 'first_name'
    | 'last_name'
    | 'company'
    | 'title'
    | 'phone'
    | 'email'
    | 'website'
    | 'street'
    | 'city'
    | 'state'
    | 'postcode'
    | 'country'
  >
): string {
  if (contact.qr_type === 'vcard') {
    return generateVCard(contact)
  }

  return buildContactUrl(contact.slug)
}
