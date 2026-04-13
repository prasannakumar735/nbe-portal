'use client'

import { useCallback, useEffect, useState } from 'react'

export type SuggestedArticle = {
  id: string
  title: string
  category: string
  tags: string[]
  updated_at: string
}

export function useSuggestedArticles(jobTitle: string | null | undefined, workType?: string | null) {
  const [articles, setArticles] = useState<SuggestedArticle[]>([])
  const [loading, setLoading] = useState(false)

  const reload = useCallback(async () => {
    const t = jobTitle?.trim()
    if (!t) {
      setArticles([])
      return
    }
    setLoading(true)
    try {
      const u = new URL('/api/knowledge/suggested', window.location.origin)
      u.searchParams.set('job_title', t)
      if (workType?.trim()) u.searchParams.set('work_type', workType.trim())
      const res = await fetch(u.toString(), { credentials: 'same-origin' })
      if (!res.ok) {
        setArticles([])
        return
      }
      const json = (await res.json()) as { articles: SuggestedArticle[] }
      setArticles(json.articles ?? [])
    } finally {
      setLoading(false)
    }
  }, [jobTitle, workType])

  useEffect(() => {
    void reload()
  }, [reload])

  return { articles, loading, reload }
}
