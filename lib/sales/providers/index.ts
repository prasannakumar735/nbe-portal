import type { BusinessProvider } from '@/lib/sales/providers/businessProvider.interface'
import { googleMapsBusinessProvider } from '@/lib/sales/providers/googleMapsProvider'

const LOG_PREFIX = '[businessDiscovery]'

/** Business discovery uses Google Places API (New) only. Requires GOOGLE_MAPS_API_KEY. */
export function getBusinessProvider(): BusinessProvider {
  const envOverride = process.env.SALES_BUSINESS_PROVIDER?.trim()
  if (envOverride && envOverride.toLowerCase() !== 'google_maps') {
    console.warn(`${LOG_PREFIX} ignoring SALES_BUSINESS_PROVIDER=${envOverride}; using google_maps (Google Places)`)
  }
  console.info(`${LOG_PREFIX} selected provider`, {
    providerId: googleMapsBusinessProvider.providerId,
    implementation: 'googlePlacesProvider',
  })
  return googleMapsBusinessProvider
}

export type { BusinessProvider } from '@/lib/sales/providers/businessProvider.interface'
