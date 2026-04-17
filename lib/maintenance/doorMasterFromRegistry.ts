import type { DoorMasterSnapshot, MaintenanceAvailableDoor } from '@/lib/types/maintenance.types'

/** Builds a snapshot from the door registry row for schema v2 reports. */
export function doorMasterSnapshotFromRegistry(
  door: MaintenanceAvailableDoor | {
    door_description?: string | null
    door_type_alt?: string | null
    cw?: string | null
    ch?: string | null
  },
): DoorMasterSnapshot | undefined {
  const snap: DoorMasterSnapshot = {
    door_description: door.door_description != null ? String(door.door_description).trim() || null : null,
    door_type_alt: door.door_type_alt != null ? String(door.door_type_alt).trim() || null : null,
    cw: door.cw != null ? String(door.cw).trim() || null : null,
    ch: door.ch != null ? String(door.ch).trim() || null : null,
  }
  if (![snap.door_description, snap.door_type_alt, snap.cw, snap.ch].some(v => String(v ?? '').trim())) {
    return undefined
  }
  return snap
}
