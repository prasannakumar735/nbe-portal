import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Archive, ChevronLeft } from 'lucide-react'

const focusRing = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-400'

/** Text-style back control (no heavy underline). */
export function ClientPortalBackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-medium tracking-tight text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 ${focusRing}`}
    >
      <ChevronLeft className="h-4 w-4 shrink-0 text-slate-500" strokeWidth={2} aria-hidden />
      <span>{label}</span>
    </Link>
  )
}

/** Outlined button-style navigation (e.g. back to date folders). */
export function ClientPortalOutlineNavButton({
  href,
  label,
  Icon = ChevronLeft,
}: {
  href: string
  label: string
  Icon?: LucideIcon
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium tracking-tight text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 ${focusRing}`}
    >
      <Icon className="h-4 w-4 shrink-0 text-slate-600" strokeWidth={2} aria-hidden />
      <span>{label}</span>
    </Link>
  )
}

/** Primary download action for ZIP archives. */
export function ClientPortalZipDownloadButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      className={`inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium tracking-tight text-white shadow-sm transition hover:bg-slate-800 ${focusRing}`}
    >
      <Archive className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
      Download ZIP
    </a>
  )
}
