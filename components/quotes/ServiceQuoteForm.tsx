'use client'

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

export function ServiceQuoteForm() {
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const { register, control, handleSubmit, watch, setValue } = useForm<ServiceQuoteFormValues>({
    defaultValues: {
      quoteNumber: createQuoteNumber(),
      serviceDate: new Date().toISOString().split('T')[0],
      companyName: 'NBE Australia Pty Ltd',
      abn: '17 007 048 008',
      companyAddress: '22a Humeside Drive, Campbellfield Victoria 3061 Australia',
      companyEmail: 'Service@nbeaustralia.com.au',
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
    },
  })

  const watchedPhone = useWatch({ control, name: 'phone' })
  const watchedSiteAddress = useWatch({ control, name: 'siteAddress' })

  /** Client company line is derived from phone + site address; staff edit phone and site. */
  useEffect(() => {
    const p = String(watchedPhone ?? '').trim()
    const s = String(watchedSiteAddress ?? '').trim()
    const combined = [p, s].filter(Boolean).join(' — ')
    setValue('customerCompany', combined, { shouldDirty: true, shouldValidate: true })
  }, [watchedPhone, watchedSiteAddress, setValue])

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'items',
  })

  const watchedItems = watch('items')
  const watchedValues = watch()

  const subtotal = useMemo(() => {
    return watchedItems.reduce((sum, row) => {
      const qty = Number(row.qty || 0)
      const unitPrice = Number(row.unitPrice || 0)
      return sum + qty * unitPrice
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

    const values = watch()
    setIsSaving(true)

    try {
      const items = values.items.map(item => ({
        ...item,
        total: Number(item.qty || 0) * Number(item.unitPrice || 0),
      }))

      const response = await fetch('/api/quotes/service', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          quote_number: values.quoteNumber,
          customer_name: values.customerCompany,
          site_address: values.siteAddress,
          service_date: values.serviceDate,
          subtotal,
          gst,
          total: grandTotal,
          items,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save quote.')
      }

      setStatusMessage('Quote saved to Supabase.')
      setValue('quoteNumber', createQuoteNumber())
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to save quote.')
    } finally {
      setIsSaving(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="mx-auto w-full max-w-[210mm] space-y-5 px-4 py-6 print:max-w-none print:px-0 print:py-0">
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
        <CustomerDetails register={register} />
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
              Printed Name
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
            {isSaving ? 'Saving...' : 'Save Quote (Supabase)'}
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
        </div>
      </form>

      <div className="hidden print:block print:text-right print:text-sm print:text-slate-600">
        Total (inc GST): {currency.format(grandTotal)}
      </div>
    </div>
  )
}
