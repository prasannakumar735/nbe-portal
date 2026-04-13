import Link from 'next/link'

export default function ClientPortalHomePage() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-lg font-bold text-slate-900">Client portal</h1>
      <p className="mt-2 text-sm text-slate-600">
        Open the secure link or scan the QR code from your merged maintenance report to view your document.
      </p>
      <p className="mt-4 text-sm text-slate-600">
        Staff sign in at the{' '}
        <Link href="/login" className="font-semibold text-slate-900 underline">
          main portal
        </Link>
        .
      </p>
    </div>
  )
}
