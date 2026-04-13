'use client'

import { ClientReportAccountMenu } from '@/components/merged-report/ClientReportAccountMenu'

/**
 * Report viewer chrome header: classic NBE logo + secure badge + client account menu.
 * Uses plain <img> (not next/image) so SSR and client markup match and hydration stays stable.
 */
export function ClientReportHeader() {
  return (
    <header className="flex items-center justify-between gap-4 border-b border-gray-200 bg-white px-6 py-4">
      <div className="min-w-0 shrink">
        <img
          src="/nbe-logo.png"
          alt="NBE Australia"
          width={160}
          height={60}
          className="h-8 w-auto max-h-8 object-contain"
        />
      </div>
      <div className="flex shrink-0 items-center gap-3 sm:gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span aria-hidden className="select-none">
            🔒
          </span>
          <span>Secure Report</span>
        </div>
        <ClientReportAccountMenu />
      </div>
    </header>
  )
}
