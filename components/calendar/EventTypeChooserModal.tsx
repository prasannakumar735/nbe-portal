'use client'

import { X } from 'lucide-react'

type Props = {
  open: boolean
  onClose: () => void
  onSelectEmployee: () => void
  onSelectClientReminder: () => void
  showClientReminder: boolean
}

export function EventTypeChooserModal({
  open,
  onClose,
  onSelectEmployee,
  onSelectClientReminder,
  showClientReminder,
}: Props) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button type="button" className="fixed inset-0 bg-black/30 backdrop-blur-sm" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Select event type</h2>
            <p className="mt-0.5 text-sm text-gray-500">Choose what you want to create.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="mt-4 space-y-2">
          <button
            type="button"
            onClick={() => {
              onClose()
              onSelectEmployee()
            }}
            className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-900 shadow-sm transition hover:border-blue-300 hover:bg-blue-50"
          >
            Employee
            <span className="mt-0.5 block text-xs font-normal text-gray-500">Schedule work, leave, or meetings on the calendar.</span>
          </button>
          {showClientReminder && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onSelectClientReminder()
              }}
              className="w-full rounded-lg border border-gray-200 bg-white px-4 py-3 text-left text-sm font-semibold text-gray-900 shadow-sm transition hover:border-teal-300 hover:bg-teal-50"
            >
              Client reminder (service due)
              <span className="mt-0.5 block text-xs font-normal text-gray-500">
                Set maintenance due date and reminder lead time for a client.
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
