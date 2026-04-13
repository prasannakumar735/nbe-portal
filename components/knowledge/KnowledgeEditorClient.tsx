'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Props =
  | { mode: 'create' }
  | {
      mode: 'edit'
      id: string
    }

export function KnowledgeEditorClient(props: Props) {
  const router = useRouter()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('General')
  const [tags, setTags] = useState('')
  const [loading, setLoading] = useState(props.mode === 'edit')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (props.mode !== 'edit') {
      setLoading(false)
      return
    }
    const articleId = props.id
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/knowledge/${articleId}`, { credentials: 'same-origin' })
        if (!res.ok) throw new Error('Load failed')
        const json = (await res.json()) as {
          article: { title: string; content: string; category: string; tags: string[] }
        }
        if (cancelled) return
        setTitle(json.article.title)
        setContent(json.article.content)
        setCategory(json.article.category)
        setTags((json.article.tags ?? []).join(', '))
      } catch {
        toast.error('Could not load article')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.mode, props.mode === 'edit' ? props.id : ''])

  const save = async () => {
    const t = title.trim()
    if (!t) {
      toast.error('Title is required')
      return
    }
    setSaving(true)
    try {
      const tagList = tags
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
      if (props.mode === 'create') {
        const res = await fetch('/api/knowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            title: t,
            content,
            category: category.trim() || 'General',
            tags: tagList,
          }),
        })
        if (!res.ok) throw new Error('Save failed')
        const json = (await res.json()) as { article: { id: string } }
        toast.success('Created')
        router.push(`/knowledge/${json.article.id}`)
        return
      }
      const res = await fetch(`/api/knowledge/${props.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          title: t,
          content,
          category: category.trim() || 'General',
          tags: tagList,
        }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Saved')
      router.push(`/knowledge/${props.id}`)
    } catch {
      toast.error('Could not save')
    } finally {
      setSaving(false)
    }
  }

  const onUpload = async (file: File | null) => {
    if (!file || props.mode !== 'edit') return
    const fd = new FormData()
    fd.set('article_id', props.id)
    fd.set('file', file)
    const res = await fetch('/api/knowledge/upload', { method: 'POST', body: fd, credentials: 'same-origin' })
    if (!res.ok) {
      toast.error('Upload failed')
      return
    }
    toast.success('File attached')
  }

  if (loading) {
    return <p className="px-4 py-10 text-sm text-gray-600">Loading…</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-xl font-semibold text-gray-900">{props.mode === 'create' ? 'New article' : 'Edit article'}</h1>

      <label className="mt-6 block">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Title</span>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-inner outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Category</span>
        <input
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-inner outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Tags (comma-separated)</span>
        <input
          value={tags}
          onChange={e => setTags(e.target.value)}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm shadow-inner outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </label>

      <label className="mt-4 block">
        <span className="text-xs font-medium uppercase tracking-wide text-gray-500">Content</span>
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={16}
          className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 font-mono text-sm shadow-inner outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
        />
      </label>

      {props.mode === 'edit' && (
        <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-medium text-gray-900">Attach media</p>
          <label className="mt-2 inline-flex cursor-pointer rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-800 shadow-sm">
            Choose file
            <input type="file" className="sr-only" onChange={e => void onUpload(e.target.files?.[0] ?? null)} />
          </label>
        </div>
      )}

      <button
        type="button"
        onClick={() => void save()}
        disabled={saving}
        className="mt-8 w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 sm:w-auto sm:px-8"
      >
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}
