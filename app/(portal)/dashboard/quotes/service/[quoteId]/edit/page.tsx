'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { RapidDoorQuoteForm } from '@/components/quotes/RapidDoorQuoteForm'
import { ServiceQuoteForm } from '@/components/quotes/ServiceQuoteForm'
import type { RapidDoorQuoteFormValues, ServiceQuoteFormValues } from '@/components/quotes/types'

type Loaded =
  | { kind: 'service'; initial: ServiceQuoteFormValues }
  | { kind: 'rapid_door'; initial: RapidDoorQuoteFormValues }

export default function EditQuotePage() {
  const params = useParams()
  const quoteId = String(params.quoteId ?? '')
  const [loaded, setLoaded] = useState<Loaded | null>(null)
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
        if (cancel) return
        if (data.quote?.quote_kind === 'rapid_door') {
          setLoaded({ kind: 'rapid_door', initial: data.formValues as RapidDoorQuoteFormValues })
        } else {
          setLoaded({ kind: 'service', initial: data.formValues as ServiceQuoteFormValues })
        }
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
          Back to quotes
        </Link>
      </div>
    )
  }

  if (!loaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-slate-600">Loading…</p>
      </div>
    )
  }

  if (loaded.kind === 'rapid_door') {
    return <RapidDoorQuoteForm mode="edit" quoteId={quoteId} initialValues={loaded.initial} />
  }

  return <ServiceQuoteForm mode="edit" quoteId={quoteId} initialValues={loaded.initial} />
}
