import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { extractContactsFromHtml } from '@/lib/sales/providers/contactHtmlExtraction'

describe('extractContactsFromHtml', () => {
  it('captures mailto links with page metadata', () => {
    const html = `
      <html><head><title>Thomastown Branch</title></head>
      <body>
        <a href="mailto:thomastownsales@example.com">Email Us</a>
      </body></html>
    `
    const results = extractContactsFromHtml(
      html,
      'https://example.com/locations/thomastown',
      'branch',
    )
    assert.equal(results.length, 1)
    assert.equal(results[0]?.email, 'thomastownsales@example.com')
    assert.equal(results[0]?.discovery_method, 'mailto_labeled')
    assert.equal(results[0]?.discovery_page_title, 'Thomastown Branch')
    assert.equal(results[0]?.page_kind, 'branch')
    assert.equal(results[0]?.contact_type, 'sales')
  })

  it('assigns lower confidence to body text emails than mailto', () => {
    const html = `
      <html><head><title>Home</title></head>
      <body>
        <a href="mailto:sales@example.com">Sales</a>
        <p>Also reach us at footer@example.com</p>
      </body></html>
    `
    const results = extractContactsFromHtml(html, 'https://example.com/', 'homepage')
    const mailto = results.find((r) => r.email === 'sales@example.com')
    const body = results.find((r) => r.email === 'footer@example.com')
    assert.ok(mailto && body)
    assert.ok(mailto.confidence_score > body.confidence_score)
    assert.equal(mailto.discovery_method, 'mailto_labeled')
    assert.equal(body.discovery_method, 'body_text')
  })
})
