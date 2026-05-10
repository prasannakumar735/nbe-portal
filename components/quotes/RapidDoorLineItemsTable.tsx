import type { FieldArrayWithId, UseFieldArrayAppend, UseFieldArrayRemove, UseFormRegister } from 'react-hook-form'
import type { RapidDoorQuoteFormValues, ServiceLineItem } from './types'

type RapidDoorLineItemsTableProps = {
  fields: FieldArrayWithId<RapidDoorQuoteFormValues, 'items', 'id'>[]
  register: UseFormRegister<RapidDoorQuoteFormValues>
  remove: UseFieldArrayRemove
  append: UseFieldArrayAppend<RapidDoorQuoteFormValues, 'items'>
  watchedItems: ServiceLineItem[]
}

const blankRow: ServiceLineItem = {
  itemTitle: '',
  description: '',
  width: '',
  height: '',
  qty: 1,
  unitPrice: 0,
}

export function RapidDoorLineItemsTable({
  fields,
  register,
  remove,
  append,
  watchedItems,
}: RapidDoorLineItemsTableProps) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Door schedule</h2>
        <button
          type="button"
          onClick={() => append(blankRow)}
          className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
        >
          Add Row
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1080px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-700">
              <th className="border border-slate-300 px-2 py-2">#</th>
              <th className="border border-slate-300 px-2 py-2">Item</th>
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
                  <td className="border border-slate-300 px-2 py-2 align-top">
                    <textarea
                      rows={2}
                      {...register(`items.${index}.itemTitle`)}
                      className="w-full min-w-[140px] rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2 align-top">
                    <textarea
                      rows={3}
                      {...register(`items.${index}.description`)}
                      className="w-full min-w-[200px] rounded-md border border-slate-300 px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2 align-top">
                    <input
                      {...register(`items.${index}.width`)}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2 align-top">
                    <input
                      {...register(`items.${index}.height`)}
                      className="w-24 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2 align-top">
                    <input
                      type="number"
                      min={0}
                      step="1"
                      {...register(`items.${index}.qty`, { valueAsNumber: true })}
                      className="w-20 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2 align-top">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                      className="w-28 rounded-md border border-slate-300 px-2 py-1"
                    />
                  </td>
                  <td className="border border-slate-300 px-2 py-2 align-top font-medium text-slate-900">
                    {new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(rowTotal)}
                  </td>
                  <td className="border border-slate-300 px-2 py-2 align-top">
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
