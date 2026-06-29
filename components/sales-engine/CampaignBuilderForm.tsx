'use client'

import type { SalesCampaignTypeRecord, SalesOfferTypeRecord } from '@/lib/sales/types/campaignLookup.types'

export type CampaignBuilderFormValues = {
  name: string
  campaignTypeId: string
  offerTypeId: string
}

type CampaignBuilderFormProps = {
  values: CampaignBuilderFormValues
  onChange: (patch: Partial<CampaignBuilderFormValues>) => void
  campaignTypes: SalesCampaignTypeRecord[]
  offerTypes: SalesOfferTypeRecord[]
  catalogLoading?: boolean
  disabled?: boolean
  fieldErrors?: Partial<Record<keyof CampaignBuilderFormValues, string>>
}

export function CampaignBuilderForm({
  values,
  onChange,
  campaignTypes,
  offerTypes,
  catalogLoading = false,
  disabled = false,
  fieldErrors,
}: CampaignBuilderFormProps) {
  const fieldsDisabled = disabled || catalogLoading

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">Campaign Details</h2>
      <p className="mt-1 text-sm text-slate-600">Define the campaign before saving a draft.</p>

      {catalogLoading ? (
        <p className="mt-3 text-sm text-slate-500">Loading campaign catalog…</p>
      ) : null}

      <div className="mt-4 space-y-4 max-w-xl">
        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="campaign-name">
            Campaign Name
          </label>
          <input
            id="campaign-name"
            type="text"
            value={values.name}
            disabled={fieldsDisabled}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="Melbourne Warehouses June Campaign"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
          />
          {fieldErrors?.name ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="campaign-type">
            Campaign Type
          </label>
          <select
            id="campaign-type"
            value={values.campaignTypeId}
            disabled={fieldsDisabled}
            onChange={(e) => onChange({ campaignTypeId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
          >
            <option value="">Select campaign type</option>
            {campaignTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          {fieldErrors?.campaignTypeId ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.campaignTypeId}</p>
          ) : null}
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700" htmlFor="offer-type">
            Offer Type
          </label>
          <select
            id="offer-type"
            value={values.offerTypeId}
            disabled={fieldsDisabled}
            onChange={(e) => onChange({ offerTypeId: e.target.value })}
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50"
          >
            <option value="">Select offer type</option>
            {offerTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          {fieldErrors?.offerTypeId ? (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.offerTypeId}</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}
