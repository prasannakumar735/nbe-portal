import type { UseFormRegister } from 'react-hook-form'
import type { ServiceQuoteFormValues } from './types'

type CustomerDetailsProps = {
  register: UseFormRegister<ServiceQuoteFormValues>
  onFillCompanyFromPhoneSite?: () => void
}

export function CustomerDetails({ register, onFillCompanyFromPhoneSite }: CustomerDetailsProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">Company name</h2>
      <p className="mt-1 text-xs text-slate-500">
        Enter the client company name below, or use the shortcut to copy phone and site address into that field.
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

        <div className="md:col-span-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm text-slate-700">
              Company name
              <input
                {...register('customerCompany', { required: true })}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>
            {onFillCompanyFromPhoneSite && (
              <button
                type="button"
                onClick={onFillCompanyFromPhoneSite}
                className="shrink-0 rounded-md border border-slate-300 px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50"
              >
                Fill from phone &amp; site
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
