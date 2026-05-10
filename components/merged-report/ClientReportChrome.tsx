'use client'

import type { ReactNode } from 'react'

type ClientReportChromeProps = {
  children: ReactNode
}

export function ClientReportChrome({ children }: ClientReportChromeProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-transparent">
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      <footer className="mt-8 text-center text-xs text-gray-400">
        © NBE Australia — Maintenance Inspection System
      </footer>
    </div>
  )
}
