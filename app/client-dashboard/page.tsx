import Link from 'next/link'

/**
 * Placeholder landing for client users (future: merged reports list, downloads).
 * Auth-gated flows can redirect here after sign-in.
 */
export default function ClientDashboardPage() {
  return (
    <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-lg font-bold text-slate-900">Client dashboard</h1>
      <p className="mt-2 text-sm text-slate-600">
        Report links are shared by email or QR. Use the client home page to open a secure link when you have one.
      </p>
      <div className="mt-6 flex flex-col gap-2 text-sm">
        <Link href="/client" className="font-semibold text-slate-900 underline">
          Client home
        </Link>
        <Link href="/client/login" className="text-slate-600 underline">
          Sign in
        </Link>
      </div>
    </div>
  )
}
