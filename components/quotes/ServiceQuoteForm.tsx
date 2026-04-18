'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { QuoteHeader } from './QuoteHeader'
import { CustomerDetails } from './CustomerDetails'
import { ServiceTemplateSelector } from './ServiceTemplateSelector'
import { LineItemsTable } from './LineItemsTable'
import { QuoteSummary } from './QuoteSummary'
import { PDFDownloadLink } from '@react-pdf/renderer'
import { QuotePDF } from './QuotePDF'
import type { ServiceQuoteFormValues } from './types'
import NBELogo from '@/components/common/NBELogo'

const currency = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

function createQuoteNumber() {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const token = String(now.getTime()).slice(-5)
  return `RRD-${year}${month}${day}-${token}`
}

const emptyDefaults = (): ServiceQuoteFormValues => ({
  quoteNumber: createQuoteNumber(),
  serviceDate: new Date().toISOString().split('T')[0],
  companyName: 'NBE Australia Pty Ltd',
  abn: '17 007 048 008',
  companyAddress: '22a Humeside Drive, Campbellfield Victoria 3061 Australia',
  companyEmail: 'accountsreceivable@nbeaustralia.com.au',
  customerCompany: '',
  contactPerson: '',
  phone: '',
  customerEmail: '',
  siteAddress: '',
  items: [
    {
      description: 'Conducted scheduled service on rapid roller doors',
      width: '',
      height: '',
      qty: 1,
      unitPrice: 0,
    },
  ],
  notes:
    'Should you require any further information or clarification about this quotation, please do not hesitate to contact us.',
  printedName: '',
  signatureDate: new Date().toISOString().split('T')[0],
})

export type ServiceQuoteFormProps = {
  mode?: 'create' | 'edit'
  quoteId?: string | null
  initialValues?: ServiceQuoteFormValues | null
}

export function ServiceQuoteForm({ mode = 'create', quoteId = null, initialValues = null }: ServiceQuoteFormProps) {
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
      const q = Number.isFinite(qty) ? qty : 0
      const u = Number.isFinite(unitPrice) ? unitPrice : 0
      return sum + q * u
    }, 0)
  }, [watchedItems])

  const gst = subtotal * 0.1
  const grandTotal = subtotal + gst

  const handleApplyTemplate = (descriptions: string[]) => {
    descriptions.forEach(description => {
      append({ description, width: '', height: '', qty: 1, unitPrice: 0 })
    })
  }

  const onSubmit = async (values: ServiceQuoteFormValues) => {
    setErrorMessage(null)
    setStatusMessage(`Quote generated: ${values.quoteNumber}`)
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
          description: String(item.description ?? '').trim(),
          total: Number(item.qty || 0) * Number(item.unitPrice || 0),
        }))
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
      if (items.length === 0) {
        throw new Error('Add at least one line item with a description (remove empty rows or fill them in).')
      }

      const saveSubtotal = items.reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.unitPrice || 0), 0)
      const saveGst = saveSubtotal * 0.1
      const saveTotal = saveSubtotal + saveGst

      const body = {
        quote_number: values.quoteNumber,
        customer_name: String(values.customerCompany).trim(),
        site_address: String(values.siteAddress).trim(),
        service_date: values.serviceDate,
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
        setStatusMessage('Quote updated in Supabase.')
      } else {
        setStatusMessage('Quote saved to Supabase.')
        setValue('quoteNumber', createQuoteNumber())
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
    <div className="mx-auto w-full max-w-[210mm] space-y-5 px-4 py-6 print:max-w-none print:px-0 print:py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link
          href="/dashboard/quotes/service"
          className="text-sm font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 hover:text-slate-900"
        >
          Back to Service Quote
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

      <header className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm print:shadow-none">
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <NBELogo />
          <div className="text-right">
            <h2 className="text-xl font-bold text-slate-900">Service Quote</h2>
            <p className="text-sm text-slate-600">NBE Australia</p>
          </div>
        </div>
        <p className="mt-4 text-sm text-slate-600">Rapid Roller Door Service • Rapid Door Maintenance • Rapid Door Parts</p>
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
        <QuoteHeader register={register} />
        <CustomerDetails register={register} onFillCompanyFromPhoneSite={fillCustomerCompanyFromPhoneAndSite} />
        <ServiceTemplateSelector onApplyTemplate={handleApplyTemplate} />
        <LineItemsTable
          fields={fields}
          register={register}
          remove={remove}
          append={append}
          watchedItems={watchedItems}
        />

        <QuoteSummary subtotal={subtotal} gst={gst} grandTotal={grandTotal} />

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Notes</h2>
          <textarea
            rows={3}
            {...register('notes')}
            className="mt-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
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
            Generate Quote
          </button>
          <button
            type="button"
            onClick={handleSaveQuote}
            disabled={isSaving}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800"
          >
            {isSaving ? 'Saving...' : mode === 'edit' ? 'Update Quote (Supabase)' : 'Save Quote (Supabase)'}
          </button>
          <PDFDownloadLink
            document={
              <QuotePDF
                data={{
                  values: watchedValues,
                  subtotal,
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
