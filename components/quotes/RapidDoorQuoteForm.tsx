'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { QuoteHeader } from './QuoteHeader'
import { CustomerDetails } from './CustomerDetails'
import { QuoteSummary } from './QuoteSummary'
import { RapidDoorLineItemsTable } from './RapidDoorLineItemsTable'
import { RapidDoorQuotePDF } from './RapidDoorQuotePDF'
import { QuoteTaxonomyFields } from './QuoteTaxonomyFields'
import type { UseFormRegister } from 'react-hook-form'
import type { RapidDoorQuoteFormValues, ServiceQuoteFormValues } from './types'
import type { QuoteTypeSlug } from '@/lib/quotes/quoteTaxonomy'
import NBELogo from '@/components/common/NBELogo'
import { emptyRapidDoorFormValues } from '@/lib/quotes/rapidDoorDefaults'
import { fetchNextQuoteNumberClient } from '@/lib/quotes/fetchNextQuoteNumberClient'
import { localDateKeyYmd } from '@/lib/quotes/quoteNumberPolicy'

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

export type RapidDoorQuoteFormProps = {
  mode?: 'create' | 'edit'
  quoteId?: string | null
  initialValues?: RapidDoorQuoteFormValues | null
  /** Hide fixed taxonomy block (use when `classificationSlot` supplies editable picks). */
  hideQuoteClassification?: boolean
  /** Rendered first inside the form below logo header (unified new-quote flow). */
  classificationSlot?: ReactNode
}

export function RapidDoorQuoteForm({
  mode = 'create',
  quoteId = null,
  initialValues = null,
  hideQuoteClassification = false,
  classificationSlot,
}: RapidDoorQuoteFormProps) {
  const router = useRouter()
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    getValues,
    reset,
    formState: { isDirty },
  } = useForm<RapidDoorQuoteFormValues>({
    defaultValues: initialValues ?? emptyRapidDoorFormValues(),
  })

  useEffect(() => {
    if (initialValues) {
      reset(initialValues)
    }
  }, [initialValues, reset])

  useEffect(() => {
    if (mode === 'edit') return
    let cancelled = false
    const dateKey = localDateKeyYmd(new Date())
    ;(async () => {
      try {
        const qn = await fetchNextQuoteNumberClient('IRD', dateKey)
        if (!cancelled) {
          setValue('quoteNumber', qn, { shouldDirty: false })
        }
      } catch {
        if (!cancelled) {
          setErrorMessage('Could not assign quote number. Check connection and try again.')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, setValue])

  const fillCustomerCompanyFromPhoneAndSite = () => {
    const p = String(getValues('phone') ?? '').trim()
    const s = String(getValues('siteAddress') ?? '').trim()
    const combined = [p, s].filter(Boolean).join(' — ')
    setValue('customerCompany', combined, { shouldDirty: true, shouldValidate: true })
  }

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const watchedItems = useWatch({ control, name: 'items' }) ?? []
  const watchedValues = watch()
  const quoteType = watch('quoteType')
  const quoteSubCategory = watch('quoteSubCategory')

  const subtotal = useMemo(() => {
    return watchedItems.reduce((sum, row) => {
      const qty = Number(row?.qty ?? 0)
      const unitPrice = Number(row?.unitPrice ?? 0)
      const q = Number.isFinite(qty) ? qty : 0
      const u = Number.isFinite(unitPrice) ? unitPrice : 0
      return sum + q * u
    }, 0)
  }, [watchedItems])

  const gst = subtotal * 0.1
  const grandTotal = subtotal + gst

  const onSubmit = async (values: RapidDoorQuoteFormValues) => {
    setErrorMessage(null)
    setStatusMessage(
      `Quote ${values.quoteNumber}: required fields look valid. Use Save quote to store this quotation in your list.`,
    )
  }

  const handleSaveQuote = async () => {
    setErrorMessage(null)
    setStatusMessage(null)

    const values = getValues()
    const form_snapshot = values
    setIsSaving(true)

    try {
      const items = values.items
        .map(item => ({
          ...item,
          itemTitle: String(item.itemTitle ?? '').trim(),
          description: String(item.description ?? '').trim(),
          total: Number(item.qty || 0) * Number(item.unitPrice || 0),
        }))
        .filter(item => item.itemTitle.length > 0 || item.description.length > 0)

      if (!String(values.customerCompany ?? '').trim()) {
        throw new Error('Company name is required.')
      }
      if (!String(values.siteAddress ?? '').trim()) {
        throw new Error('Site address is required.')
      }
      if (!String(values.serviceDate ?? '').trim()) {
        throw new Error('Quote date is required.')
      }
      if (!String(values.validUntil ?? '').trim()) {
        throw new Error('Valid until date is required.')
      }
      if (items.length === 0) {
        throw new Error('Add at least one schedule row with an item title or description.')
      }

      const saveSubtotal = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0)
      const saveGst = saveSubtotal * 0.1
      const saveTotal = saveSubtotal + saveGst

      const body = {
        quote_number: values.quoteNumber,
        customer_name: String(values.customerCompany).trim(),
        site_address: String(values.siteAddress).trim(),
        service_date: values.serviceDate,
        valid_until: values.validUntil,
        quote_kind: 'rapid_door',
        quote_type: values.quoteType,
        quote_sub_category: values.quoteSubCategory,
        subtotal: saveSubtotal,
        gst: saveGst,
        total: saveTotal,
        items,
        form_snapshot,
      }

      const url = mode === 'edit' && quoteId ? `/api/quotes/service/${quoteId}` : '/api/quotes/service'
      const method = mode === 'edit' && quoteId ? 'PATCH' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save quote.')
      }

      if (mode === 'edit') {
        setStatusMessage('Quote updated.')
      } else {
        setStatusMessage('Quote saved.')
        try {
          const dateKey = localDateKeyYmd(new Date())
          const nextNum = await fetchNextQuoteNumberClient('IRD', dateKey)
          setValue('quoteNumber', nextNum, { shouldDirty: false })
        } catch {
          setStatusMessage(
            'Quote saved. Could not load the next quote number — refresh this page before starting another quote.',
          )
        }
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save quote.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  const handleCancel = () => {
    if (isDirty) {
      const ok = window.confirm('Discard unsaved changes and leave this page?')
      if (!ok) return
    }
    if (mode === 'edit' && quoteId) {
      router.push(`/dashboard/quotes/service/${quoteId}`)
    } else {
      router.push('/dashboard/quotes/service')
    }
  }

  return (
    <div className="w-full min-w-0 max-w-full space-y-4 py-2 sm:space-y-5 sm:py-4 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/dashboard/quotes/service"
          className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          Back to quotes
        </Link>
        {mode === 'edit' && quoteId && (
          <Link
            href={`/dashboard/quotes/service/${quoteId}`}
            className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
          >
            View this quote
          </Link>
        )}
      </div>

      <header className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print:shadow-none">
        <div className="flex flex-col gap-4 border-b border-slate-200 pb-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0 shrink-0">
            <NBELogo />
          </div>
          <div className="min-w-0 text-left sm:text-right">
            <h2 className="text-xl font-bold text-slate-900">Industrial Rapid Door</h2>
            <p className="text-sm text-slate-600">New installation quotation</p>
          </div>
        </div>
      </header>

      {statusMessage && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-700 print:hidden">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 print:hidden">
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {classificationSlot ? (
          classificationSlot
        ) : !hideQuoteClassification ? (
          <QuoteTaxonomyFields
            register={register as unknown as UseFormRegister<ServiceQuoteFormValues>}
            quoteType={quoteType as QuoteTypeSlug}
            quoteSubCategory={String(quoteSubCategory ?? '')}
            disabled
          />
        ) : null}
        <QuoteHeader register={register as unknown as UseFormRegister<ServiceQuoteFormValues>} />

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Quote validity & presentation</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Valid until
              <input
                type="date"
                {...register('validUntil')}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
              PDF subtitle (ABN line)
              <input
                {...register('quoteSubtitle')}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">NBE sales contact (PDF header)</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Name
              <input {...register('salesContactName')} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Phone
              <input
                type="tel"
                {...register('salesContactPhone')}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Email
              <input
                type="email"
                {...register('salesContactEmail')}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Scope & standard offering</h2>
          <p className="mt-1 text-xs text-slate-500">Shown on page 1 of the PDF above the customer block.</p>
          <textarea
            rows={5}
            {...register('introNote')}
            className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Customer</h2>
          <label className="mt-4 flex flex-col gap-1 text-sm text-slate-700">
            Attn
            <input {...register('attn')} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </label>
          <div className="mt-4">
            <CustomerDetails
              register={register as unknown as UseFormRegister<ServiceQuoteFormValues>}
              onFillCompanyFromPhoneSite={fillCustomerCompanyFromPhoneAndSite}
            />
          </div>
        </section>

        <RapidDoorLineItemsTable
          fields={fields}
          register={register}
          remove={remove}
          append={append}
          watchedItems={watchedItems}
        />

        <QuoteSummary subtotal={subtotal} gst={gst} grandTotal={grandTotal} />

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Schedule A (PDF page 2)</h2>
          <textarea
            rows={4}
            {...register('scheduleANotes')}
            placeholder="Additional scope, clarifications, or exclusions…"
            className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Internal notes</h2>
          <p className="mt-1 text-xs text-slate-500">Not shown on the Industrial Rapid Door PDF (use Schedule A or scope above).</p>
          <textarea rows={3} {...register('notes')} className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Signature</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
              Client Signature
            </div>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Printed name
              <input {...register('printedName')} className="rounded-md border border-slate-300 px-3 py-2 text-sm" />
            </label>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Date
              <input
                type="date"
                {...register('signatureDate')}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-2 print:hidden">
          <button type="submit" className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white">
            Verify form
          </button>
          <button
            type="button"
            onClick={handleSaveQuote}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            {isSaving ? 'Saving…' : mode === 'edit' ? 'Update saved quote' : 'Save quote'}
          </button>
          <PDFDownloadLink
            document={
              <RapidDoorQuotePDF
                data={{
                  values: watchedValues,
                  subtotal,
                  gst,
                  grandTotal,
                }}
              />
            }
            fileName={`industrial-rapid-door-${watchedValues.quoteNumber || 'quote'}.pdf`}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            {({ loading }) => (loading ? 'Preparing PDF…' : 'Download PDF')}
          </PDFDownloadLink>
          <button
            type="button"
            onClick={handlePrint}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            Print
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </form>

      <div className="hidden print:block print:text-right print:text-sm print:text-slate-600">
        Total (inc GST): {currency.format(grandTotal)}
      </div>
    </div>
  )
}
