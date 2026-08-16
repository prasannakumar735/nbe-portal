import { COMPLIANCE_FOOTER_MARKER } from '@/lib/sales/compliance/buildComplianceFooter'
import { escapeHtml, looksLikeHtml } from '@/lib/sales/sending/emailBodyFormat'

/**
 * Branded HTML rendering for outbound sales email.
 *
 * The LLM writes plain text (better prompt adherence, no markup hallucination).
 * Rendering to HTML *before* attachment / footer / pixel steps puts those
 * blocks on their HTML branch instead of dumping raw URLs into the inbox.
 *
 * Assembly order in emailSenderWorker:
 *   renderSalesEmailContentHtml → attachments → pixel → compliance footer →
 *   wrapSalesEmailDocument
 */

/** Marker so a body is never wrapped in the document shell twice. */
export const SALES_EMAIL_SHELL_MARKER = 'data-nbe-email-shell'

const BRAND_ACCENT = '#5B21B6'
const BRAND_ACCENT_DARK = '#4C1D95'
const TEXT_COLOR = '#1f2937'
const MUTED_COLOR = '#6b7280'
const PAGE_BACKGROUND = '#eef0f3'
const CARD_BORDER = '#e5e7eb'
const FONT_STACK = "Arial, 'Helvetica Neue', Helvetica, sans-serif"

const PARAGRAPH_STYLE = `margin:0 0 16px;font-size:16px;line-height:1.7;color:${TEXT_COLOR};font-family:${FONT_STACK};`
const LIST_STYLE = `margin:0 0 16px;padding-left:20px;font-size:16px;line-height:1.7;color:${TEXT_COLOR};font-family:${FONT_STACK};`

const SIGN_OFF_PATTERN =
  /\b(kind regards|best regards|warm regards|regards|sincerely|cheers|many thanks|thanks|thank you)\b[\s,]*$/i

const BULLET_LINE = /^\s*[-*•]\s+(.*)$/

export type SalesEmailSignature = {
  name: string
  tagline?: string
  replyToEmail?: string
}

export const NBE_SALES_EMAIL_SIGNATURE: SalesEmailSignature = {
  name: 'NBE Australia',
  tagline: 'Industrial rapid doors & PVC door systems',
}

/** Turn bare URLs in already-escaped text into anchors. */
function linkifyEscapedText(escaped: string): string {
  return escaped.replace(/(https?:\/\/[^\s<]+)/g, (match) => {
    const trailing = /[.,;:!?)]+$/.exec(match)?.[0] ?? ''
    const url = trailing ? match.slice(0, -trailing.length) : match
    return `<a href="${url}" style="color:${BRAND_ACCENT};text-decoration:underline;">${url}</a>${trailing}`
  })
}

function renderTextLine(line: string): string {
  return linkifyEscapedText(escapeHtml(line))
}

function renderBlock(block: string): string {
  const lines = block.split('\n').filter((line) => line.trim().length > 0)
  if (lines.length === 0) return ''

  const bulletItems = lines.map((line) => BULLET_LINE.exec(line)?.[1])
  if (bulletItems.every((item) => item != null)) {
    const items = bulletItems
      .map((item) => `<li style="margin:0 0 6px;">${renderTextLine(item as string)}</li>`)
      .join('\n')
    return `<ul style="${LIST_STYLE}">\n${items}\n</ul>`
  }

  return `<p style="${PARAGRAPH_STYLE}">${lines.map(renderTextLine).join('<br />')}</p>`
}

function renderSignature(signature: SalesEmailSignature, includeSignOff: boolean): string {
  const rows: string[] = []
  if (includeSignOff) {
    rows.push(`<p style="${PARAGRAPH_STYLE}margin-bottom:4px;">Kind regards,</p>`)
  }
  rows.push(
    `<p style="margin:0;font-size:15px;line-height:1.5;color:${TEXT_COLOR};font-family:${FONT_STACK};"><strong>${escapeHtml(signature.name)}</strong></p>`,
  )
  if (signature.tagline?.trim()) {
    rows.push(
      `<p style="margin:2px 0 0;font-size:13px;line-height:1.5;color:${MUTED_COLOR};font-family:${FONT_STACK};">${escapeHtml(signature.tagline.trim())}</p>`,
    )
  }
  if (signature.replyToEmail?.trim()) {
    const email = escapeHtml(signature.replyToEmail.trim())
    rows.push(
      `<p style="margin:2px 0 0;font-size:13px;line-height:1.5;font-family:${FONT_STACK};"><a href="mailto:${email}" style="color:${BRAND_ACCENT};text-decoration:none;">${email}</a></p>`,
    )
  }
  return `<div style="margin-top:24px;padding-top:4px;">\n${rows.join('\n')}\n</div>`
}

export type RenderSalesEmailContentInput = {
  body: string
  /** Pass `null` to omit the signature (caller will append it after attachments). */
  signature?: SalesEmailSignature | null
}

/**
 * Convert the generated plain-text body into styled HTML paragraphs.
 * Bodies that are already HTML are returned untouched.
 * Pass `signature: null` when you want to inject attachments before the sign-off.
 */
export function renderSalesEmailContentHtml(input: RenderSalesEmailContentInput): string {
  const body = input.body.trim()
  if (!body) return body
  if (looksLikeHtml(body)) return body

  const blocks = body
    .split(/\n\s*\n/)
    .map(renderBlock)
    .filter((block) => block.length > 0)

  const signature = input.signature === null ? null : (input.signature ?? NBE_SALES_EMAIL_SIGNATURE)
  if (!signature) return blocks.join('\n')

  return [...blocks, renderSignature(signature, !SIGN_OFF_PATTERN.test(body))].join('\n')
}

/**
 * Append the NBE signature block to an already-rendered HTML body.
 * Call this AFTER attachment injection so brochure images appear before sign-off.
 */
export function appendSalesEmailSignature(
  html: string,
  signature: SalesEmailSignature = NBE_SALES_EMAIL_SIGNATURE,
): string {
  const hasSignOff = SIGN_OFF_PATTERN.test(
    html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
  )
  return `${html}\n${renderSignature(signature, !hasSignOff)}`
}

export type WrapSalesEmailDocumentOptions = {
  /** Inbox preview line shown after the subject; falls back to the body opening. */
  previewText?: string
  brandName?: string
  brandTagline?: string
  /** Absolute URL for the NBE logo image shown in the email header. */
  logoUrl?: string
}

function derivePreviewText(innerHtml: string): string {
  return innerHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 140)
}

export function splitSalesEmailFooter(innerHtml: string): { main: string; footer: string | null } {
  const needle = `<div ${COMPLIANCE_FOOTER_MARKER}`
  const idx = innerHtml.indexOf(needle)
  if (idx === -1) return { main: innerHtml, footer: null }
  return {
    main: innerHtml.slice(0, idx).trimEnd(),
    footer: innerHtml.slice(idx).trim(),
  }
}

/**
 * Wrap fully assembled email content (body + attachments + footer + pixel) in
 * the branded, mobile-friendly document shell.
 */
export function wrapSalesEmailDocument(
  innerHtml: string,
  options?: WrapSalesEmailDocumentOptions,
): string {
  if (innerHtml.includes(SALES_EMAIL_SHELL_MARKER)) return innerHtml

  const brandName = options?.brandName?.trim() || 'NBE Australia'
  const brandTagline =
    options?.brandTagline?.trim() || 'Industrial rapid doors & PVC door systems'
  const logoUrl = options?.logoUrl?.trim()
  const { main, footer } = splitSalesEmailFooter(innerHtml)
  const preview = escapeHtml(options?.previewText?.trim() || derivePreviewText(main))

  const footerRow = footer
    ? `<tr>
          <td style="background-color:#f8f7fb;padding:20px 32px;border-top:1px solid ${CARD_BORDER};">
${footer}
          </td>
        </tr>`
    : ''

  const logoRow = logoUrl
    ? `<tr>
          <td style="background-color:#ffffff;padding:20px 32px 16px;border-bottom:4px solid ${BRAND_ACCENT};">
            <img src="${escapeHtml(logoUrl)}" alt="${escapeHtml(brandName)}" height="48" style="display:block;height:48px;width:auto;max-height:48px;border:0;" />
          </td>
        </tr>
        <tr>
          <td class="nbe-header" style="background-color:${BRAND_ACCENT};background:linear-gradient(180deg, ${BRAND_ACCENT} 0%, ${BRAND_ACCENT_DARK} 100%);padding:14px 32px;">
            <p style="margin:0;font-size:13px;color:#e9d5ff;font-family:${FONT_STACK};">${escapeHtml(brandTagline)}</p>
          </td>
        </tr>`
    : `<tr>
          <td class="nbe-header" style="background-color:${BRAND_ACCENT};background:linear-gradient(180deg, ${BRAND_ACCENT} 0%, ${BRAND_ACCENT_DARK} 100%);padding:24px 32px;">
            <p style="margin:0;font-size:11px;letter-spacing:2px;font-weight:bold;color:#ddd6fe;font-family:${FONT_STACK};">NBE AUSTRALIA</p>
            <p style="margin:6px 0 0;font-size:20px;font-weight:bold;letter-spacing:0.4px;color:#ffffff;font-family:${FONT_STACK};">${escapeHtml(brandName)}</p>
            <p style="margin:6px 0 0;font-size:13px;color:#e9d5ff;font-family:${FONT_STACK};">${escapeHtml(brandTagline)}</p>
          </td>
        </tr>`

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<title>${escapeHtml(brandName)}</title>
<!--[if mso]>
<style type="text/css">
  body, table, td { font-family: Arial, Helvetica, sans-serif !important; }
</style>
<![endif]-->
<style>
  @media only screen and (max-width: 620px) {
    .nbe-card { width: 100% !important; }
    .nbe-pad { padding: 24px 20px !important; }
    .nbe-header { padding: 14px 20px !important; }
  }
</style>
</head>
<body ${SALES_EMAIL_SHELL_MARKER}="true" style="margin:0;padding:0;background-color:${PAGE_BACKGROUND};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;font-size:1px;line-height:1px;">${preview}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${PAGE_BACKGROUND};padding:28px 12px;">
  <tr>
    <td align="center">
      <table role="presentation" class="nbe-card" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px;background-color:#ffffff;border:1px solid ${CARD_BORDER};border-radius:10px;overflow:hidden;">
        ${logoRow}
        <tr>
          <td class="nbe-pad" style="padding:36px 32px 28px;">
${main}
          </td>
        </tr>
        ${footerRow}
      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}
