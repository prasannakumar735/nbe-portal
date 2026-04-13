'use client'

import type { ReactNode } from 'react'
import { ClientReportHeader } from '@/components/merged-report/ClientReportHeader'

type ClientReportChromeProps = {
  children: ReactNode
}

/**
 * Minimal shell for client-facing merged report pages — no portal chrome, no sidebars.
 */
export function ClientReportChrome({ children }: ClientReportChromeProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <ClientReportHeader />

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      <footer className="py-6 text-center text-xs text-gray-400">
        © NBE Australia — Maintenance Inspection System
      </footer>
    </div>
  )
}
