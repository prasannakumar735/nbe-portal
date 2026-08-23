'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const TOOL_LINKS = [
  { href: '/dashboard/sales-engine/pipeline', label: 'CRM Pipeline' },
  { href: '/dashboard/sales-engine/analytics', label: 'Analytics' },
  { href: '/dashboard/sales-engine/assistant', label: 'AI Assistant' },
  { href: '/dashboard/sales-engine/agents', label: 'Agents' },
  { href: '/dashboard/sales-engine/offer-assets', label: 'Offer Brochures' },
] as const

export function SalesEngineToolsNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
      {TOOL_LINKS.map((link) => {
        const active = pathname.startsWith(link.href)
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
