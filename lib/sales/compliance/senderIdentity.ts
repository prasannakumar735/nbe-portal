/**
 * Sender identification for outbound sales email.
 *
 * Spam Act 2003 (Cth) s17 requires every commercial electronic message to
 * clearly identify the sender and include accurate contact details that stay
 * reachable for at least 30 days after sending. These values are a code
 * constant (not admin-editable) so the legal footer cannot be blanked from the
 * UI on live outbound mail.
 *
 * Values below are taken from existing quote/PDF output — see
 * lib/pdf/generateProposalPdf.ts (ABN) and lib/constants.ts (depot address).
 * Do not add details here that have not been confirmed by the business.
 */
export type SenderIdentity = {
  legalName: string
  abn: string
  postalAddress: string
  /** Optional: omitted rather than guessed. s17 is satisfied by address + reachable reply-to. */
  phone?: string
  websiteUrl?: string
}

export const NBE_SENDER_IDENTITY: SenderIdentity = {
  legalName: 'NBE Australia Pty Ltd',
  abn: '17 007 048 008',
  postalAddress: '22A Humeside Drive, Campbellfield VIC 3061',
  // TODO(pk): confirm the public sales phone and website before first live send.
  // Left unset deliberately — a wrong number in a legal footer is worse than none.
}

/**
 * Guard against shipping an incomplete legal footer.
 * Called on the send path so a missing value fails the send instead of
 * silently emitting an unidentified commercial message.
 */
export function assertSenderIdentityComplete(identity: SenderIdentity = NBE_SENDER_IDENTITY): void {
  const missing = (['legalName', 'abn', 'postalAddress'] as const).filter(
    (key) => !identity[key]?.trim(),
  )
  if (missing.length > 0) {
    throw new Error(
      `Sender identity incomplete (${missing.join(', ')}). Spam Act s17 requires sender identification on every commercial email.`,
    )
  }
}

/** Single-line sender identification used in both HTML and text footers. */
export function formatSenderIdentityLine(identity: SenderIdentity = NBE_SENDER_IDENTITY): string {
  const parts = [
    `${identity.legalName} (ABN ${identity.abn})`,
    identity.postalAddress,
    identity.phone?.trim(),
  ].filter((part): part is string => Boolean(part && part.trim()))
  return parts.join(' — ')
}
