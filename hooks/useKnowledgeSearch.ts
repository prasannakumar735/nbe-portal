'use client'

import { useCallback, useState } from 'react'
import type { KnowledgeArticleRow } from '@/lib/knowledge/types'

export function useKnowledgeSearch() {
  const [results, setResults] = useState<KnowledgeArticleRow[]>([])
  const [loading, setLoading] = useState(false)

  const search = useCallback(async (q: string, filters?: { category?: string; tag?: string }) => {
    setLoading(true)
    try {
      const u = new URL('/api/knowledge', window.location.origin)
      if (q.trim()) u.searchParams.set('q', q.trim())
      if (filters?.category) u.searchParams.set('category', filters.category)
      if (filters?.tag) u.searchParams.set('tag', filters.tag)
      const res = await fetch(u.toString(), { credentials: 'same-origin' })
      if (!res.ok) {
        setResults([])
        return
      }
      const json = (await res.json()) as { articles: KnowledgeArticleRow[] }
      setResults(json.articles ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  return { results, loading, search }
}
