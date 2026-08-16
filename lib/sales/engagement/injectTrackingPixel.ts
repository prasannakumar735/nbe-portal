import { escapeHtml, looksLikeHtml } from '@/lib/sales/sending/emailBodyFormat'

export const TRACKING_PIXEL_MARKER = 'data-nbe-tracking-pixel'

/**
 * Append the open-tracking pixel.
 *
 * HTML bodies only — a plain-text email cannot load an image, and injecting a
 * bare URL into text would just look like spam. Returns the body unchanged when
 * tracking is not applicable, so callers never have to special-case it.
 */
export function injectTrackingPixel(body: string, openUrl: string): string {
  if (!openUrl.trim()) return body
  if (body.includes(TRACKING_PIXEL_MARKER)) return body
  if (!looksLikeHtml(body)) return body

  const pixel = `<img ${TRACKING_PIXEL_MARKER}="true" src="${escapeHtml(openUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;" />`
  return `${body}\n${pixel}`
}
