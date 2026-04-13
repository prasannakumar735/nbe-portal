'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { useAuth } from '@/app/providers/AuthProvider'

type Props = { id: string }

export function KnowledgeArticleClient({ id }: Props) {
  const { user, isManager, isAdmin } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [article, setArticle] = useState<{
    title: string
    content: string
    category: string
    tags: string[]
    created_by: string
  } | null>(null)
  const [media, setMedia] = useState<Array<{ id: string; media_url: string; type: string }>>([])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/knowledge/${id}`, { credentials: 'same-origin' })
        if (!res.ok) throw new Error('Not found')
        const json = (await res.json()) as {
          article: { title: string; content: string; category: string; tags: string[]; created_by: string }
          media: Array<{ id: string; media_url: string; type: string }>
        }
        if (!cancelled) {
          setArticle(json.article)
          setMedia(json.media ?? [])
        }
      } catch {
        if (!cancelled) setError('Could not load article')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-12 text-gray-600">
        <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        Loading…
      </div>
    )
  }

  if (error || !article) {
    return <p className="px-4 py-8 text-sm text-rose-700">{error ?? 'Missing article'}</p>
  }

  const canEdit = user?.id === article.created_by || isManager || isAdmin

  return (
    <article className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{article.category}</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-900">{article.title}</h1>
          {article.tags?.length ? (
            <p className="mt-2 text-sm text-gray-500">{article.tags.join(' · ')}</p>
          ) : null}
        </div>
        {canEdit && (
          <Link
            href={`/knowledge/${id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50"
          >
            <Pencil className="h-4 w-4" aria-hidden />
            Edit
          </Link>
        )}
      </div>

      <div className="prose prose-sm max-w-none rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">{article.content}</div>
      </div>

      {media.length > 0 && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900">Media</h2>
          <ul className="mt-3 space-y-4">
            {media.map(m => (
              <li key={m.id}>
                {m.type === 'image' || m.type === 'other' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={m.media_url} alt="" className="max-h-80 w-full rounded-xl object-contain" />
                ) : m.type === 'video' ? (
                  <video src={m.media_url} controls className="w-full rounded-xl" />
                ) : (
                  <a
                    href={m.media_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium text-blue-600 underline"
                  >
                    Open PDF
                  </a>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8">
        <Link href="/knowledge" className="text-sm font-medium text-blue-600 hover:underline">
          ← Back to knowledge
        </Link>
      </p>
    </article>
  )
}
