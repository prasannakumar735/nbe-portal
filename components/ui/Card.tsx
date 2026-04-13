import type { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-all duration-200 ${className}`}>
      {children}
    </div>
  )
}
