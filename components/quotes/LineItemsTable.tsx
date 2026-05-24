'use client'

import { useState } from 'react'
import type {
  FieldArrayWithId,
  UseFieldArrayAppend,
  UseFieldArrayRemove,
  UseFormRegister,
  UseFormSetValue,
} from 'react-hook-form'
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

const fmt = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' })

type LineItemsTableProps = {
  fields: FieldArrayWithId<ServiceQuoteFormValues, 'items', 'id'>[]
  register: UseFormRegister<ServiceQuoteFormValues>
  setValue: UseFormSetValue<ServiceQuoteFormValues>
  remove: UseFieldArrayRemove
  append: UseFieldArrayAppend<ServiceQuoteFormValues, 'items'>
  watchedItems: ServiceLineItem[]
  hidePricing: boolean
}

export function LineItemsTable({
  fields,
  register,
  setValue,
  remove,
  append,
  watchedItems,
  hidePricing,
}: LineItemsTableProps) {
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set())

  function toggleNotes(index: number) {
    setExpandedNotes(prev => {
      const next = new Set(prev)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
  }

  function handleAppend(item: ServiceLineItem) {
    const sno = String(fields.length + 1)
    append({ ...item, sno })
  }

  function clearOverride(index: number) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setValue(`items.${index}.totalOverride`, undefined as any, { shouldDirty: true })
  }

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-900">Line Items</h2>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm text-amber-800">
            <input
              type="checkbox"
              {...register('hidePricing')}
              className="h-4 w-4 rounded border-amber-300 accent-amber-600"
            />
            Hide unit prices from PDF (totals still shown)
          </label>
          <button
            type="button"
            onClick={() => handleAppend({ description: '', width: '', height: '', qty: 1, unitPrice: 0 })}
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white"
          >
            Add Row
          </button>
        </div>
      </div>

      {hidePricing && (
        <p className="mt-2 text-xs text-amber-700">
          Unit prices will be hidden in the PDF / printed quote. Line totals and the overall price summary will still be shown.
        </p>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(QUICK_PART_ROWS).map(([label, item]) => (
          <button
            key={label}
            type="button"
            onClick={() => handleAppend(item)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1060px] border-collapse text-sm">
          <thead>
            <tr className="bg-slate-100 text-left text-slate-700">
              <th className="border border-slate-300 px-2 py-2 text-center" style={{ width: '5%' }}>S.No</th>
              <th className="border border-slate-300 px-2 py-2" style={{ width: '32%' }}>Description</th>
              <th className="border border-slate-300 px-2 py-2" style={{ width: '9%' }}>Width</th>
              <th className="border border-slate-300 px-2 py-2" style={{ width: '8%' }}>Height</th>
              <th className="border border-slate-300 px-2 py-2" style={{ width: '7%' }}>Qty</th>
              <th className="border border-slate-300 px-2 py-2" style={{ width: '11%' }}>Unit Price</th>
              <th className="border border-slate-300 px-2 py-2" style={{ width: '14%' }}>Total</th>
              <th className="border border-slate-300 px-2 py-2" style={{ width: '13%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field, index) => {
              const item = watchedItems[index]
              const qty = Number(item?.qty || 0)
              const unitPrice = Number(item?.unitPrice || 0)
              const computed = qty * unitPrice
              const override = Number(item?.totalOverride)
              const hasOverride =
                !isNaN(override) &&
                item?.totalOverride !== undefined &&
                item?.totalOverride !== null
              const displayTotal = hasOverride ? override : computed
              const notesOpen = expandedNotes.has(index)
              const hasNotes = Boolean(item?.itemNotes?.trim())

              return (
                <>
                  {/* Notes row — shown ABOVE the item row */}
                  {(notesOpen || hasNotes) && (
                    <tr key={`${field.id}-notes`}>
                      <td colSpan={9} className="border border-slate-300 bg-blue-50 px-3 py-2">
                        <label className="flex flex-col gap-1 text-xs text-blue-800">
                          Door / item notes (shown in PDF above this row)
                          <textarea
                            rows={2}
                            {...register(`items.${index}.itemNotes`)}
                            placeholder="e.g. Freezer door replacement — 300×2mm Freezer Temp strip"
                            className="rounded-md border border-blue-200 bg-white px-2 py-1 text-sm text-slate-800 placeholder-slate-400"
                          />
                        </label>
                      </td>
                    </tr>
                  )}

                  {/* Main item row */}
                  <tr key={field.id}>
                    <td className="border border-slate-300 px-1 py-2 align-top">
                      <input
                        {...register(`items.${index}.sno`)}
                        defaultValue={String(index + 1)}
                        placeholder={String(index + 1)}
                        className="w-full rounded border border-slate-200 px-1 py-1 text-center text-xs"
                      />
                    </td>
                    <td className="border border-slate-300 px-2 py-2">
                      <textarea
                        rows={2}
                        {...register(`items.${index}.description`)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm"
                      />
                    </td>
                    <td className="border border-slate-300 px-2 py-2 align-top">
                      <input
                        {...register(`items.${index}.width`)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="border border-slate-300 px-2 py-2 align-top">
                      <input
                        {...register(`items.${index}.height`)}
                        className="w-full rounded-md border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="border border-slate-300 px-2 py-2 align-top">
                      <input
                        type="number"
                        min={0}
                        step="1"
                        {...register(`items.${index}.qty`, { valueAsNumber: true })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="border border-slate-300 px-2 py-2 align-top">
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        {...register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                        className="w-full rounded-md border border-slate-300 px-2 py-1"
                      />
                    </td>
                    <td className="border border-slate-300 px-2 py-2 align-top">
                      <div className="space-y-1">
                        <p className={`font-medium ${hasOverride ? 'text-blue-700' : 'text-slate-900'}`}>
                          {fmt.format(displayTotal)}
                        </p>
                        {!hasOverride && (
                          <p className="text-xs text-slate-400">Auto: qty × unit</p>
                        )}
                        {hasOverride && (
                          <p className="text-xs text-blue-500">Overridden</p>
                        )}
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            {...register(`items.${index}.totalOverride`, { valueAsNumber: true })}
                            placeholder="Override $"
                            className="w-full rounded border border-slate-200 px-1 py-0.5 text-xs placeholder-slate-400"
                          />
                          {hasOverride && (
                            <button
                              type="button"
                              title="Revert to auto-calculated total"
                              onClick={() => clearOverride(index)}
                              className="shrink-0 rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                            >
                              ↺
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="border border-slate-300 px-2 py-2 align-top">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleNotes(index)}
                          className={`rounded-md border px-2 py-1 text-xs font-medium ${
                            hasNotes || notesOpen
                              ? 'border-blue-200 bg-blue-50 text-blue-700'
                              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {notesOpen ? 'Hide notes' : hasNotes ? 'Edit notes' : 'Add notes'}
                        </button>
                      </div>
                    </td>
                  </tr>
                </>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
