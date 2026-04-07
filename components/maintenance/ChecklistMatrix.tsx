'use client'

import { memo } from 'react'
import { Controller, type Control, type FieldPath } from 'react-hook-form'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import type {
  MaintenanceChecklistItem,
  MaintenanceChecklistStatus,
} from '@/lib/types/maintenance.types'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'
import { ChecklistRadioGroup } from './ChecklistRadioGroup'

const COLUMNS: Array<{ key: MaintenanceChecklistStatus; label: string }> = [
  { key: 'good', label: 'GOOD' },
  { key: 'caution', label: 'CAUTION' },
  { key: 'fault', label: 'FAULT' },
  { key: 'na', label: 'N/A' },
]

type ChecklistRowItem = MaintenanceChecklistItem & { sectionChanged: boolean }

type ChecklistRowProps = {
  control: Control<MaintenanceFormValues>
  doorIndex: number
  item: ChecklistRowItem
  variant: 'mobile' | 'desktop'
}

/**
 * Single checklist row. Uses Controller so only this row re-renders when its value changes.
 * Field name: doors.{doorIndex}.checklist.{itemCode} (e.g. doors.0.checklist.a01)
 * RadioGroup binds value and onValueChange (no onChange) so selection updates correctly.
 */
const ChecklistRow = memo(function ChecklistRow({
  control,
  doorIndex,
  item,
  variant,
}: ChecklistRowProps) {
  const fieldName = `doors.${doorIndex}.checklist.${item.code}` as FieldPath<MaintenanceFormValues>

  return (
    <Controller
      control={control}
      name={fieldName}
      defaultValue={null}
      render={({ field }) => {
        const radioName = `checklist-${doorIndex}-${item.code}`
        const onValueChange = (value: string) => {
          console.log('Updating checklist:', doorIndex, item.code, value)
          field.onChange(value)
        }

        if (variant === 'mobile') {
          return (
            <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
              {item.sectionChanged && (
                <div className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  {item.section}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">{item.code.toUpperCase()}</p>
                <p className="text-sm text-slate-700">{item.label}</p>
              </div>
              <ChecklistRadioGroup
                value={typeof field.value === 'string' ? field.value : ''}
                onValueChange={onValueChange}
                name={radioName}
                variant="mobile"
              />
            </div>
          )
        }
        return (
          <div className="grid grid-cols-[1fr_60px_75px_60px_50px] border-t border-slate-200">
            <div className="px-3 py-3 align-top text-sm text-slate-700">
              {item.sectionChanged && (
                <div className="mb-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                  {item.section}
                </div>
              )}
              <p className="font-semibold text-slate-900">{item.code.toUpperCase()}</p>
              <p>{item.label}</p>
            </div>
            <div className="col-span-4 flex items-center py-3">
              <ChecklistRadioGroup
                value={typeof field.value === 'string' ? field.value : ''}
                onValueChange={onValueChange}
                name={radioName}
                variant="desktop"
              />
            </div>
          </div>
        )
      }}
    />
  )
})

const ITEMS_WITH_SECTION: ChecklistRowItem[] = MAINTENANCE_CHECKLIST_ITEMS.map((item, index, list) => ({
  ...item,
  sectionChanged: index === 0 || list[index - 1]?.section !== item.section,
}))

type ChecklistSectionProps = {
  control: Control<MaintenanceFormValues>
  doorIndex: number
}

/**
 * Checklist section for one door. Renders ChecklistRow for each item with stable key (item.code).
 * Only the clicked row re-renders thanks to Controller per row.
 */
export const ChecklistSection = memo(function ChecklistSection({
  control,
  doorIndex,
}: ChecklistSectionProps) {
  return (
    <div className="space-y-4">
      <div className="block space-y-4 md:hidden">
        {ITEMS_WITH_SECTION.map(item => (
          <ChecklistRow
            key={item.code}
            control={control}
            doorIndex={doorIndex}
            item={item}
            variant="mobile"
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[1fr_60px_75px_60px_50px] border-b border-slate-200 bg-slate-50">
            <div className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
              Checklist Item
            </div>
            {COLUMNS.map(column => (
              <div
                key={column.key}
                className="flex items-center justify-center px-1 py-3 text-xs font-bold uppercase tracking-wide text-slate-600"
              >
                {column.label}
              </div>
            ))}
          </div>
          {ITEMS_WITH_SECTION.map(item => (
            <ChecklistRow
              key={item.code}
              control={control}
              doorIndex={doorIndex}
              item={item}
              variant="desktop"
            />
          ))}
        </div>
      </div>
    </div>
  )
})

/** @deprecated Use ChecklistSection with control and doorIndex for Controller-based updates. */
type ChecklistMatrixProps = {
  value: Record<string, MaintenanceChecklistStatus | null>
  onChange: (itemCode: string, status: MaintenanceChecklistStatus) => void
}

export function ChecklistMatrix({ value, onChange }: ChecklistMatrixProps) {
  return (
    <div className="space-y-4">
      <div className="block space-y-4 md:hidden">
        {ITEMS_WITH_SECTION.map(item => (
          <ChecklistRowMobileLegacy
            key={item.code}
            item={item}
            selectedValue={value[item.code] ?? null}
            onChange={onChange}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white md:block">
        <div className="min-w-[600px]">
          <div className="grid grid-cols-[1fr_repeat(4,80px)] border-b border-slate-200 bg-slate-50">
            <div className="px-3 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
              Checklist Item
            </div>
            {COLUMNS.map(column => (
              <div
                key={column.key}
                className="px-2 py-3 text-center text-xs font-bold uppercase tracking-wide text-slate-600"
              >
                {column.label}
              </div>
            ))}
          </div>
          {ITEMS_WITH_SECTION.map(item => (
            <ChecklistRowDesktopLegacy
              key={item.code}
              item={item}
              selectedValue={value[item.code] ?? null}
              onChange={onChange}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

type LegacyRowProps = {
  item: ChecklistRowItem
  selectedValue: MaintenanceChecklistStatus | null
  onChange: (itemCode: string, status: MaintenanceChecklistStatus) => void
}

const ChecklistRowMobileLegacy = memo(function ChecklistRowMobileLegacy({
  item,
  selectedValue,
  onChange,
}: LegacyRowProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      {item.sectionChanged && (
        <div className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
          {item.section}
        </div>
      )}
      <div>
        <p className="text-sm font-semibold text-slate-900">{item.code.toUpperCase()}</p>
        <p className="text-sm text-slate-700">{item.label}</p>
      </div>
      <div className="flex flex-col gap-2">
        {COLUMNS.map(column => (
          <label
            key={`${item.code}-${column.key}`}
            className="flex items-center gap-2 text-sm text-slate-700"
          >
            <input
              type="radio"
              className="h-5 w-5"
              name={`checklist-${item.code}`}
              checked={selectedValue === column.key}
              onChange={() => onChange(item.code, column.key)}
            />
            <span>{column.label}</span>
          </label>
        ))}
      </div>
    </div>
  )
})

const ChecklistRowDesktopLegacy = memo(function ChecklistRowDesktopLegacy({
  item,
  selectedValue,
  onChange,
}: LegacyRowProps) {
  return (
    <div className="grid grid-cols-[1fr_repeat(4,80px)] border-t border-slate-200">
      <div className="px-3 py-3 align-top text-sm text-slate-700">
        {item.sectionChanged && (
          <div className="mb-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">
            {item.section}
          </div>
        )}
        <p className="font-semibold text-slate-900">{item.code.toUpperCase()}</p>
        <p>{item.label}</p>
      </div>
      {COLUMNS.map(column => (
        <div key={`${item.code}-${column.key}`} className="px-2 py-3 text-center">
          <label className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-slate-300">
            <input
              type="radio"
              className="h-5 w-5"
              name={`checklist-${item.code}`}
              checked={selectedValue === column.key}
              onChange={() => onChange(item.code, column.key)}
            />
          </label>
        </div>
      ))}
    </div>
  )
})
