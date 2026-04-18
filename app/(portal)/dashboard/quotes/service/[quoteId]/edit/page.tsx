'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ServiceQuoteForm } from '@/components/quotes/ServiceQuoteForm'
import type { ServiceQuoteFormValues } from '@/components/quotes/types'

export default function EditServiceQuotePage() {
  const params = useParams()
  const quoteId = String(params.quoteId ?? '')
  const [initial, setInitial] = useState<ServiceQuoteFormValues | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let cancel = false
    ;(async () => {
      try {
        const r = await fetch(`/api/quotes/service/${quoteId}`)
        const data = await r.json()
        if (!r.ok) {
          setErr(data.error || 'Failed to load quote.')
          return
        }
        if (!cancel) setInitial(data.formValues as ServiceQuoteFormValues)
      } catch {
        if (!cancel) setErr('Failed to load quote.')
      }
    })()
    return () => {
      cancel = true
    }
  }, [quoteId])

  if (err) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-red-600">{err}</p>
        <Link href="/dashboard/quotes/service" className="mt-4 inline-block text-sm text-slate-700 underline">
          Back to Service Quote
        </Link>
      </div>
    )
  }

  if (!initial) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  return <ServiceQuoteForm mode="edit" quoteId={quoteId} initialValues={initial} />
}
