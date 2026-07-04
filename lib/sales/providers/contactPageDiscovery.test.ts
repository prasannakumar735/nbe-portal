import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { shouldExcludeCrawlPath } from '@/lib/sales/providers/contactPageDiscovery'

describe('shouldExcludeCrawlPath', () => {
  it('excludes login, portal, legal, careers, and content pages', () => {
    const blocked = [
      '/login',
      '/signin',
      '/portal/dashboard',
      '/employee/login',
      '/careers',
      '/jobs/apply',
      '/privacy-policy',
      '/terms',
      '/cookies',
      '/blog/post-1',
      '/news/article',
      '/media/press',
      '/download/brochure.pdf',
      '/files/guide.pdf',
    ]
    for (const path of blocked) {
      assert.equal(shouldExcludeCrawlPath(path, `https://example.com${path}`), true, path)
    }
  })

  it('allows contact and location paths', () => {
    assert.equal(shouldExcludeCrawlPath('/contact-us', 'https://example.com/contact-us'), false)
    assert.equal(shouldExcludeCrawlPath('/locations', 'https://example.com/locations'), false)
    assert.equal(
      shouldExcludeCrawlPath('/locations/thomastown', 'https://example.com/locations/thomastown'),
      false,
    )
  })
})
