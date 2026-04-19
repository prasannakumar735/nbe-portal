/** Used by middleware for distributed rate-limit tiers (defense in depth). */

export type ApiRateLimitTier = 'auth' | 'sensitive' | 'general'

export function getApiRateLimitTier(pathname: string): ApiRateLimitTier {
  if (pathname.startsWith('/api/auth')) return 'auth'
  if (
    pathname.startsWith('/api/job-cards') ||
    pathname.startsWith('/api/clients') ||
    pathname.startsWith('/api/manager/reports') ||
    pathname.startsWith('/api/maintenance/reports')
  ) {
    return 'sensitive'
  }
  return 'general'
}
