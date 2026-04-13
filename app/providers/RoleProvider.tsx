'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useAuth } from '@/app/providers/AuthProvider'
import {
  isAdmin,
  isManager,
  isManagerOrAdminRole,
  isTechnician,
  profileDisplayName,
  type ProfileFromTable,
  type ProfileRole,
} from '@/lib/auth/roles'

export type AppRole = ProfileRole | null

export type RoleContextValue = {
  /** Resolved role from profiles, or null if signed out / no profile row */
  role: AppRole
  profile: ProfileFromTable | null
  isTechnician: boolean
  isManager: boolean
  isAdmin: boolean
  /** Manager or admin — timecard approvals, /manager routes, elevated maintenance */
  canAccessManagerRoutes: boolean
  canApproveTimecards: boolean
  displayName: string
  /** Mirrors auth loading; use for spinners only */
  isLoading: boolean
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined)

function normalizeRole(role: string | null | undefined): AppRole {
  if (!role) return null
  if (role === 'admin' || role === 'manager' || role === 'technician' || role === 'employee' || role === 'client') {
    return role
  }
  return null
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const { profile, isLoading } = useAuth()

  const value = useMemo<RoleContextValue>(() => {
    const role = normalizeRole(profile?.role ?? null)
    return {
      role,
      profile,
      isTechnician: isTechnician(profile),
      isManager: isManager(profile),
      isAdmin: isAdmin(profile),
      canAccessManagerRoutes: isManagerOrAdminRole(profile?.role),
      canApproveTimecards: isManagerOrAdminRole(profile?.role),
      displayName: profileDisplayName(profile),
      isLoading,
    }
  }, [profile, isLoading])

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  const ctx = useContext(RoleContext)
  if (!ctx) {
    throw new Error('useRole must be used within RoleProvider')
  }
  return ctx
}
