'use client'

import type { UseFormRegister } from 'react-hook-form'
import type { ServiceQuoteFormValues } from '@/components/quotes/types'
import {
  QUOTE_SUB_CATEGORIES,
  QUOTE_TYPE_LABELS,
  QUOTE_TYPE_SLUGS,
  formatQuoteTaxonomyLine,
  isQuoteTypeSlug,
  type QuoteTypeSlug,
} from '@/lib/quotes/quoteTaxonomy'

type Props = {
  register: UseFormRegister<ServiceQuoteFormValues>
  quoteType: QuoteTypeSlug | string
  quoteSubCategory: string
  disabled?: boolean
}

export function QuoteTaxonomyFields({ register, quoteType, quoteSubCategory, disabled }: Props) {
  const rawType = String(quoteType ?? '').trim().toLowerCase()
  const safeType: QuoteTypeSlug = isQuoteTypeSlug(rawType) ? rawType : 'service'
  const subOpts = QUOTE_SUB_CATEGORIES[safeType]

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Quote classification</h2>
      <p className="mt-1 text-xs text-slate-500">
        Quote type and sub-category (saved with this quote).
        {disabled ? (
          <span className="mt-1 block font-normal text-slate-600">
            Summary: {formatQuoteTaxonomyLine(safeType, quoteSubCategory)}
          </span>
        ) : null}
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Quote type
          <select
            {...register('quoteType')}
            disabled={disabled}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-700"
          >
            {QUOTE_TYPE_SLUGS.map(slug => (
              <option key={slug} value={slug}>
                {QUOTE_TYPE_LABELS[slug]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Sub-category
          <select
            {...register('quoteSubCategory')}
            disabled={disabled}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-700"
          >
            {subOpts.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  )
}
