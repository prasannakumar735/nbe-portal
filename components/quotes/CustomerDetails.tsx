import type { UseFormRegister } from 'react-hook-form'
import type { ServiceQuoteFormValues } from './types'

type CustomerDetailsProps = {
  register: UseFormRegister<ServiceQuoteFormValues>
}

export function CustomerDetails({ register }: CustomerDetailsProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Company name</h2>
      <p className="mt-1 text-xs text-slate-500">
        Enter phone and site address; company name updates automatically from those fields.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Phone
          <input
            type="tel"
            {...register('phone')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Contact Person
          <input
            {...register('contactPerson')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Email
          <input
            type="email"
            {...register('customerEmail')}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
          Site Address
          <textarea
            rows={2}
            {...register('siteAddress', { required: true })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
          Company name
          <input
            {...register('customerCompany', { required: true })}
            readOnly
            aria-readonly="true"
            className="cursor-not-allowed rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
          />
        </label>
      </div>
    </section>
  )
}
