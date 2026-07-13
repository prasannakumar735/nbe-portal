import type { BusinessProvider } from '@/lib/sales/providers/businessProvider.interface'
import {
  GooglePlacesProviderError,
  searchGooglePlacesBusinesses,
} from '@/lib/sales/providers/googlePlacesProvider'

/**
 * Registry adapter for Google Places API (New). Requires server-side GOOGLE_MAPS_API_KEY.
 */
export const googleMapsBusinessProvider: BusinessProvider = {
  providerId: 'google_maps',

  async searchBusinesses(postcode, categories) {
    try {
      return await searchGooglePlacesBusinesses(postcode, categories)
    } catch (error) {
      if (error instanceof GooglePlacesProviderError) {
        throw error
      }
      throw new GooglePlacesProviderError(
        error instanceof Error ? error.message : 'Google Places search failed.',
      )
    }
  },
}

export { GooglePlacesProviderError } from '@/lib/sales/providers/googlePlacesProvider'
