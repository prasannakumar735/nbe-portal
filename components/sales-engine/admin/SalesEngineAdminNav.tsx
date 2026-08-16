'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/dashboard/sales-engine/administration/general', label: 'General' },
  { href: '/dashboard/sales-engine/administration/feature-flags', label: 'Feature flags' },
  { href: '/dashboard/sales-engine/administration/deliverability', label: 'Email deliverability' },
  { href: '/dashboard/sales-engine/administration/ai-settings', label: 'AI settings' },
] as const

export function SalesEngineAdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {LINKS.map((link) => {
        const active = pathname === link.href
        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
              active
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-300 bg-white text-slate-800 hover:bg-slate-50'
            }`}
          >
            {link.label}
          </Link>
        )
      })}
    </nav>
  )
}
