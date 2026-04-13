interface SectionHeaderProps {
  title: string
  subtitle?: string
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <div>
      <h2 className="text-base font-semibold text-gray-900">{title}</h2>
      {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
    </div>
  )
}
