import {
  assertSenderIdentityComplete,
  formatSenderIdentityLine,
  NBE_SENDER_IDENTITY,
  type SenderIdentity,
} from '@/lib/sales/compliance/senderIdentity'
import { escapeHtml, looksLikeHtml } from '@/lib/sales/sending/emailBodyFormat'

/**
 * How prominently the unsubscribe facility is presented.
 *
 * The facility itself is mandatory on EVERY commercial message (Spam Act 2003
 * s18) — only its prominence varies: a discreet text link on early touches,
 * an explicit button once a contact has received several emails.
 */
export type UnsubscribePresentation = 'link' | 'button'

/** Email number (1-based) at which the unsubscribe link becomes a button. */
export const UNSUBSCRIBE_BUTTON_FROM_EMAIL_NUMBER = 3

/** Marker so the footer is never appended twice to the same body. */
export const COMPLIANCE_FOOTER_MARKER = 'data-nbe-compliance-footer'

export function resolveUnsubscribePresentation(emailNumber: number): UnsubscribePresentation {
  return emailNumber >= UNSUBSCRIBE_BUTTON_FROM_EMAIL_NUMBER ? 'button' : 'link'
}

export function bodyHasComplianceFooter(body: string): boolean {
  return body.includes(COMPLIANCE_FOOTER_MARKER) || body.includes('--- Why you received this ---')
}

export type ComplianceFooterInput = {
  body: string
  unsubscribeUrl: string
  recipientEmail: string
  presentation: UnsubscribePresentation
  identity?: SenderIdentity
}

function buildHtmlFooter(input: ComplianceFooterInput): string {
  const identity = input.identity ?? NBE_SENDER_IDENTITY
  const url = escapeHtml(input.unsubscribeUrl)
  const recipient = escapeHtml(input.recipientEmail)
  const identityLine = escapeHtml(formatSenderIdentityLine(identity))

  const unsubscribeBlock =
    input.presentation === 'button'
      ? `<p style="margin:0 0 12px;"><a href="${url}" style="display:inline-block;padding:8px 14px;border:1px solid #999;border-radius:4px;color:#333;text-decoration:none;font-size:12px;">Unsubscribe</a></p>`
      : `<p style="margin:0 0 8px;"><a href="${url}" style="color:#666;font-size:12px;">Unsubscribe from these emails</a></p>`

  return [
    `<div ${COMPLIANCE_FOOTER_MARKER}="true" style="margin-top:24px;padding-top:12px;border-top:1px solid #ddd;color:#666;font-size:12px;font-family:Arial,Helvetica,sans-serif;">`,
    unsubscribeBlock,
    `<p style="margin:0 0 4px;">You received this at ${recipient} because it is listed as a business contact address for your organisation.</p>`,
    `<p style="margin:0;">${identityLine}</p>`,
    '</div>',
  ].join('\n')
}

function buildTextFooter(input: ComplianceFooterInput): string {
  const identity = input.identity ?? NBE_SENDER_IDENTITY
  return [
    '',
    '--- Why you received this ---',
    `You received this at ${input.recipientEmail} because it is listed as a business contact address for your organisation.`,
    `Unsubscribe: ${input.unsubscribeUrl}`,
    formatSenderIdentityLine(identity),
  ].join('\n')
}

/**
 * Append the mandatory unsubscribe + sender-identification footer.
 *
 * Throws rather than returning an unfooted body: a commercial email without
 * these elements must not be sent.
 */
export function buildComplianceFooter(input: ComplianceFooterInput): string {
  assertSenderIdentityComplete(input.identity ?? NBE_SENDER_IDENTITY)

  if (!input.unsubscribeUrl.trim()) {
    throw new Error('Cannot build compliance footer without an unsubscribe URL.')
  }
  if (!input.recipientEmail.trim()) {
    throw new Error('Cannot build compliance footer without a recipient address.')
  }

  if (bodyHasComplianceFooter(input.body)) {
    return input.body
  }

  return looksLikeHtml(input.body)
    ? `${input.body}\n${buildHtmlFooter(input)}`
    : `${input.body}\n${buildTextFooter(input)}`
}
