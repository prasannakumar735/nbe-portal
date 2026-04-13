'use client'

import { useMemo, useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import type { ManagedUserRow } from '@/lib/types/user-management.types'
import { toggleUserStatus } from '@/lib/users/actions'
import { UserFilters, type UserFilterState } from '@/components/users/UserFilters'
import { UserFormModal } from '@/components/users/UserFormModal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

function roleBadgeTone(
  role: string
): 'neutral' | 'success' | 'warning' | 'danger' | 'info' {
  if (role === 'admin') return 'info'
  if (role === 'manager') return 'success'
  return 'neutral'
}

function formatRole(role: string): string {
  if (role === 'employee') return 'Technician'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

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

type UsersTableProps = {
  initialUsers: ManagedUserRow[]
  currentUserId: string
  /** When false, hides the page title row (e.g. People module supplies its own header). */
  showPageHeader?: boolean
}

export function UsersTable({
  initialUsers,
  currentUserId,
  showPageHeader = true,
}: UsersTableProps) {
  const router = useRouter()
  const [rows, setRows] = useState<ManagedUserRow[]>(initialUsers)
  const [filters, setFilters] = useState<UserFilterState>({
    search: '',
    role: 'all',
    status: 'all',
  })
  const [modalOpen, setModalOpen] = useState(false)
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add')
  const [editing, setEditing] = useState<ManagedUserRow | null>(null)
  const [toggleLoadingId, setToggleLoadingId] = useState<string | null>(null)

  useEffect(() => {
    setRows(initialUsers)
  }, [initialUsers])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    return rows.filter((u) => {
      if (filters.status === 'active' && !u.is_active) return false
      if (filters.status === 'inactive' && u.is_active) return false

      if (filters.role !== 'all') {
        const r = u.role === 'employee' ? 'technician' : u.role
        const f = filters.role === 'employee' ? 'employee' : filters.role
        if (f === 'technician') {
          if (r !== 'technician' && r !== 'employee') return false
        } else if (r !== filters.role) return false
      }

      if (!q) return true
      const name = (u.full_name ?? '').toLowerCase()
      const email = (u.email ?? '').toLowerCase()
      return name.includes(q) || email.includes(q)
    })
  }, [rows, filters])

  const openAdd = () => {
    setModalMode('add')
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (u: ManagedUserRow) => {
    setModalMode('edit')
    setEditing(u)
    setModalOpen(true)
  }

  const onModalSuccess = useCallback(
    (payload?: { tempPassword?: string }) => {
      if (payload?.tempPassword) {
        toast.success('User created', {
          description: 'Share the temporary password securely with the user.',
        })
      } else {
        toast.success('User updated')
      }
      setModalOpen(false)
      router.refresh()
    },
    [router]
  )

  const handleToggle = async (u: ManagedUserRow) => {
    if (u.id === currentUserId) {
      toast.error('You cannot change your own status here.')
      return
    }
    setToggleLoadingId(u.id)
    const prev = u.is_active
    setRows((list) =>
      list.map((row) => (row.id === u.id ? { ...row, is_active: !row.is_active } : row))
    )
    const res = await toggleUserStatus(u.id)
    setToggleLoadingId(null)
    if (!res.ok) {
      setRows((list) =>
        list.map((row) => (row.id === u.id ? { ...row, is_active: prev } : row))
      )
      toast.error(res.error)
      return
    }
    toast.success(prev ? 'User deactivated' : 'User activated')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {showPageHeader ? (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Users</h1>
            <p className="text-sm text-slate-500">Manage portal accounts and roles.</p>
          </div>
          <Button type="button" onClick={openAdd}>
            Add user
          </Button>
        </div>
      ) : (
        <div className="flex justify-end">
          <Button type="button" onClick={openAdd}>
            Add user
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <UserFilters value={filters} onChange={setFilters} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
        <div className="max-h-[min(70vh,720px)] overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50/95 backdrop-blur">
              <tr>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                  Name
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                  Email
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                  Role
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                  Status
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700">
                  Created
                </th>
                <th className="whitespace-nowrap px-3 py-2 font-semibold text-slate-700 text-right">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-slate-500">
                    No users found.
                  </td>
                </tr>
              ) : (
                filtered.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {u.full_name?.trim() || '—'}
                    </td>
                    <td className="max-w-[220px] truncate px-3 py-2 text-slate-600">
                      {u.email}
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={roleBadgeTone(u.role)}>{formatRole(u.role)}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      {u.is_active ? (
                        <Badge tone="success">Active</Badge>
                      ) : (
                        <Badge tone="danger">Inactive</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-600">{formatDate(u.created_at)}</td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex flex-wrap justify-end gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          className="!h-9 !px-3 !text-sm"
                          onClick={() => openEdit(u)}
                        >
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant={u.is_active ? 'secondary' : 'primary'}
                          className="!h-9 !px-3 !text-sm"
                          disabled={u.id === currentUserId || toggleLoadingId === u.id}
                          loading={toggleLoadingId === u.id}
                          onClick={() => handleToggle(u)}
                        >
                          {u.is_active ? 'Disable' : 'Enable'}
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

      <UserFormModal
        open={modalOpen}
        mode={modalMode}
        user={editing}
        onClose={() => setModalOpen(false)}
        onSuccess={onModalSuccess}
      />
    </div>
  )
}
