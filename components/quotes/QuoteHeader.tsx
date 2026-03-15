import type { UseFormRegister } from 'react-hook-form'
import type { ServiceQuoteFormValues } from './types'

type QuoteHeaderProps = {
  register: UseFormRegister<ServiceQuoteFormValues>
}

export function QuoteHeader({ register }: QuoteHeaderProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Quote Header</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Quote Number
          <input
            {...register('quoteNumber')}
            readOnly
            className="rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Service Date
          <input
            type="date"
            {...register('serviceDate')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Company Name
          <input
            {...register('companyName')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          ABN
          <input
            {...register('abn')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
          Company Address
          <input
            {...register('companyAddress')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
          Company Email
          <input
            type="email"
            {...register('companyEmail')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
    </section>
  )
}
