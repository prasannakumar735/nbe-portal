import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  bodyHasComplianceFooter,
  buildComplianceFooter,
  resolveUnsubscribePresentation,
} from '@/lib/sales/compliance/buildComplianceFooter'
import { formatSenderIdentityLine } from '@/lib/sales/compliance/senderIdentity'
import { injectTrackingPixel } from '@/lib/sales/engagement/injectTrackingPixel'

const UNSUB = 'https://portal.example.com/api/sales/tracking/unsubscribe/tok.sig'

function footer(body: string, presentation: 'link' | 'button' = 'link'): string {
  return buildComplianceFooter({
    body,
    unsubscribeUrl: UNSUB,
    recipientEmail: 'ops@warehouse.example.com',
    presentation,
  })
}

test('html body gets unsubscribe link and sender identification', () => {
  const result = footer('<p>Hello there</p>')
  assert.ok(result.includes(UNSUB), 'unsubscribe URL present')
  assert.ok(result.includes(formatSenderIdentityLine()), 'sender identity present')
  assert.ok(result.includes('ABN 17 007 048 008'))
  assert.ok(result.includes('ops@warehouse.example.com'))
})

test('plain-text body gets a plain-text footer, not HTML', () => {
  const result = footer('Hello there,\n\nQuick question about your cold store.')
  assert.ok(result.includes(`Unsubscribe: ${UNSUB}`))
  assert.ok(!result.includes('<div'), 'no HTML injected into a text body')
})

test('unsubscribe presentation escalates to a button at email 3', () => {
  assert.equal(resolveUnsubscribePresentation(1), 'link')
  assert.equal(resolveUnsubscribePresentation(2), 'link')
  assert.equal(resolveUnsubscribePresentation(3), 'button')
  assert.equal(resolveUnsubscribePresentation(7), 'button')
})

test('every presentation still contains a working unsubscribe URL', () => {
  for (const presentation of ['link', 'button'] as const) {
    assert.ok(footer('<p>Hi</p>', presentation).includes(UNSUB), `${presentation} has URL`)
  }
})

test('footer is not appended twice', () => {
  const once = footer('<p>Hi</p>')
  const twice = footer(once)
  assert.equal(once, twice)
  assert.equal(twice.split(UNSUB).length - 1, 1, 'exactly one unsubscribe URL')
})

test('bodyHasComplianceFooter detects both modes', () => {
  assert.ok(bodyHasComplianceFooter(footer('<p>Hi</p>')))
  assert.ok(bodyHasComplianceFooter(footer('Hi there')))
  assert.ok(!bodyHasComplianceFooter('<p>Hi</p>'))
})

test('refuses to build without an unsubscribe URL or recipient', () => {
  assert.throws(
    () =>
      buildComplianceFooter({
        body: '<p>Hi</p>',
        unsubscribeUrl: '   ',
        recipientEmail: 'a@b.com',
        presentation: 'link',
      }),
    /unsubscribe URL/i,
  )
  assert.throws(
    () =>
      buildComplianceFooter({
        body: '<p>Hi</p>',
        unsubscribeUrl: UNSUB,
        recipientEmail: '',
        presentation: 'link',
      }),
    /recipient/i,
  )
})

test('recipient address is HTML-escaped in the html footer', () => {
  const result = buildComplianceFooter({
    body: '<p>Hi</p>',
    unsubscribeUrl: UNSUB,
    recipientEmail: '"><script>alert(1)</script>@x.com',
    presentation: 'link',
  })
  assert.ok(!result.includes('<script>'), 'no raw script tag')
  assert.ok(result.includes('&lt;script&gt;'))
})

test('tracking pixel is html-only and never duplicated', () => {
  const open = 'https://portal.example.com/api/sales/tracking/open/tok.sig'
  const html = injectTrackingPixel('<p>Hi</p>', open)
  assert.ok(html.includes(open))
  assert.equal(injectTrackingPixel(html, open), html, 'idempotent')
  assert.equal(injectTrackingPixel('Plain text body', open), 'Plain text body')
})
