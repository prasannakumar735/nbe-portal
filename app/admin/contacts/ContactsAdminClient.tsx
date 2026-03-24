'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'

type ContactRow = {
  id: string
  slug: string
  first_name: string
  last_name: string
  company: string | null
  title: string | null
  phone: string | null
  email: string | null
  website: string | null
  street: string | null
  city: string | null
  state: string | null
  postcode: string | null
  country: string | null
  status: 'active' | 'inactive'
  qr_type: 'vcard' | 'dynamic'
  created_at: string
  qr_data_url: string
  profile_image_url?: string | null
  company_logo_url?: string | null
}

type ContactDraft = {
  slug: string
  first_name: string
  last_name: string
  company: string
  title: string
  phone: string
  email: string
  website: string
  street: string
  city: string
  state: string
  postcode: string
  country: string
  status: 'active' | 'inactive'
  qr_type: 'vcard' | 'dynamic'
}

const emptyDraft: ContactDraft = {
  slug: '',
  first_name: '',
  last_name: '',
  company: '',
  title: '',
  phone: '',
  email: '',
  website: '',
  street: '',
  city: '',
  state: '',
  postcode: '',
  country: '',
  status: 'active',
  qr_type: 'dynamic',
}

export default function ContactsAdminClient() {
  const [contacts, setContacts] = useState<ContactRow[]>([])
  const [draft, setDraft] = useState<ContactDraft>(emptyDraft)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function loadContacts() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/contacts', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Failed to load contacts')
      setContacts((payload.contacts ?? []) as ContactRow[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load contacts')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadContacts()
  }, [])

  const selected = useMemo(() => contacts.find((c) => c.id === editingId) ?? null, [contacts, editingId])

  useEffect(() => {
    if (!selected) {
      setDraft(emptyDraft)
      return
    }
    setDraft({
      slug: selected.slug,
      first_name: selected.first_name,
      last_name: selected.last_name,
      company: selected.company ?? '',
      title: selected.title ?? '',
      phone: selected.phone ?? '',
      email: selected.email ?? '',
      website: selected.website ?? '',
      street: selected.street ?? '',
      city: selected.city ?? '',
      state: selected.state ?? '',
      postcode: selected.postcode ?? '',
      country: selected.country ?? '',
      status: selected.status,
      qr_type: selected.qr_type,
    })
  }, [selected])

  async function submitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const endpoint = editingId ? `/api/admin/contacts/${editingId}` : '/api/admin/contacts'
      const method = editingId ? 'PATCH' : 'POST'
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(payload.error || 'Save failed')
      setEditingId(null)
      setDraft(emptyDraft)
      await loadContacts()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function quickToggle(contact: ContactRow, key: 'status' | 'qr_type') {
    setError(null)
    const nextValue = key === 'status'
      ? (contact.status === 'active' ? 'inactive' : 'active')
      : (contact.qr_type === 'dynamic' ? 'vcard' : 'dynamic')
    const response = await fetch(`/api/admin/contacts/${contact.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: nextValue }),
    })
    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      setError(payload.error || 'Update failed')
      return
    }
    await loadContacts()
  }

  return (
    <main className="mx-auto max-w-7xl px-6 py-8">
      <h1 className="text-2xl font-bold text-slate-900">Contact QR Management</h1>
      <p className="mt-1 text-sm text-slate-600">Manage public contact cards and QR behavior.</p>
      {error && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <form onSubmit={submitForm} className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-base font-semibold text-slate-900">{editingId ? 'Edit Contact' : 'Add Contact'}</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {(['slug', 'first_name', 'last_name', 'company', 'title', 'phone', 'email', 'website', 'street', 'city', 'state', 'postcode', 'country'] as const).map((field) => (
            <label key={field} className="text-sm text-slate-700">
              <span className="mb-1 block capitalize">{field.replace('_', ' ')}</span>
              <input
                value={draft[field] ?? ''}
                onChange={(e) => setDraft((current) => ({ ...current, [field]: e.target.value }))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
              />
            </label>
          ))}
          <label className="text-sm text-slate-700">
            <span className="mb-1 block">Status</span>
            <select
              value={draft.status}
              onChange={(e) => setDraft((current) => ({ ...current, status: e.target.value as ContactDraft['status'] }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </label>
          <label className="text-sm text-slate-700">
            <span className="mb-1 block">QR Type</span>
            <select
              value={draft.qr_type}
              onChange={(e) => setDraft((current) => ({ ...current, qr_type: e.target.value as ContactDraft['qr_type'] }))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none ring-blue-500 focus:ring-2"
            >
              <option value="dynamic">dynamic</option>
              <option value="vcard">vcard</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-60"
          >
            {saving ? 'Saving...' : editingId ? 'Update Contact' : 'Create Contact'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Slug</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">QR Type</th>
                <th className="px-3 py-2">QR</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!loading && contacts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-4 text-slate-500">No contacts found.</td>
                </tr>
              )}
              {contacts.map((contact) => (
                <tr key={contact.id} className="border-b border-slate-100 align-top">
                  <td className="px-3 py-2 font-medium text-slate-900">{contact.first_name} {contact.last_name}</td>
                  <td className="px-3 py-2 text-slate-700">{contact.slug}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => void quickToggle(contact, 'status')}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      {contact.status}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => void quickToggle(contact, 'qr_type')}
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      {contact.qr_type}
                    </button>
                  </td>
                  <td className="px-3 py-2">
                    <img src={contact.qr_data_url} alt={`${contact.slug} QR`} className="h-20 w-20 rounded border border-slate-200" />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => setEditingId(contact.id)}
                        className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                      <a
                        href={contact.qr_data_url}
                        download={`${contact.slug}.png`}
                        className="rounded border border-slate-300 px-2 py-1 text-center text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Download QR
                      </a>
                      <a
                        href={`/api/business-card/${contact.slug}`}
                        className="rounded border border-slate-300 px-2 py-1 text-center text-xs text-slate-700 hover:bg-slate-50"
                      >
                        Download Business Card
                      </a>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}
