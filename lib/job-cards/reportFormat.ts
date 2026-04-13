import { shortRouteLabel } from '@/lib/reports/gpsDisplay'

/**
 * Reports-safe label for job GPS (suburb / route style — no raw coordinates).
 */
export function formatJobGpsForReport(startAddress: string | null | undefined, endAddress: string | null | undefined) {
  return shortRouteLabel(startAddress ?? '', endAddress ?? '')
}
