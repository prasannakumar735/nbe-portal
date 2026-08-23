'use client'

import { SalesEngineToolsNav } from '@/components/sales-engine/SalesEngineToolsNav'
import { useCallback, useEffect, useState } from 'react'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { SalesOfferTypeRecord } from '@/lib/sales/types/campaignLookup.types'
import type { SalesOfferAttachment } from '@/lib/sales/types/emailAttachment.types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function OfferAssetsPage() {
  const [offerTypes, setOfferTypes] = useState<SalesOfferTypeRecord[]>([])
  const [offerTypeId, setOfferTypeId] = useState('')
  const [attachments, setAttachments] = useState<SalesOfferAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await salesEngineFetch<{ types: SalesOfferTypeRecord[] }>(
          '/api/sales/offer-types?activeOnly=true',
        )
        if (cancelled) return
        setOfferTypes(res.types)
        if (res.types[0]) setOfferTypeId(res.types[0].id)
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load offer types')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const loadAttachments = useCallback(async (id: string) => {
    if (!id) {
      setAttachments([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const res = await salesEngineFetch<{ attachments: SalesOfferAttachment[] }>(
        `/api/sales/offer-types/${id}/attachments`,
      )
      setAttachments(res.attachments)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attachments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!offerTypeId) return
    void loadAttachments(offerTypeId)
  }, [offerTypeId, loadAttachments])

  async function handleUpload(file: File) {
    if (!offerTypeId) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('file', file)
      await salesEngineFetch(`/api/sales/offer-types/${offerTypeId}/attachments`, {
        method: 'POST',
        body: form,
      })
      await loadAttachments(offerTypeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(attachmentId: string) {
    if (!offerTypeId) return
    setError(null)
    try {
      await salesEngineFetch(`/api/sales/offer-types/${offerTypeId}/attachments/${attachmentId}`, {
        method: 'DELETE',
      })
      await loadAttachments(offerTypeId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <div className="w-full min-w-0 max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">Offer brochures</h1>
        <p className="mt-1 text-sm text-slate-600">
          PDFs and images shared by offer type. New generated emails copy these files automatically.
        </p>
      </header>
      <SalesEngineToolsNav />

      {error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      <label className="block text-sm font-medium text-slate-700">
        Offer type
        <select
          value={offerTypeId}
          onChange={(e) => setOfferTypeId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">Select offer type</option>
          {offerTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50">
          {uploading ? 'Uploading…' : 'Upload file'}
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={!offerTypeId || uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUpload(f)
              e.target.value = ''
            }}
          />
        </label>
        <span className="text-xs text-slate-500">PDF, PNG, JPEG, WebP — max 5 files, 5 MB each</span>
      </div>

      {loading ? <p className="text-sm text-slate-600">Loading…</p> : null}

      <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200">
        {attachments.length === 0 && !loading ? (
          <li className="px-4 py-6 text-sm text-slate-500">No brochures for this offer yet.</li>
        ) : null}
        {attachments.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div>
              <p className="text-sm font-medium text-slate-900">{a.file_name}</p>
              <p className="text-xs text-slate-500">
                {a.content_type} · {formatBytes(a.byte_size)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleDelete(a.id)}
              className="text-sm font-medium text-red-700 hover:text-red-900"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
