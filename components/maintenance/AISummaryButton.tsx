'use client'

import { Loader2, Sparkles } from 'lucide-react'

type AISummaryButtonProps = {
  notes: string
  reportId?: string | null
  disabled?: boolean
  onApplySummary: (summary: string) => void
  onError?: (message: string) => void
  isGenerating: boolean
  setIsGenerating: (value: boolean) => void
}

export function AISummaryButton({
  notes,
  reportId = null,
  disabled = false,
  onApplySummary,
  onError,
  isGenerating,
  setIsGenerating,
}: AISummaryButtonProps) {
  const handleGenerate = async () => {
    if (disabled || isGenerating) {
      return
    }

    if (!notes.trim()) {
      onError?.('Enter technician notes before improving wording.')
      return
    }

    setIsGenerating(true)

    try {
      const response = await fetch('/api/ai-maintenance-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes, report_id: reportId || undefined }),
      })

      const responseText = await response.text()
      let data: { summary?: string; error?: string } = {}

      if (responseText) {
        try {
          data = JSON.parse(responseText) as { summary?: string; error?: string }
        } catch {
          data = { error: responseText }
        }
      }

      if (!response.ok) {
        throw new Error(data.error || `Failed to generate AI summary (${response.status})`)
      }

      if (!data.summary) {
        throw new Error('AI summary response did not include summary text.')
      }

      onApplySummary(data.summary)
    } catch (error) {
      console.error('AI Summary Button Error:', error)
      onError?.(error instanceof Error ? error.message : 'Failed to generate AI summary')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleGenerate}
      disabled={disabled || isGenerating}
      className="mt-3 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 text-sm font-bold text-slate-800 disabled:opacity-50"
    >
      {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {isGenerating ? 'Improving...' : 'Improve / Rephrase Notes'}
    </button>
  )
}
