'use client'

import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ClientUserRow, ClientUserStatus } from '@/lib/types/client-users.types'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return '—'
  }
}

type ClientsTabProps = {
  initialClients: ClientUserRow[]
  clientsError?: string
}

export function ClientsTab({ initialClients, clientsError }: ClientsTabProps) {
  const router = useRouter()
  const [rows, setRows] = useState<ClientUserRow[]>(initialClients)
  const [search, setSearch] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<ClientUserRow | null>(null)
  const [resetRow, setResetRow] = useState<ClientUserRow | null>(null)

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  useEffect(() => {
    setRows(initialClients)
  }, [initialClients])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) => {
      const blob = `${r.name} ${r.company_name} ${r.email} ${r.linked_client_name ?? ''}`.toLowerCase()
      return blob.includes(q)
    })
  }, [rows, search])

  const mergeRow = useCallback((next: ClientUserRow) => {
    setRows((list) => {
      const i = list.findIndex((x) => x.id === next.id)
      if (i === -1) return [next, ...list]
      const copy = [...list]
      copy[i] = next
      return copy
    })
  }, [])

  const handleToggleStatus = async (r: ClientUserRow) => {
    const next: ClientUserStatus = r.status === 'active' ? 'disabled' : 'active'
    const prev = r
    mergeRow({ ...r, status: next })
    setActionLoadingId(r.id)
    try {
      const res = await fetch(`/api/clients/${r.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      })
      const data = (await res.json()) as { client?: ClientUserRow; error?: string }
      if (!res.ok) {
        mergeRow(prev)
        toast.error(data.error ?? 'Update failed')
        return
      }
      if (data.client) mergeRow(data.client)
      toast.success(next === 'disabled' ? 'Client disabled' : 'Client enabled')
      router.refresh()
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {clientsError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{clientsError}</div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-md">
          <label htmlFor="clients-search" className="sr-only">
            Search clients
          </label>
          <input
            id="clients-search"
            type="search"
            placeholder="Search name, company, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)}>
          + Add Client
        </Button>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Client Name</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Company Name</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Organisation (reports)</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Email (login)</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Status</th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">Created</th>
                <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-slate-500">
                    No client accounts yet.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-medium text-slate-900">{r.name || '—'}</td>
                    <td className="max-w-[200px] truncate px-3 py-2 text-slate-600">{r.company_name || '—'}</td>
                    <td className="max-w-[180px] truncate px-3 py-2 text-slate-600" title={r.linked_client_name ?? undefined}>
                      {r.linked_client_name || (r.client_id ? '—' : 'Not linked')}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-slate-600">{r.email}</td>
                    <td className="px-3 py-2">
                      {r.status === 'active' ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="danger">Disabled</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(r.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="!h-9 !px-3 !text-sm"
                          onClick={() => setEditRow(r)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          className="!h-9 !px-3 !text-sm"
                          onClick={() => setResetRow(r)}
                        >
                          Reset password
                        </Button>
                        <Button
                          type="button"
                          variant={r.status === 'active' ? 'secondary' : 'primary'}
                          className="!h-9 !px-3 !text-sm"
                          disabled={actionLoadingId === r.id}
                          loading={actionLoadingId === r.id}
                          onClick={() => handleToggleStatus(r)}
                        >
                          {r.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {createOpen ? (
        <CreateClientModal
          onClose={() => setCreateOpen(false)}
          onCreated={(client) => {
            mergeRow(client)
            setCreateOpen(false)
            router.refresh()
          }}
        />
      ) : null}

      {editRow ? (
        <EditClientModal
          row={editRow}
          onClose={() => setEditRow(null)}
          onSaved={(c) => {
            mergeRow(c)
            setEditRow(null)
            router.refresh()
          }}
        />
      ) : null}

      {resetRow ? (
        <ResetPasswordModal
          row={resetRow}
          onClose={() => setResetRow(null)}
          onDone={() => {
            setResetRow(null)
            router.refresh()
          }}
        />
      ) : null}
    </div>
  )
}

function CreateClientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (c: ClientUserRow) => void
}) {
  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string }[]>([])
  const [orgLoading, setOrgLoading] = useState(true)
  const [clientOrgId, setClientOrgId] = useState('')

  const [name, setName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [autoGen, setAutoGen] = useState(false)
  const [sendCredentials, setSendCredentials] = useState(false)
  const [status, setStatus] = useState<ClientUserStatus>('active')
  const [loading, setLoading] = useState(false)

  const [success, setSuccess] = useState<{ client: ClientUserRow; plain: string } | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/maintenance/clients')
        const data = (await res.json()) as { clients?: { id: string; name: string }[] }
        if (!alive) return
        setOrgOptions(Array.isArray(data.clients) ? data.clients : [])
      } catch {
        if (alive) setOrgOptions([])
      } finally {
        if (alive) setOrgLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/clients/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          company_name: companyName,
          client_id: clientOrgId,
          email,
          password,
          confirm_password: confirm,
          auto_generate_password: autoGen,
          send_credentials: sendCredentials,
          status,
        }),
      })
      const data = (await res.json()) as {
        client?: ClientUserRow
        plain_password?: string
        error?: string
        email_sent?: boolean
        email_error?: string
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Could not create client')
        return
      }
      if (data.client && data.plain_password) {
        setPassword('')
        setConfirm('')
        setSuccess({ client: data.client, plain: data.plain_password })
        if (data.email_sent) {
          toast.success('Credentials emailed (when configured)')
        } else if (sendCredentials && data.email_error) {
          toast.message('Client created — email not sent', { description: data.email_error })
        } else {
          toast.success('Client created')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const copyCreds = async () => {
    if (!success) return
    const text = `Email: ${success.client.email}\nPassword: ${success.plain}`
    try {
      await navigator.clipboard.writeText(text)
      toast.message('Copied to clipboard')
    } catch {
      toast.error('Could not copy')
    }
  }

  const finish = () => {
    if (success) {
      onCreated(success.client)
    }
  }

  if (success) {
    return (
      <ModalFrame title="Client created" onClose={finish}>
        <p className="text-sm text-slate-600">
          Share these credentials securely. They will not be shown again in the portal.
        </p>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs text-slate-800">
          <p>
            <span className="text-slate-500">Email</span> {success.client.email}
          </p>
          <p className="mt-1">
            <span className="text-slate-500">Password</span> ••••••••
          </p>
          <p className="sr-only" aria-live="polite">
            Use the copy button to copy email and password.
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copyCreds}>
            Copy credentials
          </Button>
          <Button type="button" onClick={finish}>
            Done
          </Button>
        </div>
      </ModalFrame>
    )
  }

  return (
    <ModalFrame title="Add client" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Client name" value={name} onChange={setName} required autoComplete="name" />
        <div>
          <label htmlFor="create-client-org" className="block text-sm font-medium text-slate-800">
            Organisation (reports access) <span className="text-red-600">*</span>
          </label>
          <select
            id="create-client-org"
            required
            value={clientOrgId}
            disabled={orgLoading}
            onChange={(e) => {
              const v = e.target.value
              setClientOrgId(v)
              const opt = orgOptions.find((o) => o.id === v)
              if (opt && !companyName.trim()) setCompanyName(opt.name)
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60"
          >
            <option value="">{orgLoading ? 'Loading organisations…' : 'Select maintenance client…'}</option>
            {orgOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Must match the client on merged reports — required for /report/view access.
          </p>
        </div>
        <Field label="Company name" value={companyName} onChange={setCompanyName} autoComplete="organization" />
        <Field label="Email (login)" type="email" value={email} onChange={setEmail} required autoComplete="email" />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={autoGen}
            onChange={(e) => {
              setAutoGen(e.target.checked)
              if (e.target.checked) {
                setPassword('')
                setConfirm('')
              }
            }}
          />
          Auto-generate password
        </label>

        {!autoGen ? (
          <>
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              required={!autoGen}
              autoComplete="new-password"
            />
            <Field
              label="Confirm password"
              type="password"
              value={confirm}
              onChange={setConfirm}
              required={!autoGen}
              autoComplete="new-password"
            />
          </>
        ) : null}

        <div>
          <span className="block text-sm font-medium text-slate-800">Status</span>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                status === 'active' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
              }`}
              onClick={() => setStatus('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                status === 'disabled' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
              }`}
              onClick={() => setStatus('disabled')}
            >
              Disabled
            </button>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={sendCredentials} onChange={(e) => setSendCredentials(e.target.checked)} />
          Send credentials by email (requires Resend)
        </label>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Create
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

function EditClientModal({
  row,
  onClose,
  onSaved,
}: {
  row: ClientUserRow
  onClose: () => void
  onSaved: (c: ClientUserRow) => void
}) {
  const [orgOptions, setOrgOptions] = useState<{ id: string; name: string }[]>([])
  const [orgLoading, setOrgLoading] = useState(true)
  const [clientOrgId, setClientOrgId] = useState(row.client_id ?? '')
  const [name, setName] = useState(row.name)
  const [companyName, setCompanyName] = useState(row.company_name)
  const [email, setEmail] = useState(row.email)
  const [status, setStatus] = useState<ClientUserStatus>(row.status)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await fetch('/api/maintenance/clients')
        const data = (await res.json()) as { clients?: { id: string; name: string }[] }
        if (!alive) return
        setOrgOptions(Array.isArray(data.clients) ? data.clients : [])
      } catch {
        if (alive) setOrgOptions([])
      } finally {
        if (alive) setOrgLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!clientOrgId.trim()) {
      toast.error('Select an organisation for report access.')
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/clients/${row.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          company_name: companyName,
          email,
          client_id: clientOrgId.trim(),
          status,
        }),
      })
      const data = (await res.json()) as { client?: ClientUserRow; error?: string }
      if (!res.ok) {
        toast.error(data.error ?? 'Update failed')
        return
      }
      if (data.client) {
        toast.success('Client saved')
        onSaved(data.client)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalFrame title="Edit client" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <Field label="Client name" value={name} onChange={setName} required />
        <div>
          <label htmlFor="edit-client-org" className="block text-sm font-medium text-slate-800">
            Organisation (reports access) <span className="text-red-600">*</span>
          </label>
          <select
            id="edit-client-org"
            required
            value={clientOrgId}
            disabled={orgLoading}
            onChange={(e) => {
              const v = e.target.value
              setClientOrgId(v)
              const opt = orgOptions.find((o) => o.id === v)
              if (opt && !companyName.trim()) setCompanyName(opt.name)
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10 disabled:opacity-60"
          >
            <option value="">{orgLoading ? 'Loading…' : 'Select maintenance client…'}</option>
            {orgOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
        <Field label="Company name" value={companyName} onChange={setCompanyName} />
        <Field label="Email (login)" type="email" value={email} onChange={setEmail} required />
        <div>
          <span className="block text-sm font-medium text-slate-800">Status</span>
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                status === 'active' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
              }`}
              onClick={() => setStatus('active')}
            >
              Active
            </button>
            <button
              type="button"
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                status === 'disabled' ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
              }`}
              onClick={() => setStatus('disabled')}
            >
              Disabled
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Save
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

function ResetPasswordModal({
  row,
  onClose,
  onDone,
}: {
  row: ClientUserRow
  onClose: () => void
  onDone: () => void
}) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [autoGen, setAutoGen] = useState(true)
  const [sendCredentials, setSendCredentials] = useState(false)
  const [loading, setLoading] = useState(false)
  const [plain, setPlain] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch('/api/clients/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          password,
          confirm_password: confirm,
          auto_generate_password: autoGen,
          send_credentials: sendCredentials,
        }),
      })
      const data = (await res.json()) as {
        ok?: boolean
        plain_password?: string
        error?: string
        email_sent?: boolean
        email_error?: string
      }
      if (!res.ok) {
        toast.error(data.error ?? 'Reset failed')
        return
      }
      if (data.plain_password) {
        setPlain(data.plain_password)
        setPassword('')
        setConfirm('')
        if (data.email_sent) {
          toast.success('New password emailed')
        } else if (sendCredentials && data.email_error) {
          toast.message('Password reset — email not sent', { description: data.email_error })
        } else {
          toast.success('Password reset')
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const copyPlain = async () => {
    if (!plain) return
    try {
      await navigator.clipboard.writeText(plain)
      toast.message('Password copied')
    } catch {
      toast.error('Could not copy')
    }
  }

  if (plain) {
    return (
      <ModalFrame title="New password" onClose={onDone}>
        <p className="text-sm text-slate-600">Copy this password now — it will not be shown again.</p>
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-sm text-slate-900">
          ••••••••
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="secondary" onClick={copyPlain}>
            Copy password
          </Button>
          <Button type="button" onClick={onDone}>
            Done
          </Button>
        </div>
      </ModalFrame>
    )
  }

  return (
    <ModalFrame title={`Reset password — ${row.email}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={autoGen}
            onChange={(e) => {
              setAutoGen(e.target.checked)
              if (e.target.checked) {
                setPassword('')
                setConfirm('')
              }
            }}
          />
          Auto-generate password
        </label>
        {!autoGen ? (
          <>
            <Field label="New password" type="password" value={password} onChange={setPassword} required />
            <Field label="Confirm" type="password" value={confirm} onChange={setConfirm} required />
          </>
        ) : null}
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={sendCredentials} onChange={(e) => setSendCredentials(e.target.checked)} />
          Send new password by email
        </label>
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={loading}>
            Reset password
          </Button>
        </div>
      </form>
    </ModalFrame>
  )
}

function ModalFrame({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="Close"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="clients-modal-title"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id="clients-modal-title" className="text-lg font-semibold text-slate-900">
            {title}
          </h2>
          <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  required,
  autoComplete,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  required?: boolean
  autoComplete?: string
}) {
  const id = `field-${label.replace(/\s+/g, '-').toLowerCase()}`
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-900/10"
      />
    </div>
  )
}
