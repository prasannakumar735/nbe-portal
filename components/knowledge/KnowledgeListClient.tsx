'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { useKnowledgeArticles } from '@/hooks/useKnowledgeArticles'
import { cacheKnowledgeArticles } from '@/lib/offline/knowledgeCache'
import type { KnowledgeArticleRow } from '@/lib/knowledge/types'
export function KnowledgeListClient() {
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [tag, setTag] = useState('')

  const { articles, loading, error, reload } = useKnowledgeArticles({
    q: q.trim() || undefined,
    category: category || undefined,
    tag: tag || undefined,
  })

  useEffect(() => {
    if (articles.length) cacheKnowledgeArticles(articles)
  }, [articles])

  const categories = useMemo(() => {
    const s = new Set<string>()
    for (const a of articles) s.add(a.category)
    return [...s].sort()
  }, [articles])

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-x-hidden px-4 py-6 md:px-6">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Knowledge</h1>
          <p className="mt-1 max-w-xl text-sm text-gray-500">SOPs, fixes, and troubleshooting — available on site.</p>
        </div>
        <Link
          href="/knowledge/new"
          className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          New article
        </Link>
      </header>

      <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-xl border border-gray-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
        >
          <option value="">All categories</option>
          {categories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={tag}
          onChange={e => setTag(e.target.value)}
          placeholder="Tag"
          className="rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          Loading…
        </div>
      )}
      {error && <p className="text-sm text-rose-700">{error}</p>}

      {!loading && (
        <ul className="grid gap-3 sm:grid-cols-2">
          {articles.map((a: KnowledgeArticleRow) => (
            <li key={a.id}>
              <Link
                href={`/knowledge/${a.id}`}
                className="block h-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-gray-300 hover:shadow-md"
              >
                <p className="font-semibold text-gray-900">{a.title}</p>
                <p className="mt-1 text-xs font-medium uppercase tracking-wide text-gray-500">{a.category}</p>
                {a.tags?.length ? (
                  <p className="mt-2 text-xs text-gray-500">{a.tags.slice(0, 4).join(' · ')}</p>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}

      {!loading && articles.length === 0 && (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
          No articles match. Try a different search or{' '}
          <button type="button" onClick={() => void reload()} className="font-medium text-blue-600 underline">
            refresh
          </button>
          .
        </p>
      )}
    </div>
  )
}
