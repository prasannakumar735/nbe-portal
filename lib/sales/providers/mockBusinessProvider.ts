import type { BusinessProvider } from '@/lib/sales/providers/businessProvider.interface'
import type { BusinessResult } from '@/lib/sales/types/business.types'

const STREET_NAMES = ['Industrial Dr', 'Warehouse Way', 'Distribution Ave', 'Factory Ln', 'Cold Chain Rd'] as const

function suburbFromPostcode(postcode: string): string {
  const n = Number.parseInt(postcode, 10)
  const names = ['West Melbourne', 'Footscray', 'Sunshine', 'Braybrook', 'Laverton', 'Derrimut', 'Truganina']
  return names[n % names.length] ?? 'Melbourne West'
}

function seededIndex(seed: string, salt: number, mod: number): number {
  let h = salt
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0
  }
  return h % mod
}

function buildResult(postcode: string, category: string, index: number): BusinessResult {
  const suburb = suburbFromPostcode(postcode)
  const street = STREET_NAMES[seededIndex(postcode, index + 7, STREET_NAMES.length)]
  const streetNo = 10 + seededIndex(postcode, index + 13, 180)
  const slug = category.replace(/\s+/g, '-').replace(/[^a-z-]/gi, '')
  const companySuffix = ['Pty Ltd', 'Group', 'Operations', 'Australia', 'VIC'][index % 5]

  const company_name = `${suburb.split(' ')[0]} ${category.replace(/\b\w/g, (c) => c.toUpperCase())} ${companySuffix}`
  const address = `${streetNo} ${street}`
  const website = `https://www.${slug}-${postcode}.example`
  const phone = `03 ${9000 + seededIndex(postcode, index, 999)} ${1000 + seededIndex(postcode, index + 3, 8999)}`

  return {
    company_name,
    address,
    suburb,
    postcode,
    website,
    phone,
    category,
    source: 'google_maps',
    raw_payload: {
      provider: 'mock',
      provider_id: 'mock',
      postcode,
      index,
      category,
      place: {
        name: company_name,
        formatted_address: `${address}, ${suburb} VIC ${postcode}`,
        types: [category],
      },
    },
  }
}

export const mockBusinessProvider: BusinessProvider = {
  providerId: 'mock',

  async searchBusinesses(postcode: string, categories: string[]): Promise<BusinessResult[]> {
    const pool = categories.length > 0 ? categories : ['warehouse']
    const count = 3 + seededIndex(postcode, 0, 3)
    const rows: BusinessResult[] = []
    for (let i = 0; i < count; i++) {
      const category = pool[seededIndex(postcode, i, pool.length)] ?? pool[0]
      rows.push(buildResult(postcode, category, i))
    }
    return rows
  },
}
