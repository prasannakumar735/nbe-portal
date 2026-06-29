import type { SalesContactType } from '@/lib/sales/types/contactSources'

const PREFIX_TYPE: Array<{ pattern: RegExp; type: SalesContactType }> = [
  { pattern: /^sales/i, type: 'sales' },
  { pattern: /^support/i, type: 'support' },
  { pattern: /^manager/i, type: 'manager' },
  { pattern: /^operations/i, type: 'operations' },
  { pattern: /^maintenance/i, type: 'maintenance' },
  { pattern: /^(info|contact|admin|enquir|inquir)/i, type: 'general' },
]

export function classifyContactFromEmail(email: string): SalesContactType {
  const local = email.split('@')[0]?.trim() ?? ''
  for (const rule of PREFIX_TYPE) {
    if (rule.pattern.test(local)) return rule.type
  }
  return 'unknown'
}

export function normalizeEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (email.endsWith('.png') || email.endsWith('.jpg')) return null
  return email
}
