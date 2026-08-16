/**
 * Normalise an email address for suppression matching.
 *
 * Lowercase + trim only. Deliberately does NOT apply provider-specific tricks
 * (stripping Gmail dots, cutting +tags): business mailboxes on custom domains
 * can treat those as distinct addresses, and over-normalising would suppress
 * addresses the recipient never opted out.
 */
export function normalizeEmailForSuppression(email: string): string {
  return email.trim().toLowerCase()
}

export function isLikelyEmailAddress(email: string): boolean {
  const value = normalizeEmailForSuppression(email)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
