export const SALES_CONTACT_TYPES = [
  'general',
  'sales',
  'support',
  'operations',
  'accounts',
  'hr',
  'unknown',
] as const

export type SalesContactType = (typeof SALES_CONTACT_TYPES)[number]

/** Maps legacy DB values to canonical types for display and ranking. */
export function normalizeSalesContactType(raw: string): SalesContactType {
  switch (raw) {
    case 'general':
    case 'sales':
    case 'support':
    case 'operations':
    case 'accounts':
    case 'hr':
    case 'unknown':
      return raw
    case 'manager':
    case 'maintenance':
    case 'procurement':
      return 'operations'
    case 'finance':
      return 'accounts'
    case 'careers':
      return 'hr'
    default:
      return 'unknown'
  }
}

export const SALES_CONTACT_SOURCES = [
  'website_scan',
  'manual',
  'linkedin',
  'directory',
] as const

export type SalesContactSource = (typeof SALES_CONTACT_SOURCES)[number]
