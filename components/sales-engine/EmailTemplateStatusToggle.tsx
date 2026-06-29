'use client'

type EmailTemplateStatusToggleProps = {
  isActive: boolean
  disabled?: boolean
  onChange: (isActive: boolean) => void
}

export function EmailTemplateStatusToggle({
  isActive,
  disabled = false,
  onChange,
}: EmailTemplateStatusToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!isActive)}
      className={`rounded-md px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${
        isActive
          ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
          : 'border border-emerald-300 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
      }`}
    >
      {isActive ? 'Disable' : 'Enable'}
    </button>
  )
}
