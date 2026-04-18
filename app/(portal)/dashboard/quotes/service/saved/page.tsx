import { redirect } from 'next/navigation'

/** Old URL; list now lives at /dashboard/quotes/service */
export default function SavedQuotesRedirectPage() {
  redirect('/dashboard/quotes/service')
}
