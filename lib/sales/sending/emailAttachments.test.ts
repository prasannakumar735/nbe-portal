import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mapOfferAttachmentsForGeneratedEmail } from '@/lib/sales/attachments/salesBrochureStorage'
import {
  buildOutboundAttachmentContentId,
  enrichEmailBodyWithAttachments,
} from '@/lib/sales/sending/emailAttachmentBodyEnrichment'
import { buildGraphFileAttachmentsPayload } from '@/lib/graph/sendMail'
import {
  assertAttachmentCountAndTotalSize,
  validateSalesAttachmentFileMeta,
} from '@/lib/sales/validators/emailAttachment.validators'

describe('mapOfferAttachmentsForGeneratedEmail', () => {
  it('maps offer rows to generated email snapshot inserts', () => {
    const rows = mapOfferAttachmentsForGeneratedEmail('email-1', [
      {
        id: 'off-1',
        storage_path: 'offer/x/brochure.pdf',
        file_name: 'brochure.pdf',
        content_type: 'application/pdf',
        byte_size: 1000,
        sort_order: 2,
      },
    ])
    assert.equal(rows.length, 1)
    assert.equal(rows[0]?.generated_email_id, 'email-1')
    assert.equal(rows[0]?.source, 'offer')
    assert.equal(rows[0]?.offer_attachment_id, 'off-1')
    assert.equal(rows[0]?.enabled, true)
  })
})

describe('enrichEmailBodyWithAttachments', () => {
  it('appends CID image and PDF link block for HTML bodies', () => {
    const cid = buildOutboundAttachmentContentId('att-uuid')
    const out = enrichEmailBodyWithAttachments({
      body: '<p>Hello</p>',
      attachments: [
        {
          fileName: 'photo.png',
          contentType: 'image/png',
          contentBytes: 'abc',
          contentId: cid,
          isInline: true,
          attachmentRowId: 'att-uuid',
        },
        {
          fileName: 'brochure.pdf',
          contentType: 'application/pdf',
          contentBytes: 'def',
        },
      ],
      pdfLinks: [{ fileName: 'brochure.pdf', signedUrl: 'https://example.com/brochure.pdf' }],
    })
    assert.match(out, /cid:nbe-att-uuid@nbe\.local/)
    assert.match(out, /https:\/\/example\.com\/brochure\.pdf/)
    assert.match(out, /data-nbe-attachments/)
  })

  it('appends plain text attachment notes for non-HTML bodies', () => {
    const out = enrichEmailBodyWithAttachments({
      body: 'Hello there',
      attachments: [
        {
          fileName: 'brochure.pdf',
          contentType: 'application/pdf',
          contentBytes: 'def',
        },
      ],
      pdfLinks: [{ fileName: 'brochure.pdf', signedUrl: 'https://example.com/b.pdf' }],
    })
    assert.match(out, /--- Attachments ---/)
    assert.match(out, /Attached: brochure\.pdf/)
    assert.doesNotMatch(out, /<img/)
  })
})

describe('buildGraphFileAttachmentsPayload', () => {
  it('builds inline and file attachments for Graph', () => {
    const payload = buildGraphFileAttachmentsPayload([
      {
        name: 'a.png',
        contentType: 'image/png',
        contentBytes: 'YmFzZTY0',
        isInline: true,
        contentId: 'cid@test',
      },
      {
        name: 'b.pdf',
        contentType: 'application/pdf',
        contentBytes: 'cGRm',
      },
    ])
    assert.equal(payload.length, 2)
    assert.equal(payload[0]?.['@odata.type'], '#microsoft.graph.fileAttachment')
    assert.equal(payload[0]?.isInline, true)
    assert.equal(payload[0]?.contentId, 'cid@test')
    assert.equal(payload[1]?.isInline, undefined)
  })
})

describe('email attachment validators', () => {
  it('rejects oversize files', () => {
    assert.throws(() =>
      validateSalesAttachmentFileMeta({
        fileName: 'big.pdf',
        contentType: 'application/pdf',
        byteSize: 6 * 1024 * 1024,
      }),
    )
  })

  it('enforces max count and total size', () => {
    assert.throws(() =>
      assertAttachmentCountAndTotalSize(
        [{ byte_size: 3 * 1024 * 1024 }, { byte_size: 3 * 1024 * 1024 }],
        5 * 1024 * 1024,
      ),
    )
  })
})
