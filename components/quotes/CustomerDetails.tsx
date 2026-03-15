import type { UseFormRegister } from 'react-hook-form'
import type { ServiceQuoteFormValues } from './types'

type CustomerDetailsProps = {
  register: UseFormRegister<ServiceQuoteFormValues>
}

export function CustomerDetails({ register }: CustomerDetailsProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Customer Details</h2>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Customer Company
          <input
            {...register('customerCompany', { required: true })}
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
          Phone
          <input
            {...register('phone')}
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
      </div>
    </section>
  )
}
