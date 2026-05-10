'use client'

import {
  QUOTE_SUB_CATEGORIES,
  QUOTE_TYPE_LABELS,
  QUOTE_TYPE_SLUGS,
  defaultSubCategoryForType,
  subCategoryAllowed,
  type QuoteTypeSlug,
} from '@/lib/quotes/quoteTaxonomy'

type Props = {
  quoteType: QuoteTypeSlug
  quoteSubCategory: string
  onQuoteTypeChange: (t: QuoteTypeSlug) => void
  onQuoteSubCategoryChange: (s: string) => void
}

export function QuoteClassificationPick({
  quoteType,
  quoteSubCategory,
  onQuoteTypeChange,
  onQuoteSubCategoryChange,
}: Props) {
  const subOpts = QUOTE_SUB_CATEGORIES[quoteType]

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Quote classification</h2>
      <p className="mt-1 text-xs text-slate-500">
        Choose quote type and sub-category first. <strong>New Installation → Rapid Door</strong> opens the industrial rapid door quotation builder.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Quote type
          <select
            value={quoteType}
            onChange={e => {
              const next = e.target.value as QuoteTypeSlug
              onQuoteTypeChange(next)
              if (!subCategoryAllowed(next, quoteSubCategory)) {
                onQuoteSubCategoryChange(defaultSubCategoryForType(next))
              }
            }}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
            value={subOpts.some(o => o.value === quoteSubCategory) ? quoteSubCategory : subOpts[0]?.value ?? ''}
            onChange={e => onQuoteSubCategoryChange(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
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
