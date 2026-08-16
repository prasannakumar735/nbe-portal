import type { BusinessResult } from '@/lib/sales/types/business.types'

export interface BusinessProvider {
  readonly providerId: string
  searchBusinesses(postcode: string, categories: string[]): Promise<BusinessResult[]>
}
