import type { BusinessProvider } from '@/lib/sales/providers/businessProvider.interface'
import { googleMapsBusinessProvider } from '@/lib/sales/providers/googleMapsProvider'
import { linkedinBusinessProvider } from '@/lib/sales/providers/linkedinProvider'
import { mockBusinessProvider } from '@/lib/sales/providers/mockBusinessProvider'
import { yellowPagesBusinessProvider } from '@/lib/sales/providers/yellowPagesProvider'

const PROVIDERS: Record<string, BusinessProvider> = {
  mock: mockBusinessProvider,
  google_maps: googleMapsBusinessProvider,
  yellow_pages: yellowPagesBusinessProvider,
  linkedin: linkedinBusinessProvider,
}

/**
 * Resolve discovery provider by env. Future: `google_maps`, `yellow_pages`, `linkedin`.
 */
export function getBusinessProvider(): BusinessProvider {
  const id = (process.env.SALES_BUSINESS_PROVIDER ?? 'mock').trim().toLowerCase()
  return PROVIDERS[id] ?? mockBusinessProvider
}

export type { BusinessProvider } from '@/lib/sales/providers/businessProvider.interface'
