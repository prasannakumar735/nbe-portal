import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renderUnsubscribePageHtml } from '@/lib/sales/compliance/unsubscribePageHtml'

test('confirm page is branded and does not auto-submit', () => {
  const html = renderUnsubscribePageHtml({ kind: 'confirm', email: 'info@agrelia.com.au' })
  assert.ok(html.includes('NBE AUSTRALIA'))
  assert.ok(html.includes('info@agrelia.com.au'))
  assert.ok(html.includes('method="POST"'))
  assert.ok(html.includes('Yes, unsubscribe me'))
  assert.ok(!html.includes('<script>'))
})

test('recipient email is escaped', () => {
  const html = renderUnsubscribePageHtml({
    kind: 'confirm',
    email: '<script>alert(1)</script>@x.com',
  })
  assert.ok(!html.includes('<script>alert(1)</script>'))
  assert.ok(html.includes('&lt;script&gt;'))
})

test('done and invalid states are branded', () => {
  assert.ok(renderUnsubscribePageHtml({ kind: 'done' }).includes('You have been unsubscribed'))
  assert.ok(renderUnsubscribePageHtml({ kind: 'invalid' }).includes('not valid'))
})
