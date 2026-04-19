import { logSecurityEvent } from '@/lib/security/securityLogger'

/**
 * Fired when an IP crosses the failure threshold and receives a temporary ban.
 * Invoked from `ipBlocker` via dynamic import to avoid circular deps with `securityLogger`.
 */
export function notifyIpBanFromRepeatedFailures(ip: string | undefined): void {
  if (!ip?.trim() || ip.trim() === 'unknown') return
  logSecurityEvent('repeated_failures', {
    monitoring: { signal: 'repeated_failures' },
    ip,
    detail: 'threshold_reached_temp_ban',
    http_status_code: 429,
  })
}
