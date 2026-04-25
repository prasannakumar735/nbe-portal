'use client'

import * as RadioGroup from '@radix-ui/react-radio-group'
import type { MaintenanceChecklistStatus } from '@/lib/types/maintenance.types'

const OPTIONS: Array<{
  value: MaintenanceChecklistStatus
  label: string
  /** Full Tailwind classes when selected (so JIT includes them). */
  selectedClasses: string
  unselectedClasses: string
}> = [
  {
    value: 'good',
    label: 'GOOD',
    selectedClasses: 'data-[state=checked]:bg-emerald-500 data-[state=checked]:text-white data-[state=checked]:border-transparent',
    unselectedClasses: 'border-emerald-300 hover:bg-emerald-50',
  },
  {
    value: 'caution',
    label: 'CAUTION',
    selectedClasses: 'data-[state=checked]:bg-amber-400 data-[state=checked]:text-slate-900 data-[state=checked]:border-transparent',
    unselectedClasses: 'border-amber-300 hover:bg-amber-50',
  },
  {
    value: 'fault',
    label: 'FAULT',
    selectedClasses: 'data-[state=checked]:bg-red-500 data-[state=checked]:text-white data-[state=checked]:border-transparent',
    unselectedClasses: 'border-red-300 hover:bg-red-50',
  },
  {
    value: 'na',
    label: 'N/A',
    selectedClasses: 'data-[state=checked]:bg-slate-500 data-[state=checked]:text-white data-[state=checked]:border-transparent',
    unselectedClasses: 'border-slate-300 hover:bg-slate-50',
  },
]

type ChecklistRadioGroupProps = {
  value: string
  onValueChange: (value: MaintenanceChecklistStatus) => void
  name: string
  disabled?: boolean
  variant: 'mobile' | 'desktop'
}

/**
 * Color-based inspection buttons for one checklist item.
 * Uses Radix RadioGroup for value/onValueChange and keyboard accessibility.
 * Good (green), Caution (yellow), Fault (red), N/A (gray).
 */
export function ChecklistRadioGroup({
  value,
  onValueChange,
  name,
  disabled = false,
  variant,
}: ChecklistRadioGroupProps) {
  const selectedValue = value ?? ''

  const handleValueChange = (v: string) => onValueChange(v as MaintenanceChecklistStatus)

  if (variant === 'mobile') {
    return (
      <RadioGroup.Root
        value={selectedValue}
        onValueChange={handleValueChange}
        name={name}
        disabled={disabled}
        className="flex flex-wrap gap-2"
        aria-label={name}
      >
        {OPTIONS.map(option => (
          <RadioGroup.Item
            key={option.value}
            value={option.value}
            className={`
              min-w-[4.5rem] rounded-lg border-2 border bg-white px-3 py-2 text-sm font-medium outline-none
              focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-500
              disabled:opacity-50 disabled:pointer-events-none
              ${option.unselectedClasses} ${option.selectedClasses}
            `}
          >
            {option.label}
          </RadioGroup.Item>
        ))}
      </RadioGroup.Root>
    )
  }

  return (
    <RadioGroup.Root
      value={selectedValue}
      onValueChange={handleValueChange}
      name={name}
      disabled={disabled}
      className="grid w-full grid-cols-4 gap-0"
      aria-label={name}
      orientation="horizontal"
    >
      {OPTIONS.map(option => (
        <RadioGroup.Item
          key={option.value}
          value={option.value}
          className={`
            flex h-6 w-full items-center justify-center rounded border-2 border bg-white px-1.5 text-center text-[10px] font-medium outline-none
            focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-slate-500
            disabled:opacity-50 disabled:pointer-events-none
            ${option.unselectedClasses} ${option.selectedClasses}
          `}
        >
          {option.label}
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  )
}
