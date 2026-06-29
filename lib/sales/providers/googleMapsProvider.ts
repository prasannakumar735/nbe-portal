import type { BusinessProvider } from '@/lib/sales/providers/businessProvider.interface'

function notConfigured(providerId: string): BusinessProvider {
  return {
    providerId,
    async searchBusinesses() {
      throw new Error(`${providerId} provider is not configured.`)
    },
  }
}

/** Phase 2+: Google Places / Maps API. */
export const googleMapsBusinessProvider = notConfigured('google_maps')
