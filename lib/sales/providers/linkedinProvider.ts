import type { BusinessProvider } from '@/lib/sales/providers/businessProvider.interface'

/** Phase 2+: LinkedIn company search (compliant API only). */
export const linkedinBusinessProvider: BusinessProvider = {
  providerId: 'linkedin',
  async searchBusinesses() {
    throw new Error('linkedin provider is not configured.')
  },
}
