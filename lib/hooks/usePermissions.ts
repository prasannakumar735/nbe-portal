import { useState, useEffect } from 'react'
import { AuthService } from '@/lib/services/timecard.service'
import type { UserRole, Permissions } from '@/lib/types/timecard.types'

export function usePermissions(userId: string) {
  const [role, setRole] = useState<UserRole | null>(null)
  const [permissions, setPermissions] = useState<Permissions | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadPermissions()
  }, [userId])

  const loadPermissions = async () => {
    try {
      const userRole = await AuthService.getUserRole(userId)
      const userPermissions = await AuthService.getPermissions(userId, userRole || undefined)
      
      setRole(userRole)
      setPermissions(userPermissions)
    } catch (error) {
      console.error('Failed to load permissions:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return { role, permissions, isLoading }
}
