import Link from 'next/link'
import { parsePublicContactSlug } from '@/lib/security/publicContactSlug'
import { createServiceRoleClient } from '@/lib/supabase/serviceRole'
import { getContactDisplayName } from '@/lib/contact-qr'
import type { Contact } from '@/lib/types/contact.types'

export const runtime = 'nodejs'

async function getContactBySlug(slug: string) {
  const normalized = parsePublicContactSlug(slug)
  if (!normalized) return null

  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('contacts')
    .select('id, slug, first_name, last_name, company, title, phone, email, status, qr_type, created_at')
    .eq('slug', normalized)
    .maybeSingle<Contact>()

  if (error || !data) return null
  return data
}

export default async function ContactPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const contact = await getContactBySlug(slug)

  if (!contact || contact.status === 'inactive') {
    return (
      <main className="mx-auto max-w-xl px-6 py-16">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
          <h1 className="text-xl font-semibold">Contact no longer available</h1>
          <p className="mt-2 text-sm">This profile is currently inactive.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">{getContactDisplayName(contact)}</h1>
        <div className="mt-4 space-y-2 text-sm text-slate-700">
          <p><span className="font-semibold">Company:</span> {contact.company || '—'}</p>
          <p><span className="font-semibold">Title:</span> {contact.title || '—'}</p>
          <p><span className="font-semibold">Phone:</span> {contact.phone || '—'}</p>
          <p><span className="font-semibold">Email:</span> {contact.email || '—'}</p>
        </div>
        <Link
          href={`/api/vcard/${contact.slug}`}
          className="mt-6 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
        >
          Save Contact
        </Link>
      </div>
    </main>
  )
}
