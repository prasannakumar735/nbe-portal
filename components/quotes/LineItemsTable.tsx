import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister } from 'react-hook-form'
import type { ServiceLineItem, ServiceQuoteFormValues } from './types'

const QUICK_PART_ROWS: Record<string, ServiceLineItem> = {
  'Add Photo Cell': {
    description: 'Install new photo cells',
    width: '',
    height: '',
    qty: 1,
    unitPrice: 0,
  },
  'Add Motor': {
    description: 'Install replacement rapid door motor',
    width: '',
    height: '',
    qty: 1,
    unitPrice: 0,
  },
  'Add Side Leg': {
    description: 'Install replacement side leg',
    width: '',
    height: '',
    qty: 1,
    unitPrice: 0,
  },
  'Add Control Panel': {
    description: 'Install replacement control panel',
    width: '',
    height: '',
    qty: 1,
    unitPrice: 0,
  },
  'Add Remote': {
    description: 'Supply and program new remote',
    width: '',
    height: '',
    qty: 1,
    unitPrice: 0,
  },
}

type LineItemsTableProps = {
  fields: FieldArrayWithId<ServiceQuoteFormValues, 'items', 'id'>[]
  register: UseFormRegister<ServiceQuoteFormValues>
  remove: UseFieldArrayRemove
  append: UseFieldArrayAppend<ServiceQuoteFormValues, 'items'>
  watchedItems: ServiceLineItem[]
}

export function LineItemsTable({ fields, register, remove, append, watchedItems }: LineItemsTableProps) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Line Items</h2>
        <button
          type="button"
          onClick={() => append({ description: '', width: '', height: '', qty: 1, unitPrice: 0 })}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Add Row
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(QUICK_PART_ROWS).map(([label, item]) => (
          <button
            key={label}
            type="button"
            onClick={() => append(item)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-700">
              <th className="border border-slate-300 px-2 py-2">S.No</th>
              <th className="border border-slate-300 px-2 py-2">Description</th>
              <th className="border border-slate-300 px-2 py-2">Width</th>
              <th className="border border-slate-300 px-2 py-2">Height</th>
              <th className="border border-slate-300 px-2 py-2">Qty</th>
              <th className="border border-slate-300 px-2 py-2">Unit Price</th>
              <th className="border border-slate-300 px-2 py-2">Total</th>
              <th className="border border-slate-300 px-2 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const qty = Number(watchedItems[index]?.qty || 0)
              const unitPrice = Number(watchedItems[index]?.unitPrice || 0)
              const rowTotal = qty * unitPrice

              return (
                <tr key={field.id}>
                  <td className="border border-slate-300 px-2 py-2 align-top">{index + 1}</td>
                  <td className="border border-slate-300 px-2 py-2">
                    <textarea
                      rows={2}
                      {...register(`items.${index}.description`)}
                      className="w-full rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2">
                    <input
                      {...register(`items.${index}.width`)}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2">
                    <input
                      {...register(`items.${index}.height`)}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      {...register(`items.${index}.qty`, { valueAsNumber: true })}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2 font-medium text-slate-900">
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(rowTotal)}
                  </td>
                  <td className="border border-slate-300 px-2 py-2">
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
