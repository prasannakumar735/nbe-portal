import { CheckCircle, Clock, XCircle } from 'lucide-react'

export type BadgeStatus = 'completed' | 'active' | 'pending' | 'cancelled'

interface StatusBadgeProps {
  status: BadgeStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const configs = {
    completed: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: CheckCircle,
      label: 'Completed'
    },
    active: {
      bg: 'bg-emerald-50',
      text: 'text-emerald-700',
      border: 'border-emerald-200',
      icon: Clock,
      label: 'Active'
    },
    pending: {
      bg: 'bg-amber-50',
      text: 'text-amber-700',
      border: 'border-amber-200',
      icon: Clock,
      label: 'Pending'
    },
    cancelled: {
      bg: 'bg-slate-50',
      text: 'text-slate-600',
      border: 'border-slate-200',
      icon: XCircle,
      label: 'Cancelled'
    }
  }

  const config = configs[status]
  const Icon = config.icon

  const sizeClasses = size === 'sm' 
    ? 'px-2 py-0.5 text-xs gap-1'
    : 'px-3 py-1 text-sm gap-1.5'

  const iconSize = size === 'sm' ? 12 : 14

  return (
    <span className={`inline-flex items-center ${sizeClasses} rounded-full border font-medium ${config.bg} ${config.text} ${config.border}`}>
      <Icon size={iconSize} />
      {config.label}
    </span>
  )
}
