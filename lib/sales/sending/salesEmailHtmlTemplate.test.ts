import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildComplianceFooter } from '@/lib/sales/compliance/buildComplianceFooter'
import { enrichEmailBodyWithAttachments } from '@/lib/sales/sending/emailAttachmentBodyEnrichment'
import {
  renderSalesEmailContentHtml,
  SALES_EMAIL_SHELL_MARKER,
  wrapSalesEmailDocument,
} from '@/lib/sales/sending/salesEmailHtmlTemplate'

const UNSUB = 'https://portal.example.com/api/sales/tracking/unsubscribe/tok.sig'

const SAMPLE_BODY = `Dear Agrelia Gourmet Co PTY LTD team,

NBE Australia is writing to you as we specialise in supplying and servicing industrial rapid doors and PVC door systems for commercial and industrial sites.

If you have an upcoming project or would like to discuss suitable options, we'd be happy to assist.`

function assemble(body: string): string {
  let html = renderSalesEmailContentHtml({ body })
  html = enrichEmailBodyWithAttachments({
    body: html,
    attachments: [
      {
        fileName: 'Broucher_1.png',
        contentType: 'image/png',
        contentBytes: 'abc',
        contentId: 'nbe-brochure@nbe.local',
        isInline: true,
        attachmentRowId: 'att-1',
      },
    ],
    pdfLinks: [],
  })
  html = buildComplianceFooter({
    body: html,
    unsubscribeUrl: UNSUB,
    recipientEmail: 'info@agrelia.com.au',
    presentation: 'link',
  })
  return wrapSalesEmailDocument(html, { previewText: 'Doorway traffic flow at Agrelia Gourmet Co' })
}

test('plain text body becomes branded HTML, not a raw wall of text', () => {
  const html = assemble(SAMPLE_BODY)
  assert.ok(html.includes(SALES_EMAIL_SHELL_MARKER))
  assert.ok(html.includes('NBE AUSTRALIA'))
  assert.ok(html.includes('<p style='))
  assert.ok(html.includes('Kind regards'))
  assert.doesNotMatch(html, /--- Attachments ---/)
  assert.doesNotMatch(html, /Image attached: Broucher_1\.png/)
  assert.doesNotMatch(html, /--- Why you received this ---/)
  assert.doesNotMatch(html, new RegExp(`Unsubscribe: ${UNSUB.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
})

test('unsubscribe URL is a styled link, still present for the send gate', () => {
  const html = assemble(SAMPLE_BODY)
  assert.ok(html.includes(UNSUB), 'raw URL must remain in the document for sendEmail()')
  assert.ok(html.includes(`href="${UNSUB}"`))
  assert.ok(html.includes('>Unsubscribe</a>'))
})

test('brochure is an inline image, not a filename dump', () => {
  const html = assemble(SAMPLE_BODY)
  assert.ok(html.includes('cid:nbe-brochure@nbe.local'))
  assert.ok(html.includes('Product brochure'))
  assert.ok(html.includes('data-nbe-attachments'))
})

test('document wrap is idempotent', () => {
  const once = wrapSalesEmailDocument('<p>Hi</p>')
  assert.equal(wrapSalesEmailDocument(once), once)
})
