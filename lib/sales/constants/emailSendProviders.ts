/** Outbound email transport providers (Phase 6). */

export const EMAIL_SEND_PROVIDER_IDS = [
  'microsoft365',
  'smtp',
  'sendgrid',
  'mailgun',
] as const

export type EmailSendProviderId = (typeof EMAIL_SEND_PROVIDER_IDS)[number]

export function isEmailSendProviderId(value: string): value is EmailSendProviderId {
  return (EMAIL_SEND_PROVIDER_IDS as readonly string[]).includes(value)
}
