import type { ReactNode } from 'react'

type ClientReportChromeProps = {
  children: ReactNode
}

/**
 * Minimal shell for client-facing merged report pages — no portal chrome, no sidebars.
 */
export function ClientReportChrome({ children }: ClientReportChromeProps) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
        <img src="/logo.png" alt="NBE Australia" className="h-8 w-auto object-contain" />
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span aria-hidden className="select-none">
            🔒
          </span>
          <span>Secure Report</span>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col">{children}</div>

      <footer className="py-6 text-center text-xs text-gray-400">
        © NBE Australia — Maintenance Inspection System
      </footer>
    </div>
  )
}
