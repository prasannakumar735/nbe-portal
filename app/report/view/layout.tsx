import type { Metadata } from 'next'
import type { ReactNode } from 'react'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

/**
 * No header/sidebar here — client report UI is fully controlled by page components.
 */
export default function ReportViewLayout({ children }: { children: ReactNode }) {
  return children
}
