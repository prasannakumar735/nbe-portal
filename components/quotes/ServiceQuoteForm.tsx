'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { QuoteHeader } from './QuoteHeader'
import { CustomerDetails } from './CustomerDetails'
import { LineItemsTable } from './LineItemsTable'
import { QuoteSummary } from './QuoteSummary'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { QuotePDF } from './QuotePDF'
import type { ServiceQuoteFormValues } from './types'
import { QuoteTaxonomyFields } from './QuoteTaxonomyFields'
import NBELogo from '@/components/common/NBELogo'
import { defaultSubCategoryForType, subCategoryAllowed } from '@/lib/quotes/quoteTaxonomy'
import type { QuoteTypeSlug } from '@/lib/quotes/quoteTaxonomy'
import { lineItemsForTaxonomy } from '@/lib/quotes/serviceQuoteTemplates'
import { fetchNextQuoteNumberClient } from '@/lib/quotes/fetchNextQuoteNumberClient'
import { localDateKeyYmd, quoteNumberPrefixForServiceTaxonomy } from '@/lib/quotes/quoteNumberPolicy'

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

const emptyDefaults = (): ServiceQuoteFormValues => {
  const defaultServiceSub = defaultSubCategoryForType('service')
  const today = new Date().toISOString().split('T')[0]
  return {
    quoteNumber: '',
    serviceDate: today,
    validUntil: addDays(today, 30),
    salesperson: '',
    paymentTerms: '',
    quoteType: 'service',
    quoteSubCategory: defaultServiceSub,
    companyName: 'NBE Australia Pty Ltd',
    abn: '17 007 048 008',
    companyAddress: '22a Humeside Drive, Campbellfield Victoria 3061 Australia',
    companyEmail: 'accountsreceivable@nbeaustralia.com.au',
    customerCompany: '',
    contactPerson: '',
    phone: '',
    customerEmail: '',
    siteAddress: '',
    items:
      lineItemsForTaxonomy('service', defaultServiceSub) ?? [
        {
          description: 'Conducted scheduled service on rapid roller doors',
          width: '',
          height: '',
          qty: 1,
          unitPrice: 0,
        },
      ],
    discountPercent: 0,
    hidePricing: false,
    notes:
      'Should you require any further information or clarification about this quotation, please do not hesitate to contact us.',
    printedName: '',
    signatureDate: today,
  }
}

export type ServiceQuoteFormProps = {
  mode?: 'create' | 'edit'
  quoteId?: string | null
  initialValues?: ServiceQuoteFormValues | null
  /** Use `external` when classification is chosen outside this form (e.g. unified new-quote flow). */
  classificationMode?: 'internal' | 'external'
  externalClassification?: { quoteType: QuoteTypeSlug; quoteSubCategory: string }
  /** Rendered as first block inside the form (below logo header), e.g. unified new-quote classification picks. */
  classificationSlot?: ReactNode
}

export function ServiceQuoteForm({
  mode = 'create',
  quoteId = null,
  initialValues = null,
  classificationMode = 'internal',
  externalClassification,
  classificationSlot,
}: ServiceQuoteFormProps) {
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
  } = useForm<ServiceQuoteFormValues>({
    defaultValues: initialValues ?? emptyDefaults(),
  })

  useEffect(() => {
    if (initialValues) {
      reset(initialValues)
    }
  }, [initialValues, reset])

  const quoteType = watch('quoteType')
  const quoteSubCategory = watch('quoteSubCategory')
  const hidePricing = watch('hidePricing')
  const watchedDiscountPercent = watch('discountPercent')
  const taxonomyTemplatePrevRef = useRef<{ type: string; sub: string } | null>(null)

  useEffect(() => {
    if (classificationMode !== 'external' || !externalClassification) return
    setValue('quoteType', externalClassification.quoteType)
    setValue('quoteSubCategory', externalClassification.quoteSubCategory)
  }, [
    classificationMode,
    externalClassification?.quoteType,
    externalClassification?.quoteSubCategory,
    setValue,
  ])

  useEffect(() => {
    if (classificationMode === 'external') return
    const t = quoteType as QuoteTypeSlug
    if (!subCategoryAllowed(t, String(quoteSubCategory ?? ''))) {
      setValue('quoteSubCategory', defaultSubCategoryForType(t), { shouldDirty: true })
    }
  }, [classificationMode, quoteType, quoteSubCategory, setValue])

  /** When classification matches a preset (e.g. Service → 6 Month Service), use the same line items as the template picker. */
  useEffect(() => {
    if (mode === 'edit') return
    const t = quoteType as QuoteTypeSlug
    const sub = String(quoteSubCategory ?? '').trim()
    if (!subCategoryAllowed(t, sub)) return
    const nextItems = lineItemsForTaxonomy(t, sub)
    if (!nextItems) return
    const prev = taxonomyTemplatePrevRef.current
    const isUserTaxonomyChange = prev !== null && (prev.type !== t || prev.sub !== sub)
    taxonomyTemplatePrevRef.current = { type: t, sub }
    setValue('items', nextItems, { shouldDirty: isUserTaxonomyChange })
  }, [mode, quoteType, quoteSubCategory, setValue])

  /** Sequential RRD / SWD quote number for the local calendar day (from `quotes` table). */
  useEffect(() => {
    if (mode === 'edit') return
    let cancelled = false
    const dateKey = localDateKeyYmd(new Date())
    const prefix = quoteNumberPrefixForServiceTaxonomy(quoteType as QuoteTypeSlug, String(quoteSubCategory ?? ''))
    ;(async () => {
      try {
        const qn = await fetchNextQuoteNumberClient(prefix, dateKey)
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
  }, [mode, quoteType, quoteSubCategory, setValue])

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

  const subtotal = useMemo(() => {
    return watchedItems.reduce((sum, row) => {
      const qty = Number(row?.qty ?? 0)
      const unitPrice = Number(row?.unitPrice ?? 0)
      const computed = Number.isFinite(qty) && Number.isFinite(unitPrice) ? qty * unitPrice : 0
      const override = Number(row?.totalOverride)
      const rowTotal = !isNaN(override) && row?.totalOverride !== undefined && row?.totalOverride !== null
        ? override
        : computed
      return sum + rowTotal
    }, 0)
  }, [watchedItems])

  const discountPercent = useMemo(() => {
    const d = Number(watchedDiscountPercent ?? 0)
    return Number.isFinite(d) && d > 0 ? Math.min(d, 100) : 0
  }, [watchedDiscountPercent])

  const discount = subtotal * (discountPercent / 100)
  const afterDiscount = subtotal - discount
  const gst = afterDiscount * 0.1
  const grandTotal = afterDiscount + gst

  const onSubmit = async (values: ServiceQuoteFormValues) => {
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
        .map(item => {
          const computed = Number(item.qty || 0) * Number(item.unitPrice || 0)
          const override = Number(item.totalOverride)
          const total = !isNaN(override) && item.totalOverride !== undefined && item.totalOverride !== null
            ? override
            : computed
          return {
            ...item,
            description: String(item.description ?? '').trim(),
            total,
          }
        })
        .filter(item => item.description.length > 0)

      if (!String(values.customerCompany ?? '').trim()) {
        throw new Error('Company name is required.')
      }
      if (!String(values.siteAddress ?? '').trim()) {
        throw new Error('Site address is required.')
      }
      if (!String(values.serviceDate ?? '').trim()) {
        throw new Error('Quote date is required.')
      }
      const qt = values.quoteType as QuoteTypeSlug
      if (!subCategoryAllowed(qt, String(values.quoteSubCategory ?? '').trim())) {
        throw new Error('Choose a valid sub-category for the selected quote type.')
      }
      if (items.length === 0) {
        throw new Error('Add at least one line item with a description (remove empty rows or fill them in).')
      }

      const saveSubtotal = items.reduce((sum, item) => sum + item.total, 0)
      const saveDiscountPct = Number(values.discountPercent ?? 0)
      const discountPct = Number.isFinite(saveDiscountPct) && saveDiscountPct > 0 ? Math.min(saveDiscountPct, 100) : 0
      const discountAmt = saveSubtotal * (discountPct / 100)
      const saveGst = (saveSubtotal - discountAmt) * 0.1
      const saveTotal = saveSubtotal - discountAmt + saveGst

      const body = {
        quote_number: values.quoteNumber,
        customer_name: String(values.customerCompany).trim(),
        site_address: String(values.siteAddress).trim(),
        service_date: values.serviceDate,
        valid_until: values.validUntil || null,
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
          const prefix = quoteNumberPrefixForServiceTaxonomy(
            getValues('quoteType') as QuoteTypeSlug,
            String(getValues('quoteSubCategory') ?? ''),
          )
          const nextNum = await fetchNextQuoteNumberClient(prefix, dateKey)
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
            <h2 className="text-xl font-bold text-slate-900">Quote</h2>
            <p className="text-sm text-slate-600">NBE Australia</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-600">
          Rapid Roller Door Service • Rapid Door Maintenance • Rapid Door Parts
        </p>
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
        ) : classificationMode === 'internal' ? (
          <QuoteTaxonomyFields
            register={register}
            quoteType={quoteType as QuoteTypeSlug}
            quoteSubCategory={String(quoteSubCategory ?? '')}
          />
        ) : null}
        <QuoteHeader register={register} />
        <CustomerDetails register={register} onFillCompanyFromPhoneSite={fillCustomerCompanyFromPhoneAndSite} />
        <LineItemsTable
          fields={fields}
          register={register}
          setValue={setValue}
          remove={remove}
          append={append}
          watchedItems={watchedItems}
          hidePricing={hidePricing}
        />

        {/* Discount field */}
        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Discount</h2>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Discount (%)
              <div className="relative flex items-center">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  {...register('discountPercent', { valueAsNumber: true })}
                  placeholder="0"
                  className="w-32 rounded-md border border-slate-300 py-2 pl-3 pr-7 text-sm"
                />
                <span className="pointer-events-none absolute right-2.5 text-sm text-slate-500">%</span>
              </div>
            </label>
            {discountPercent > 0 && (
              <div className="flex flex-col gap-0.5 pb-0.5 text-sm">
                <span className="text-slate-500">
                  = −{currency.format(discount)} off subtotal of {currency.format(subtotal)}
                </span>
                <span className="text-slate-500">Applied before GST</span>
              </div>
            )}
          </div>
        </section>

        <QuoteSummary subtotal={subtotal} discount={discount} discountPercent={discountPercent} gst={gst} grandTotal={grandTotal} />

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Notes</h2>
          <textarea
            rows={3}
            {...register('notes')}
            className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </section>

        <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <h2 className="text-base font-semibold text-slate-900">Signature</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-md border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500">
              Client Signature
            </div>
            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Name
              <input
                {...register('printedName')}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm"
              />
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
              <QuotePDF
                data={{
                  values: watchedValues,
                  subtotal,
                  discount,
                  gst,
                  grandTotal,
                }}
              />
            }
            fileName="service-quote.pdf"
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            {({ loading }) => (loading ? 'Preparing PDF...' : 'Download PDF')}
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
