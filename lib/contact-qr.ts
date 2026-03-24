import { generateVCard } from '@/lib/generateVCard'
import type { Contact, ContactInput } from '@/lib/types/contact.types'

function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }

  if (process.env.VERCEL_URL) {
    return process.env.VERCEL_URL.startsWith('http')
      ? process.env.VERCEL_URL
      : `https://${process.env.VERCEL_URL}`
  }

  return 'http://localhost:3000'
}

export function getContactDisplayName(contact: Pick<ContactInput, 'first_name' | 'last_name'>): string {
  return [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || 'Contact'
}

export function buildContactUrl(slug: string): string {
  const baseUrl = getBaseUrl().replace(/\/$/, '')
  return `${baseUrl}/contact/${slug}`
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
