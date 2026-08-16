import type { ContactDiscoveryProvider } from '@/lib/sales/providers/contactDiscoveryProvider.interface'
import { basicWebsiteContactProvider } from '@/lib/sales/providers/basicWebsiteContactProvider'

const PROVIDERS: Record<string, ContactDiscoveryProvider> = {
  basic_website: basicWebsiteContactProvider,
}

export function getContactDiscoveryProvider(): ContactDiscoveryProvider {
  const id = (process.env.SALES_CONTACT_PROVIDER ?? 'basic_website').trim().toLowerCase()
  return PROVIDERS[id] ?? basicWebsiteContactProvider
}
