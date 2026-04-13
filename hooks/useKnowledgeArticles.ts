'use client'

import { useCallback, useEffect, useState } from 'react'
import type { KnowledgeArticleRow } from '@/lib/knowledge/types'

type Params = {
  q?: string
  category?: string
  tag?: string
}

export function useKnowledgeArticles(params?: Params) {
  const [articles, setArticles] = useState<KnowledgeArticleRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const u = new URL('/api/knowledge', window.location.origin)
      if (params?.q) u.searchParams.set('q', params.q)
      if (params?.category) u.searchParams.set('category', params.category)
      if (params?.tag) u.searchParams.set('tag', params.tag)
      const res = await fetch(u.toString(), { credentials: 'same-origin' })
      if (!res.ok) throw new Error('Failed to load articles')
      const json = (await res.json()) as { articles: KnowledgeArticleRow[] }
      setArticles(json.articles ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setArticles([])
    } finally {
      setLoading(false)
    }
  }, [params?.category, params?.q, params?.tag])

  useEffect(() => {
    void reload()
  }, [reload])

  return { articles, loading, error, reload }
}
