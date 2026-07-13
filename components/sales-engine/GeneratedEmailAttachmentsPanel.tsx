'use client'

import { useCallback, useEffect, useState } from 'react'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import type { SalesGeneratedEmailAttachment } from '@/lib/sales/types/emailAttachment.types'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type GeneratedEmailAttachmentsPanelProps = {
  emailId: string | null
}

export function GeneratedEmailAttachmentsPanel({ emailId }: GeneratedEmailAttachmentsPanelProps) {
  const [attachments, setAttachments] = useState<SalesGeneratedEmailAttachment[]>([])
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await salesEngineFetch<{ attachments: SalesGeneratedEmailAttachment[] }>(
        `/api/sales/generated-emails/${id}/attachments`,
      )
      setAttachments(res.attachments)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load attachments')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!emailId) {
      setAttachments([])
      return
    }
    void load(emailId)
  }, [emailId, load])

  async function toggleEnabled(attachment: SalesGeneratedEmailAttachment) {
    if (!emailId) return
    setError(null)
    try {
      const res = await salesEngineFetch<{ attachment: SalesGeneratedEmailAttachment }>(
        `/api/sales/generated-emails/${emailId}/attachments/${attachment.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ enabled: !attachment.enabled }),
        },
      )
      setAttachments((prev) => prev.map((a) => (a.id === res.attachment.id ? res.attachment : a)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update attachment')
    }
  }

  async function handleUpload(file: File) {
    if (!emailId) return
    setUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.set('file', file)
      await salesEngineFetch(`/api/sales/generated-emails/${emailId}/attachments`, {
        method: 'POST',
        body: form,
      })
      await load(emailId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function handleDelete(attachment: SalesGeneratedEmailAttachment) {
    if (!emailId) return
    setError(null)
    try {
      await salesEngineFetch(`/api/sales/generated-emails/${emailId}/attachments/${attachment.id}`, {
        method: 'DELETE',
      })
      await load(emailId)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  if (!emailId) return null

  return (
    <div className="mt-4 border-t border-slate-200 pt-4">
      <h3 className="text-sm font-semibold text-slate-900">Attachments</h3>
      <p className="mt-1 text-xs text-slate-500">
        Included when this email is sent. Offer brochures are copied at generation; you can add more or
        disable files for this contact.
      </p>
      {error ? (
        <p
          className={`mt-2 text-xs ${error.includes('migration') ? 'text-amber-900' : 'text-red-700'}`}
          role="alert"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50">
          {uploading ? 'Uploading…' : 'Add file'}
          <input
            type="file"
            accept=".pdf,image/png,image/jpeg,image/webp"
            className="sr-only"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) void handleUpload(f)
              e.target.value = ''
            }}
          />
        </label>
        {loading ? <span className="text-xs text-slate-500">Loading…</span> : null}
      </div>
      <ul className="mt-3 space-y-2">
        {attachments.length === 0 && !loading ? (
          <li className="text-xs text-slate-500">No attachments.</li>
        ) : null}
        {attachments.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
            <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={a.enabled}
                onChange={() => void toggleEnabled(a)}
                className="rounded border-slate-300"
              />
              <span className="truncate font-medium text-slate-900">{a.file_name}</span>
              <span className="shrink-0 text-xs text-slate-500">
                {a.source === 'offer' ? 'offer' : 'upload'} · {formatBytes(a.byte_size)}
              </span>
            </label>
            {a.source === 'upload' ? (
              <button
                type="button"
                onClick={() => void handleDelete(a)}
                className="text-xs font-medium text-red-700 hover:text-red-900"
              >
                Remove
              </button>
            ) : (
              <span className="text-xs text-slate-400">from offer library</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
