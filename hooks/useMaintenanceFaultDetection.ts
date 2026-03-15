import { useMemo } from 'react'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import type { MaintenanceDoorForm } from '@/lib/types/maintenance.types'

export type DoorFaultInfo = {
  doorIndex: number
  doorLabel: string
  faultItems: Array<{ code: string; label: string }>
}

export function useMaintenanceFaultDetection(doors: MaintenanceDoorForm[]) {
  return useMemo(() => {
    const faultsByDoor: DoorFaultInfo[] = doors.map((door, index) => {
      const faultItems = MAINTENANCE_CHECKLIST_ITEMS.filter(item => door.checklist[item.code] === 'fault').map(item => ({
        code: item.code,
        label: item.label,
      }))

      return {
        doorIndex: index,
        doorLabel: door.door_number?.trim() ? door.door_number : `Door ${index + 1}`,
        faultItems,
      }
    })

    const doorsWithFaults = faultsByDoor.filter(item => item.faultItems.length > 0)

    return {
      faultsByDoor,
      doorsWithFaults,
      hasAnyFault: doorsWithFaults.length > 0,
      totalFaultItems: doorsWithFaults.reduce((sum, item) => sum + item.faultItems.length, 0),
    }
  }, [doors])
}
