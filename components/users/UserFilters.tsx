'use client'

import { useMemo } from 'react'
import { Input } from '@/components/ui/Input'
import { Select, type SelectOption } from '@/components/ui/Select'

export type UserFilterState = {
  search: string
  role: 'all' | 'admin' | 'manager' | 'technician' | 'employee'
  status: 'all' | 'active' | 'inactive'
}

const ROLE_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'technician', label: 'Technician' },
  { value: 'employee', label: 'Employee (legacy)' },
]

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

type UserFiltersProps = {
  value: UserFilterState
  onChange: (next: UserFilterState) => void
}

export function UserFilters({ value, onChange }: UserFiltersProps) {
  const idPrefix = useMemo(() => 'uf', [])

  return (
    <div className="grid gap-2 sm:grid-cols-1 md:grid-cols-3">
      <Input
        id={`${idPrefix}-search`}
        label="Search"
        placeholder="Name or email"
        value={value.search}
        onChange={(e) => onChange({ ...value, search: e.target.value })}
        autoComplete="off"
      />
      <Select
        id={`${idPrefix}-role`}
        label="Role"
        options={ROLE_OPTIONS}
        value={value.role}
        onChange={(e) =>
          onChange({
            ...value,
            role: e.target.value as UserFilterState['role'],
          })
        }
      />
      <Select
        id={`${idPrefix}-status`}
        label="Status"
        options={STATUS_OPTIONS}
        value={value.status}
        onChange={(e) =>
          onChange({
            ...value,
            status: e.target.value as UserFilterState['status'],
          })
        }
      />
    </div>
  )
}
