import type { SalesContactType } from '@/lib/sales/types/contactSources'

const LOCAL_TYPE_RULES: Array<{ pattern: RegExp; type: SalesContactType }> = [
  { pattern: /^(sales|enquir|inquir)/i, type: 'sales' },
  { pattern: /sales$/i, type: 'sales' },
  { pattern: /sales/i, type: 'sales' },
  { pattern: /^(support|helpdesk|customerservice|customercare)/i, type: 'support' },
  { pattern: /^(service|services)/i, type: 'support' },
  { pattern: /^(hr|humanresources|people|recruit|career|jobs|employment)/i, type: 'hr' },
  {
    pattern: /^(account|accounts|finance|billing|invoice|credit|payable|receivable|ap|ar)/i,
    type: 'accounts',
  },
  { pattern: /^(procurement|purchasing|buyer|maintenance|operations|ops|manager|director)/i, type: 'operations' },
  { pattern: /^(info|contact|admin|hello|office|reception)/i, type: 'general' },
]

export function classifyContactFromEmail(email: string): SalesContactType {
  const local = email.split('@')[0]?.trim() ?? ''
  for (const rule of LOCAL_TYPE_RULES) {
    if (rule.pattern.test(local)) return rule.type
  }
  if (/credit|finance|account|billing|invoice/i.test(local)) return 'accounts'
  return 'unknown'
}

export function normalizeEmail(raw: string): string | null {
  let decoded = raw.trim()
  try {
    decoded = decodeURIComponent(decoded)
  } catch {
    /* keep raw */
  }
  const email = decoded.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null
  if (email.endsWith('.png') || email.endsWith('.jpg')) return null
  return email
}

export function mailtoLinkLabelBoost(linkLabel: string): number {
  const label = linkLabel.trim().toLowerCase()
  if (/\bemail\s*us\b/.test(label)) return 18
  if (/\bcontact\s*us\b/.test(label)) return 16
  if (/\bcontact\s*sales\b/.test(label)) return 16
  if (/\b(get|request)\s*(a\s*)?quote\b/.test(label)) return 14
  if (/\bsales\b/.test(label)) return 12
  if (/\bsend\s*email\b/.test(label)) return 10
  return 0
}

export function isMailtoLabeled(linkLabel: string): boolean {
  return mailtoLinkLabelBoost(linkLabel) > 0
}
