import type { BusinessProvider } from '@/lib/sales/providers/businessProvider.interface'

/** Phase 2+: Yellow Pages API or licensed feed. */
export const yellowPagesBusinessProvider: BusinessProvider = {
  providerId: 'yellow_pages',
  async searchBusinesses() {
    throw new Error('yellow_pages provider is not configured.')
  },
}
