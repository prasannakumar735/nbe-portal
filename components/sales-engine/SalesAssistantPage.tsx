'use client'

import Link from 'next/link'
import { useCallback, useState } from 'react'
import { toast } from 'sonner'
import { salesEngineFetch } from '@/components/sales-engine/salesEngineApi'
import {
  SALES_ASSISTANT_CAPABILITIES,
  SALES_ASSISTANT_CAPABILITY_LABELS,
  SALES_ASSISTANT_DISCLAIMER,
  type SalesAssistantCapability,
} from '@/lib/sales/constants/assistantCapabilities'
import type { SalesAssistantRunResult } from '@/lib/sales/types/salesAssistant.types'

export function SalesAssistantPage() {
  const [businessId, setBusinessId] = useState('')
  const [contactId, setContactId] = useState('')
  const [campaignId, setCampaignId] = useState('')
  const [opportunityId, setOpportunityId] = useState('')
  const [replyText, setReplyText] = useState('')
  const [managerNotes, setManagerNotes] = useState('')
  const [capability, setCapability] = useState<SalesAssistantCapability>('summarise_replies')
  const [running, setRunning] = useState(false)
  const [run, setRun] = useState<SalesAssistantRunResult | null>(null)

  const execute = useCallback(async () => {
    if (!businessId.trim()) {
      toast.error('Business ID is required (UUID from discovery).')
      return
    }
    setRunning(true)
    try {
      const res = await salesEngineFetch<{ run: SalesAssistantRunResult }>('/api/sales/assistant/run', {
        method: 'POST',
        body: JSON.stringify({
          capability,
          businessId: businessId.trim(),
          contactId: contactId.trim() || null,
          campaignId: campaignId.trim() || null,
          opportunityId: opportunityId.trim() || null,
          replyText: replyText.trim() || null,
          managerNotes: managerNotes.trim() || null,
        }),
      })
      setRun(res.run)
      toast.success('Suggestion ready — review before acting.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Assistant failed')
    } finally {
      setRunning(false)
    }
  }, [businessId, contactId, campaignId, opportunityId, replyText, managerNotes, capability])

  const appendToPipeline = useCallback(async () => {
    if (!run || !opportunityId.trim()) {
      toast.error('Set opportunity ID to append notes to pipeline.')
      return
    }
    const text = [
      run.result.title,
      run.result.summary,
      ...run.result.bulletActions.map((a) => `• ${a}`),
      run.result.inspectionNotes ? `\nInspection:\n${run.result.inspectionNotes}` : '',
      run.result.quoteSummary ? `\nQuote:\n${run.result.quoteSummary}` : '',
    ]
      .filter(Boolean)
      .join('\n')
    try {
      await salesEngineFetch('/api/sales/assistant/append-notes', {
        method: 'POST',
        body: JSON.stringify({ opportunityId: opportunityId.trim(), text }),
      })
      toast.success('Appended to pipeline notes (manager action).')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save notes')
    }
  }, [run, opportunityId])

  return (
    <div className="w-full min-w-0 max-w-6xl space-y-6">
      <header>
        <Link
          href="/dashboard/sales-engine"
          className="text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          ← Sales Engine
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">AI sales assistant</h1>
        <p className="mt-1 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          {SALES_ASSISTANT_DISCLAIMER} Never sends email automatically.
        </p>
      </header>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">Context</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Business ID *" value={businessId} onChange={setBusinessId} />
          <Field label="Contact ID" value={contactId} onChange={setContactId} />
          <Field label="Campaign ID" value={campaignId} onChange={setCampaignId} />
          <Field label="Pipeline opportunity ID" value={opportunityId} onChange={setOpportunityId} />
        </div>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Prospect reply (for summarise)</span>
          <textarea
            rows={5}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Paste reply email text…"
          />
        </label>
        <label className="block text-sm">
          <span className="font-medium text-slate-700">Manager notes</span>
          <textarea
            rows={2}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={managerNotes}
            onChange={(e) => setManagerNotes(e.target.value)}
          />
        </label>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <h2 className="text-lg font-semibold text-slate-900">Capability</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {SALES_ASSISTANT_CAPABILITIES.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setCapability(id)}
              className={`rounded-full px-3 py-1.5 text-sm font-medium border ${
                capability === id
                  ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              {SALES_ASSISTANT_CAPABILITY_LABELS[id]}
            </button>
          ))}
        </div>
        <button
          type="button"
          disabled={running}
          onClick={() => void execute()}
          className="mt-4 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {running ? 'Generating…' : 'Generate suggestion'}
        </button>
      </section>

      {run ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{run.result.title}</h2>
              <p className="mt-1 text-xs text-slate-500">
                {run.provider} · {run.latencyMs}ms · {SALES_ASSISTANT_CAPABILITY_LABELS[run.capability]}
              </p>
            </div>
            {opportunityId.trim() ? (
              <button
                type="button"
                onClick={() => void appendToPipeline()}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Append to pipeline notes
              </button>
            ) : null}
          </div>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{run.result.summary}</p>
          {run.result.sections.map((s) => (
            <div key={s.heading}>
              <h3 className="text-sm font-semibold text-slate-900">{s.heading}</h3>
              <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{s.body}</p>
            </div>
          ))}
          {run.result.bulletActions.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-slate-800 space-y-1">
              {run.result.bulletActions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          {run.result.recommendedProducts?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Products</h3>
              <ul className="mt-2 space-y-2 text-sm">
                {run.result.recommendedProducts.map((p) => (
                  <li key={p.slug} className="rounded-lg bg-slate-50 p-3">
                    <span className="font-medium">{p.label}</span>
                    <p className="text-slate-600">{p.rationale}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {run.result.followUpDraft ? (
            <div className="rounded-lg border border-indigo-100 bg-indigo-50/50 p-3 text-sm">
              <h3 className="font-semibold text-slate-900">Follow-up (talking points only)</h3>
              <p className="text-slate-600">Timing: {run.result.followUpDraft.suggestedTiming}</p>
              <ul className="mt-2 list-disc pl-5">
                {run.result.followUpDraft.talkingPoints.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-500">{run.result.followUpDraft.note}</p>
            </div>
          ) : null}
          {run.result.inspectionNotes ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Inspection notes</h3>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-700 font-sans">
                {run.result.inspectionNotes}
              </pre>
            </div>
          ) : null}
          {run.result.quoteSummary ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Quote summary</h3>
              <pre className="mt-1 whitespace-pre-wrap text-sm text-slate-700 font-sans">
                {run.result.quoteSummary}
              </pre>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
