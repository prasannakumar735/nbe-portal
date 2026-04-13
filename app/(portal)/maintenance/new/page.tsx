'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createSupabaseClient } from '@/lib/supabase/client'
import { DoorDiagram } from '@/components/report/DoorDiagram'
import { DoorInspectionCard } from '@/components/maintenance/DoorInspectionCard'
import { SignaturePad } from '@/components/maintenance/SignaturePad'
import { AISummaryButton } from '@/components/maintenance/AISummaryButton'
import { FaultSummaryPanel } from '@/components/maintenance/FaultSummaryPanel'
import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import { useOnlineStatus } from '@/hooks/useOnlineStatus'
import {
  offlineAddInspection,
  offlineCacheClients,
  offlineCacheLocations,
  offlineCacheDoors,
  offlineCountPending,
  offlineGet,
  offlineGetCachedClients,
  offlineGetCachedLocations,
  offlineGetCachedDoors,
  offlineGetLastSelection,
  offlineSetLastSelection,
  offlineListPending,
  offlineMarkAttempt,
  offlineSetStatus,
} from '@/lib/offline-db'
import { useMaintenanceFaultDetection } from '@/hooks/useMaintenanceFaultDetection'
import type {
  ClientLocationOption,
  ClientOption,
  MaintenanceChecklistStatus,
  MaintenanceDoorForm,
  MaintenanceFormValues,
} from '@/lib/types/maintenance.types'
import { maintenanceFormSchema } from '@/lib/validation/maintenance'
import { fetchPdfBlob } from '@/lib/browser/fetchPdfBlob'

const STORAGE_KEY = 'nbe-maintenance-draft'

/** Translate raw Supabase storage error messages into user-friendly text. */
function humaniseStorageError(message: string, bucket = 'maintenance-images'): string {
  const lower = message.toLowerCase()
  if (lower.includes('bucket not found') || lower.includes('bucketnotfound')) {
    return `Storage bucket "${bucket}" was not found. Create it in Supabase → Storage → New Bucket → "${bucket}" (Public).`
  }
  if (lower.includes('unauthorized') || lower.includes('not authorized')) {
    return 'Not authorised to upload files. Please sign in and try again.'
  }
  if (lower.includes('exceeded') || lower.includes('quota')) {
    return 'Storage quota exceeded. Please contact your administrator.'
  }
  return `Upload error: ${message}`
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10)
}

function nowIsoTime() {
  return new Date().toTimeString().slice(0, 5)
}

function digitsOnly(value: string): string {
  return value.replace(/\D+/g, '')
}

function createEmptyChecklist(): Record<string, MaintenanceChecklistStatus | null> {
  return MAINTENANCE_CHECKLIST_ITEMS.reduce((acc, item) => {
    acc[item.code] = null
    return acc
  }, {} as Record<string, MaintenanceChecklistStatus | null>)
}

function createDoor(index: number): MaintenanceDoorForm {
  return {
    door_id: undefined,
    local_id: crypto.randomUUID(),
    door_number: `Door ${index + 1}`,
    door_type: '',
    door_cycles: 0,
    view_window_visibility: 0,
    notes: '',
    checklist: createEmptyChecklist(),
    photos: [],
    isCollapsed: index > 0,
  }
}

function getDefaultFormValues(): MaintenanceFormValues {
  return {
    technician_name: '',
    submission_date: todayIsoDate(),
    source_app: 'Portal',
    client_id: '',
    client_location_id: '',
    address: '',
    inspection_date: todayIsoDate(),
    inspection_start: nowIsoTime(),
    inspection_end: nowIsoTime(),
    total_doors: 1,
    notes: '',
    signature_data_url: '',
    signature_storage_url: '',
    doors: [createDoor(0)],
  }
}

function normalizeLoadedDoor(rawDoor: unknown, index: number): MaintenanceDoorForm {
  const source = (rawDoor && typeof rawDoor === 'object' ? rawDoor : {}) as Record<string, unknown>

  const checklist = createEmptyChecklist()
  const sourceChecklist = source.checklist
  if (sourceChecklist && typeof sourceChecklist === 'object' && !Array.isArray(sourceChecklist)) {
    Object.entries(sourceChecklist as Record<string, unknown>).forEach(([code, status]) => {
      if (status === 'good' || status === 'caution' || status === 'fault' || status === 'na') {
        checklist[code] = status
      }
    })
  }

  const photos = Array.isArray(source.photos)
    ? source.photos
        .map(photo => {
          if (!photo || typeof photo !== 'object') return null
          const item = photo as Record<string, unknown>
          const url = String(item.url ?? '').trim()
          const path = String(item.path ?? url).trim()
          if (!url) return null
          return { url, path: path || url }
        })
        .filter((photo): photo is { url: string; path: string } => Boolean(photo))
    : []

  const doorId = String(source.door_id ?? '').trim()
  const localId = String(source.local_id ?? '').trim()

  return {
    local_id: localId || crypto.randomUUID(),
    door_id: doorId || undefined,
    door_number: String(source.door_number ?? `Door ${index + 1}`).trim() || `Door ${index + 1}`,
    door_type: String(source.door_type ?? '').trim(),
    door_cycles: Number(source.door_cycles ?? 0) || 0,
    view_window_visibility: Number(source.view_window_visibility ?? 0) || 0,
    notes: String(source.notes ?? source.notes_raw ?? '').trim(),
    checklist,
    photos,
    isCollapsed: Boolean(source.isCollapsed ?? index > 0),
  }
}

function calculateDoorCompletion(door: MaintenanceDoorForm): string {
  const total = MAINTENANCE_CHECKLIST_ITEMS.length
  const done = MAINTENANCE_CHECKLIST_ITEMS.filter(item => Boolean(door.checklist[item.code])).length
  return `${done}/${total} checklist items complete`
}

function isDoorComplete(door: MaintenanceDoorForm): boolean {
  const hasBasics = Boolean(door.door_number.trim() && door.door_type.trim())
  const checklistDone = MAINTENANCE_CHECKLIST_ITEMS.every(item => Boolean(door.checklist[item.code]))
  return hasBasics && checklistDone
}

function isDraftReady(form: MaintenanceFormValues): boolean {
  return Boolean(
    form.technician_name?.trim() &&
    form.client_id?.trim() &&
    form.client_location_id?.trim() &&
    form.inspection_date?.trim() &&
    Number(form.total_doors) > 0,
  )
}

const AUTO_SAVE_MS = 60000
const DRAFT_SAVE_COOLDOWN_MS = 15000
const LOCAL_PERSIST_MS = 2000

/** Runs Section 6 notes compile effect; subscribes only to report_id, doors, notes so parent does not re-render on checklist change. */
function Section6NotesSync({
  control,
  setValue,
  supabase,
}: {
  control: ReturnType<typeof useForm<MaintenanceFormValues>>['control']
  setValue: ReturnType<typeof useForm<MaintenanceFormValues>>['setValue']
  supabase: ReturnType<typeof createSupabaseClient>
}) {
  const reportId = useWatch({ control, name: 'report_id' })
  const doors = useWatch({ control, name: 'doors', defaultValue: [] }) as MaintenanceDoorForm[]
  const notes = useWatch({ control, name: 'notes', defaultValue: '' }) as string
  const section6CompiledForReportId = useRef<string | null>(null)

  useEffect(() => {
    const currentNotes = notes ?? ''
    const doorsList = doors ?? []

    if (reportId) {
      if (section6CompiledForReportId.current === reportId) return
      section6CompiledForReportId.current = reportId

      const fetchAndCompile = async () => {
        const { data } = await supabase
          .from('door_inspections')
          .select('technician_notes, doors(door_label)')
          .eq('report_id', reportId)
          .order('created_at', { ascending: true })

        if (data && data.length > 0) {
          const lines = data.map((row: unknown) => {
            const r = row as { technician_notes?: string | null; doors?: { door_label?: string | null } | null }
            const doorsObj = r.doors
            const label =
              doorsObj && typeof doorsObj === 'object' && !Array.isArray(doorsObj)
                ? String((doorsObj as { door_label?: string | null }).door_label ?? 'Door').trim()
                : 'Door'
            const n = String(r.technician_notes ?? '').trim()
            return n ? `${label}: ${n}` : label
          })
          setValue('notes', lines.join('\n'), { shouldDirty: false })
        } else {
          const compiled = doorsList
            .map((d, i) => {
              const label = String(d.door_number ?? `Door ${i + 1}`).trim()
              const n = String(d.notes ?? '').trim()
              return n ? `${label}: ${n}` : label
            })
            .filter(Boolean)
            .join('\n')
          if (compiled) setValue('notes', compiled, { shouldDirty: false })
        }
      }
      void fetchAndCompile()
      return
    }

    section6CompiledForReportId.current = null
    if (currentNotes.trim()) return
    const hasAnyDoorNotes = doorsList.some(d => String(d.notes ?? '').trim())
    if (!hasAnyDoorNotes) return
    const compiled = doorsList
      .map((d, i) => {
        const label = String(d.door_number ?? `Door ${i + 1}`).trim()
        const n = String(d.notes ?? '').trim()
        return n ? `${label}: ${n}` : label
      })
      .filter(Boolean)
      .join('\n')
    if (compiled) setValue('notes', compiled, { shouldDirty: false })
  }, [reportId, doors, notes, setValue, supabase])

  return null
}

export type MaintenanceFormPageProps = {
  reportIdFromRoute?: string
  initialReport?: Record<string, unknown> | null
  isAdminMode?: boolean
  onApproved?: () => void
  /**
   * When true with `initialReport`, skips `/api/maintenance/draft` fetch inside the form and
   * hydrates once from the parent (offline-first merged payload).
   */
  hydrateOnlyFromInitialReport?: boolean
  /** Debounced full-form mirror into IndexedDB (e.g. `useOfflineReport().persistForm`). */
  offlineMirror?: { onPersist: (form: MaintenanceFormValues) => void }
  /** Shown next to status when using offline mirror (e.g. save pipeline label). */
  offlineSaveStatusLabel?: string
}

export function MaintenanceInspectionForm(props: MaintenanceFormPageProps = {}) {
  const {
    reportIdFromRoute,
    initialReport,
    isAdminMode = false,
    onApproved,
    hydrateOnlyFromInitialReport = false,
    offlineMirror,
    offlineSaveStatusLabel,
  } = props
  const supabase = useMemo(() => createSupabaseClient(), [])
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialDoorId = searchParams.get('door_id') ?? searchParams.get('doorId')
  const isFreshMode = searchParams.get('fresh') === '1'
  const offlineEditId = searchParams.get('offline_id') ?? searchParams.get('offlineId')
  const [clients, setClients] = useState<ClientOption[]>([])
  const [locations, setLocations] = useState<ClientLocationOption[]>([])
  const [savedClientName, setSavedClientName] = useState('')
  const [savedLocationName, setSavedLocationName] = useState('')
  const [availableDoors, setAvailableDoors] = useState<Array<{ id: string; door_label: string; door_type: string }>>([])
  const [isSavingDraft, setIsSavingDraft] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [clientViewUrl, setClientViewUrl] = useState<string | null>(null)
  const [isGeneratingAiSummary, setIsGeneratingAiSummary] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string>('')
  const [statusType, setStatusType] = useState<'info' | 'error' | 'success'>('info')
  const [isLocked, setIsLocked] = useState(false)
  const [adminFormPopulated, setAdminFormPopulated] = useState(false)
  const [showFaultPanel, setShowFaultPanel] = useState(false)
  const [aiDoorLoadingIndex, setAiDoorLoadingIndex] = useState<number | null>(null)
  const isFirstAutosaveRender = useRef(true)
  const lastDraftSaveAttemptAt = useRef(0)
  const lastDraftSaveFailureAt = useRef(0)

  const showStatus = (msg: string, type: 'info' | 'error' | 'success' = 'info') => {
    setStatusMessage(msg)
    setStatusType(type)
  }

  const { isOnline, isOffline } = useOnlineStatus()
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [isSyncingPending, setIsSyncingPending] = useState(false)
  const refreshPendingCount = useCallback(async () => {
    try {
      const count = await offlineCountPending()
      setPendingSyncCount(count)
    } catch {
      setPendingSyncCount(0)
    }
  }, [])

  const syncPendingReports = useCallback(async () => {
    if (!navigator.onLine || isSyncingPending) return
    setIsSyncingPending(true)
    try {
      const pending = await offlineListPending()
      if (pending.length === 0) {
        await refreshPendingCount()
        return
      }

      showStatus('Syncing...', 'info')
      for (const item of pending) {
        if (!navigator.onLine) break

        if (item.status === 'syncing') {
          continue
        }

        await offlineSetStatus(item.id, 'syncing')
        await offlineMarkAttempt(item.id, { error: null })
        try {
          const nextForm: MaintenanceFormValues = JSON.parse(JSON.stringify(item.report_data)) as MaintenanceFormValues

          // Atomic sync is handled by backend now (uploads + inserts)
          const res = await fetch('/api/maintenance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'submitted', form: nextForm }),
          })
          const json = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error((json as { error?: string }).error ?? 'Sync failed')
          }
          await offlineSetStatus(item.id, 'synced')
        } catch {
          await offlineSetStatus(item.id, 'pending')
          await offlineMarkAttempt(item.id, { error: 'Sync failed' })
        }
      }

      await refreshPendingCount()
      showStatus('Sync complete', 'success')
    } finally {
      setIsSyncingPending(false)
    }
  }, [isSyncingPending, refreshPendingCount])

  useEffect(() => {
    void refreshPendingCount()
  }, [refreshPendingCount])

  useEffect(() => {
    if (isOnline) {
      void syncPendingReports()
    }
  }, [isOnline, syncPendingReports])

  const {
    register,
    control,
    getValues,
    setValue,
    reset,
    watch,
    handleSubmit,
    formState: { errors },
  } = useForm<MaintenanceFormValues>({
    resolver: zodResolver(maintenanceFormSchema) as never,
    mode: 'onSubmit',
    shouldUnregister: false,
    defaultValues: getDefaultFormValues(),
  })

  const { fields, replace, update } = useFieldArray({
    control,
    name: 'doors',
  })

  const watchedClientLocationId = useWatch({ control, name: 'client_location_id', defaultValue: '' })
  const watchedClientId = useWatch({ control, name: 'client_id', defaultValue: '' })
  const watchedTotalDoors = useWatch({ control, name: 'total_doors', defaultValue: 1 })
  const watchedReportId = useWatch({ control, name: 'report_id', defaultValue: undefined })
  const watchedNotes = useWatch({ control, name: 'notes', defaultValue: '' })
  const watchedDoors = useWatch({ control, name: 'doors', defaultValue: [] }) as MaintenanceDoorForm[]

  useEffect(() => {
    if (!offlineMirror) return
    const sub = watch(value => {
      offlineMirror.onPersist(value as MaintenanceFormValues)
    })
    return () => sub.unsubscribe()
  }, [watch, offlineMirror])

  /** Which client the current `locations` list belongs to (avoids skipping reload after client change). */
  const locationsForClientIdRef = useRef<string | null>(null)
  /** Which location the current `availableDoors` list belongs to (avoids reloading + replacing doors repeatedly). */
  const doorsForLocationIdRef = useRef<string | null>(null)
  /** One-time client list fetch; draft hydration runs separately so loader churn does not re-run hydration. */
  const clientsInitializedRef = useRef(false)
  /** Apply IndexedDB last-selection restore at most once per offline stint (avoids effect dependency churn). */
  const offlineRestoredRef = useRef(false)

  const clientOptions = useMemo(() => {
    if (!watchedClientId) return clients
    if (clients.some(client => client.id === watchedClientId)) return clients
    return [{ id: watchedClientId, name: savedClientName || 'Saved client' }, ...clients]
  }, [clients, watchedClientId, savedClientName])

  const locationOptions = useMemo(() => {
    if (!watchedClientLocationId) return locations
    if (locations.some(location => location.id === watchedClientLocationId)) return locations
    return [{ id: watchedClientLocationId, client_id: watchedClientId || '', name: savedLocationName || 'Saved location', address: '' }, ...locations]
  }, [locations, watchedClientLocationId, watchedClientId, savedLocationName])

  const loadLocationsForClient = useCallback(async (clientId: string) => {
    if (!clientId) {
      setLocations([])
      locationsForClientIdRef.current = null
      return [] as ClientLocationOption[]
    }

    if (locationsForClientIdRef.current !== clientId) {
      setLocations([])
      locationsForClientIdRef.current = null
    }

    if (!navigator.onLine) {
      const cached = await offlineGetCachedLocations(clientId)
      console.log('Offline locations:', cached)
      const list = cached && cached.length > 0 ? cached : []
      setLocations(list)
      locationsForClientIdRef.current = clientId
      if (!list.length) {
        setStatusMessage('No offline data available. Please connect to internet once.')
        setStatusType('info')
      }
      return list
    }

    try {
      const response = await fetch(`/api/maintenance/locations?clientId=${encodeURIComponent(clientId)}`)
      const data = (await response.json()) as { locations?: ClientLocationOption[] }
      const locationOptions = data.locations ?? []
      setLocations(locationOptions)
      locationsForClientIdRef.current = clientId
      void offlineCacheLocations(clientId, locationOptions)
      return locationOptions
    } catch {
      // If navigator.onLine is wrong (common in iOS PWA), fall back to cached locations.
      const cached = await offlineGetCachedLocations(clientId)
      const list = cached && cached.length > 0 ? cached : []
      setLocations(list)
      locationsForClientIdRef.current = clientId
      if (!list.length) {
        setStatusMessage('Offline: failed to load locations. Continue offline and sync later.')
        setStatusType('info')
      }
      return list
    }
  }, [])

  const prepareFormForSave = useCallback(async () => {
    const form = getValues()
    const clientId = String(form.client_id ?? '').trim()
    const locationId = String(form.client_location_id ?? '').trim()

    if (clientId || !locationId) {
      return form
    }

    const { data: locationRow } = await supabase
      .from('client_locations')
      .select('*')
      .eq('id', locationId)
      .maybeSingle()

    const location = locationRow as {
      client_id?: string | null
      address?: string | null
      site_address?: string | null
      location_address?: string | null
      Company_address?: string | null
      company_address?: string | null
    } | null

    const recoveredClientId = String(location?.client_id ?? '').trim()
    if (recoveredClientId) {
      setValue('client_id', recoveredClientId, { shouldDirty: false, shouldValidate: true })
      await loadLocationsForClient(recoveredClientId)
    }

    const currentAddress = String(form.address ?? '').trim()
    if (!currentAddress) {
      const companyAddress = String(location?.Company_address ?? location?.company_address ?? '').trim()
      const normalizedCompanyAddress = companyAddress.toLowerCase() === 'null' ? '' : companyAddress
      const recoveredAddress = String(
        normalizedCompanyAddress || location?.address || location?.site_address || location?.location_address || ''
      ).trim()
      if (recoveredAddress) {
        setValue('address', recoveredAddress, { shouldDirty: false, shouldValidate: true })
      }
    }

    return getValues()
  }, [getValues, loadLocationsForClient, setValue, supabase])

  const hydrateClientFromLocation = useCallback(async (rawReport: Record<string, unknown>) => {
    const reportClientId = String(rawReport.client_id ?? '').trim()
    const reportLocationId = String(rawReport.client_location_id ?? '').trim()
    const currentAddress = String(rawReport.address ?? '').trim()

    if (!reportLocationId) {
      return reportClientId
    }

    let resolvedClientId = reportClientId

    const { data: locationRow } = await supabase
      .from('client_locations')
      .select('*')
      .eq('id', reportLocationId)
      .maybeSingle()

    const location = locationRow as {
      client_id?: string | null
      address?: string | null
      site_address?: string | null
      location_address?: string | null
      Company_address?: string | null
      company_address?: string | null
    } | null

    if (!resolvedClientId) {
      resolvedClientId = String(location?.client_id ?? '').trim()
      if (resolvedClientId) {
        setValue('client_id', resolvedClientId, { shouldDirty: false, shouldValidate: true })
      }
    }

    if (!currentAddress) {
      const companyAddress = String(location?.Company_address ?? location?.company_address ?? '').trim()
      const normalizedCompanyAddress = companyAddress.toLowerCase() === 'null' ? '' : companyAddress
      const resolvedAddress = String(
        normalizedCompanyAddress || location?.address || location?.site_address || location?.location_address || ''
      ).trim()

      if (resolvedAddress) {
        setValue('address', resolvedAddress, { shouldDirty: false, shouldValidate: true })
      }
    }

    if (resolvedClientId) {
      await loadLocationsForClient(resolvedClientId)
      setValue('client_location_id', reportLocationId, { shouldDirty: false, shouldValidate: true })
    }

    return resolvedClientId
  }, [loadLocationsForClient, setValue, supabase])

  const loadDoorsForLocation = useCallback(async (locationId: string) => {
    if (!locationId) {
      setAvailableDoors([])
      doorsForLocationIdRef.current = null
      replace([createDoor(0)])
      setValue('total_doors', 1, { shouldDirty: true, shouldValidate: true })
      return []
    }

    // If we already loaded doors for this location, don't reload/replace again.
    if (doorsForLocationIdRef.current === locationId && availableDoors.length > 0) {
      return availableDoors
    }

    if (!navigator.onLine) {
      const cached = await offlineGetCachedDoors(locationId)
      console.log('Offline doors:', cached)
      if (cached?.doors && cached.doors.length > 0) {
        setAvailableDoors(cached.doors)
        doorsForLocationIdRef.current = locationId
        return cached.doors
      }
      showStatus('No offline doors available. Please connect once.', 'info')
      setAvailableDoors([])
      doorsForLocationIdRef.current = locationId
      return []
    }

    try {
      const response = await fetch(`/api/maintenance/doors?locationId=${encodeURIComponent(locationId)}`)
      const payload = (await response.json()) as {
        doors?: Array<{ id: string; door_label: string; door_type: string }>
      }
      const doorsForLocation = payload.doors ?? []
      setAvailableDoors(doorsForLocation)
      doorsForLocationIdRef.current = locationId
      void offlineCacheDoors(locationId, doorsForLocation)

      const current = getValues()
      const existingDoors = current.doors ?? []
      const hasUserEdits =
        existingDoors.some(d => Boolean(String(d.notes ?? '').trim())) ||
        existingDoors.some(d => Array.isArray(d.photos) && d.photos.length > 0) ||
        existingDoors.some(d => Object.values(d.checklist ?? {}).some(v => Boolean(v)))

      // Only auto-populate door rows on first load/new location when user hasn't started editing.
      const loadedDoors = doorsForLocation.map((door, index) => ({
        door_id: door.id,
        local_id: crypto.randomUUID(),
        door_number: door.door_label || `Door ${index + 1}`,
        door_type: door.door_type || '',
        door_cycles: 0,
        view_window_visibility: 0,
        notes: '',
        checklist: createEmptyChecklist(),
        photos: [],
        isCollapsed: index > 0,
      }))

      if (loadedDoors.length === 0) {
        if (!hasUserEdits) {
          replace([createDoor(0)])
          setValue('total_doors', 1, { shouldDirty: true, shouldValidate: true })
        }
        return doorsForLocation
      }

      if (!hasUserEdits) {
        replace(loadedDoors)
        setValue('total_doors', loadedDoors.length, { shouldDirty: true, shouldValidate: true })
      }
      return doorsForLocation
    } catch {
      const cached = await offlineGetCachedDoors(locationId)
      if (cached?.doors && cached.doors.length > 0) {
        setAvailableDoors(cached.doors)
        doorsForLocationIdRef.current = locationId
        return cached.doors
      }
      setAvailableDoors([])
      doorsForLocationIdRef.current = locationId
      return []
    }
  }, [availableDoors, getValues, offlineCacheDoors, offlineGetCachedDoors, replace, setValue])

  useEffect(() => {
    const locationId = watchedClientLocationId
    let isActive = true

    const loadAvailableDoors = async () => {
      console.log('[Maintenance] loadAvailableDoors useEffect locationId:', locationId)

      if (!locationId) {
        if (isActive) {
          setAvailableDoors([])
        }
        return
      }
      const doors = await loadDoorsForLocation(locationId)
      if (!isActive) return
      console.log('[Maintenance] Doors loaded from loadDoorsForLocation:', { locationId, count: doors.length })
    }

    void loadAvailableDoors()

    return () => {
      isActive = false
    }
  }, [watchedClientLocationId, loadDoorsForLocation])

  const loadClientsIntoState = useCallback(async () => {
    if (!navigator.onLine) {
      const cached = await offlineGetCachedClients()
      if (cached && cached.length > 0) {
        setClients(cached)
      }
      return
    }
    try {
      const response = await fetch('/api/maintenance/clients')
      const data = (await response.json()) as { clients?: ClientOption[] }
      const list = data.clients ?? []
      setClients(list)
      void offlineCacheClients(list)

      void (async () => {
        for (const c of list) {
          if (!navigator.onLine) break
          try {
            const res = await fetch(`/api/maintenance/locations?clientId=${encodeURIComponent(c.id)}`)
            const payload = (await res.json().catch(() => ({}))) as { locations?: ClientLocationOption[] }
            if (res.ok && Array.isArray(payload.locations)) {
              await offlineCacheLocations(c.id, payload.locations)

              for (const loc of payload.locations) {
                if (!navigator.onLine) break
                try {
                  const doorsRes = await fetch(`/api/maintenance/doors?locationId=${encodeURIComponent(loc.id)}`)
                  const doorsPayload = (await doorsRes.json().catch(() => ({}))) as {
                    doors?: Array<{ id: string; door_label: string; door_type: string }>
                  }
                  if (doorsRes.ok && Array.isArray(doorsPayload.doors)) {
                    await offlineCacheDoors(loc.id, doorsPayload.doors)
                  }
                } catch {
                  // ignore
                }
              }
            }
          } catch {
            // ignore
          }
        }
      })()
    } catch {
      // If navigator.onLine is wrong (common in iOS PWA), fall back to cached clients.
      const cached = await offlineGetCachedClients()
      if (cached && cached.length > 0) {
        setClients(cached)
      }
    }
  }, [])

  const draftHydrationKey = useMemo(
    () =>
      [
        reportIdFromRoute ?? '',
        offlineEditId ?? '',
        isFreshMode ? '1' : '0',
        isAdminMode ? '1' : '0',
        initialReport ? 'ir' : 'no',
        hydrateOnlyFromInitialReport ? 'hof' : 'no',
      ].join('|'),
    [reportIdFromRoute, offlineEditId, isFreshMode, isAdminMode, initialReport, hydrateOnlyFromInitialReport],
  )

  useEffect(() => {
    if (clientsInitializedRef.current) return
    clientsInitializedRef.current = true
    void loadClientsIntoState()
  }, [loadClientsIntoState])

  useEffect(() => {
    let cancelled = false

    const restoreFromLocalBackup = () => {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false

      try {
        const draft = JSON.parse(raw) as Partial<MaintenanceFormValues>
        if (!draft || typeof draft !== 'object') return false

        Object.entries(draft).forEach(([key, value]) => {
          if (key !== 'doors') {
            setValue(key as keyof MaintenanceFormValues, value as never)
          }
        })

        if (Array.isArray(draft.doors) && draft.doors.length > 0) {
          const normalizedDoors = draft.doors.map((door, index) => normalizeLoadedDoor(door, index))
          replace(normalizedDoors)
        }

        showStatus('Recovered unsynced local draft.', 'info')
        return true
      } catch {
        return false
      }
    }

    const loadDraft = async () => {
      if (offlineEditId) {
        const record = await offlineGet(offlineEditId)
        if (cancelled) return
        if (record?.report_data) {
          const draft = record.report_data as Partial<MaintenanceFormValues>
          Object.entries(draft).forEach(([key, value]) => {
            if (key !== 'doors') {
              setValue(key as keyof MaintenanceFormValues, value as never)
            }
          })
          if (Array.isArray(draft.doors) && draft.doors.length > 0) {
            const normalizedDoors = draft.doors.map((door, index) => normalizeLoadedDoor(door, index))
            replace(normalizedDoors)
          }

          const selectedClientId = String(draft.client_id ?? '').trim()
          const selectedLocationId = String(draft.client_location_id ?? '').trim()
          if (selectedClientId) {
            await loadLocationsForClient(selectedClientId)
          }
          if (cancelled) return
          if (selectedLocationId) {
            await loadDoorsForLocation(selectedLocationId)
          }

          showStatus('Loaded offline report. Edit and sync when ready.', 'info')
          return
        }
      }

      if (hydrateOnlyFromInitialReport && reportIdFromRoute && initialReport) {
        const report = initialReport as Record<string, unknown>
        setSavedClientName(String(report.client_name ?? '').trim())
        setSavedLocationName(String(report.client_location_name ?? '').trim())
        const reportStatus = String(report.status ?? '').toLowerCase()
        const isReadOnlyStatus =
          reportStatus === 'submitted' || reportStatus === 'reviewing' || reportStatus === 'approved'
        if (isReadOnlyStatus && !isAdminMode) {
          setIsLocked(true)
          setStatusMessage(`This report is ${reportStatus} and locked for editing.`)
        }
        Object.entries(report).forEach(([key, value]) => {
          if (key !== 'doors') {
            setValue(key as keyof MaintenanceFormValues, value as never)
          }
        })
        await hydrateClientFromLocation(report)
        if (cancelled) return
        const maintenanceDoors: unknown[] = Array.isArray(report.doors) ? report.doors : []
        const doors = maintenanceDoors.map((door: unknown, index: number) => normalizeLoadedDoor(door, index))
        replace(doors.length > 0 ? doors : [createDoor(0)])
        const compiledNotes = maintenanceDoors
          .map((d: unknown, i: number) => {
            const door = d as { door_number?: string; notes?: string }
            const label = String(door?.door_number ?? `Door ${i + 1}`).trim()
            const notes = String(door?.notes ?? '').trim()
            return notes ? `${label}: ${notes}` : label
          })
          .filter(Boolean)
          .join('\n')
        setValue('notes', (report.notes as string) ?? compiledNotes ?? '', { shouldDirty: false })
        setValue('report_id', reportIdFromRoute)
        if (isAdminMode) {
          setAdminFormPopulated(true)
          showStatus('Report loaded. You can edit all fields and save.')
        } else {
          showStatus('Draft auto-resumed (offline cache).')
        }
        const selectedClientId = String((report as { client_id?: string }).client_id ?? '').trim()
        const selectedLocationId = String((report as { client_location_id?: string }).client_location_id ?? '').trim()
        if (selectedClientId) {
          await loadLocationsForClient(selectedClientId)
        }
        if (cancelled) return
        if (selectedLocationId) {
          await loadDoorsForLocation(selectedLocationId)
        }
        return
      }

      if (reportIdFromRoute && initialReport && isAdminMode && !hydrateOnlyFromInitialReport) {
        return
      }

      if (isFreshMode && !reportIdFromRoute) {
        if (navigator.onLine) {
          localStorage.removeItem('maintenance:lastReportId')
          localStorage.removeItem(STORAGE_KEY)
          reset(getDefaultFormValues())
          return
        }
      }

      const reportId = reportIdFromRoute ?? localStorage.getItem('maintenance:lastReportId')
      if (!reportId) {
        const restored = restoreFromLocalBackup()
        if (restored) {
          const current = getValues()
          const selectedClientId = String(current.client_id ?? '').trim()
          const selectedLocationId = String(current.client_location_id ?? '').trim()
          if (selectedClientId) {
            await loadLocationsForClient(selectedClientId)
          }
          if (cancelled) return
          if (selectedLocationId) {
            await loadDoorsForLocation(selectedLocationId)
          }
        }
        return
      }

      const response = await fetch(`/api/maintenance/draft?reportId=${encodeURIComponent(reportId)}`, {
        cache: 'no-store',
      })
      if (cancelled) return
      const data = await response.json()
      if (!data.report) {
        setClientViewUrl(null)
        restoreFromLocalBackup()
        return
      }

      setClientViewUrl(typeof data.client_view_url === 'string' ? data.client_view_url : null)

      setSavedClientName(String(data.report.client_name ?? '').trim())
      setSavedLocationName(String(data.report.client_location_name ?? '').trim())

      const reportStatus = String(data.report.status ?? '').toLowerCase()
      if (!reportIdFromRoute && reportStatus !== 'draft') {
        localStorage.removeItem('maintenance:lastReportId')
        restoreFromLocalBackup()
        return
      }

      const isReadOnlyStatus = reportStatus === 'submitted' || reportStatus === 'reviewing' || reportStatus === 'approved'

      if (isReadOnlyStatus && !isAdminMode) {
        setIsLocked(true)
        setStatusMessage(`This report is ${reportStatus} and locked for editing.`)
      }

      Object.entries(data.report).forEach(([key, value]) => {
        if (key !== 'doors') {
          setValue(key as keyof MaintenanceFormValues, value as never)
        }
      })

      await hydrateClientFromLocation(data.report as Record<string, unknown>)
      if (cancelled) return

      const maintenanceDoors: unknown[] = Array.isArray(data.report.doors) ? data.report.doors : []
      const doors = maintenanceDoors.map((door, index) => normalizeLoadedDoor(door, index))
      replace(doors.length > 0 ? doors : [createDoor(0)])

      const selectedClientId = String((data.report as Record<string, unknown>).client_id ?? '').trim()
      const selectedLocationId = String((data.report as Record<string, unknown>).client_location_id ?? '').trim()
      if (selectedClientId) {
        await loadLocationsForClient(selectedClientId)
      }
      if (cancelled) return
      if (selectedLocationId) {
        await loadDoorsForLocation(selectedLocationId)
      }

      const compiledNotes = maintenanceDoors
        .map((d: unknown, i: number) => {
          const door = d as { door_number?: string; notes?: string }
          const label = String(door?.door_number ?? `Door ${i + 1}`).trim()
          const notes = String(door?.notes ?? '').trim()
          return notes ? `${label}: ${notes}` : label
        })
        .filter(Boolean)
        .join('\n')
      setValue('notes', compiledNotes || (data.report.notes ?? ''), { shouldDirty: false })

      if (!isReadOnlyStatus || isAdminMode) {
        setStatusMessage('Draft auto-resumed.')
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data.report))
    }

    void loadDraft()

    return () => {
      cancelled = true
    }
  }, [draftHydrationKey]) // eslint-disable-line react-hooks/exhaustive-deps -- keyed by route/query only; stable loaders

  // On offline reload, restore last selection once per offline stint without re-fighting user input.
  useEffect(() => {
    if (!isOffline) {
      offlineRestoredRef.current = false
      return
    }
    if (offlineRestoredRef.current) return
    offlineRestoredRef.current = true

    let cancelled = false

    const restoreSelection = async () => {
      const last = await offlineGetLastSelection()
      if (!last || cancelled) return

      const clientId = String(last.client_id ?? '').trim()
      const locationId = String(last.client_location_id ?? '').trim()
      const currentClient = String(getValues('client_id') ?? '').trim()
      const currentLoc = String(getValues('client_location_id') ?? '').trim()

      if (clientId && !currentClient) {
        setValue('client_id', clientId, { shouldDirty: false, shouldValidate: true })
      }
      const effectiveClient = String(getValues('client_id') ?? '').trim() || clientId
      if (effectiveClient) {
        await loadLocationsForClient(effectiveClient)
      }
      if (cancelled) return

      if (locationId && !String(getValues('client_location_id') ?? '').trim()) {
        setValue('client_location_id', locationId, { shouldDirty: false, shouldValidate: true })
      }
      const effectiveLoc = String(getValues('client_location_id') ?? '').trim() || locationId
      if (effectiveLoc) {
        await loadDoorsForLocation(effectiveLoc)
      }
    }

    void restoreSelection()
    return () => {
      cancelled = true
    }
  }, [isOffline, getValues, loadDoorsForLocation, loadLocationsForClient, setValue])

  // If form has a client but locations belong to another client (or were never loaded), reload — do not use locations.length alone (breaks client switches).
  useEffect(() => {
    if (!watchedClientId) return
    if (locationsForClientIdRef.current === watchedClientId) return
    void loadLocationsForClient(watchedClientId)
  }, [loadLocationsForClient, watchedClientId])

  useEffect(() => {
    if (!reportIdFromRoute || !initialReport || !isAdminMode || adminFormPopulated) return
    const report = initialReport as Record<string, unknown>
    setSavedClientName(String(report.client_name ?? '').trim())
    setSavedLocationName(String(report.client_location_name ?? '').trim())
    Object.entries(report).forEach(([key, value]) => {
      if (key !== 'doors') {
        setValue(key as keyof MaintenanceFormValues, value as never)
      }
    })
    void hydrateClientFromLocation(report)
    const maintenanceDoors: unknown[] = Array.isArray(report.doors) ? report.doors : []
    const doors = maintenanceDoors.map((door: unknown, index: number) => normalizeLoadedDoor(door, index))
    replace(doors.length > 0 ? doors : [createDoor(0)])
    const compiledNotes = maintenanceDoors
      .map((d: unknown, i: number) => {
        const door = d as { door_number?: string; notes?: string }
        const label = String(door?.door_number ?? `Door ${i + 1}`).trim()
        const notes = String(door?.notes ?? '').trim()
        return notes ? `${label}: ${notes}` : label
      })
      .filter(Boolean)
      .join('\n')
    setValue('notes', (report.notes as string) ?? compiledNotes ?? '', { shouldDirty: false })
    setValue('report_id', reportIdFromRoute)
    setAdminFormPopulated(true)
    showStatus('Report loaded. You can edit all fields and save.')
  }, [reportIdFromRoute, initialReport, isAdminMode, adminFormPopulated, replace, setValue, hydrateClientFromLocation, showStatus])

  useEffect(() => {
    const expected = Number(watchedTotalDoors || 0)
    if (!Number.isFinite(expected) || expected < 1) return
    if (expected === fields.length) return
    const current = getValues()
    const doors = current.doors ?? []
    if (expected > fields.length) {
      const nextDoors = [...doors]
      for (let index = fields.length; index < expected; index += 1) {
        nextDoors.push(createDoor(index))
      }
      replace(nextDoors)
    } else {
      replace(doors.slice(0, expected))
    }
  }, [fields.length, replace, watchedTotalDoors, getValues])

  const persistDraft = useCallback(async (
    targetStatus: 'draft' | 'submitted' | 'reviewing' = 'draft',
    options?: { silent?: boolean; adminEdit?: boolean },
  ): Promise<boolean> => {
    if (isLocked && targetStatus === 'draft' && !options?.adminEdit) {
      return false
    }

    const silent = options?.silent ?? false
    const adminEdit = options?.adminEdit ?? false

    if (!silent) {
      setStatusMessage('')
    }

    const form = await prepareFormForSave()

    try {
      const response = await fetch('/api/maintenance/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_id: form.report_id,
          status: adminEdit ? 'reviewing' : targetStatus,
          mode: adminEdit ? undefined : targetStatus === 'draft' ? 'draft' : 'submit',
          form,
          admin_edit: adminEdit,
        }),
      })

      const result = await response.json().catch(() => ({} as Record<string, unknown>))
      if (!response.ok) {
        const details = (result as { details?: { message?: string } }).details
        const serverMessage = details?.message || (result as { error?: string }).error || 'Failed to save draft'
        if (!silent) {
          showStatus(serverMessage, 'error')
          toast.error(serverMessage)
        }
        return false
      }

      if (result.report_id) {
        setValue('report_id', result.report_id)
        localStorage.setItem('maintenance:lastReportId', result.report_id)
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(form))

      if (!silent) {
        if (targetStatus === 'draft') {
          const doors = form.doors ?? []
          const total = Number(form.total_doors || 1)
          const done = doors.filter(door => isDoorComplete(door)).length
          const incomplete = done < total
          const draftMsg = incomplete
            ? 'Draft saved. Some checklist items or door details are still incomplete.'
            : 'Draft saved.'
          showStatus(draftMsg, incomplete ? 'info' : 'success')
          if (incomplete) {
            toast.message(draftMsg)
          } else {
            toast.success('Draft saved')
          }
        } else {
          showStatus('Report submitted.', 'success')
          toast.success('Report submitted')
        }
      }

      return true
    } catch {
      lastDraftSaveFailureAt.current = Date.now()

      localStorage.setItem(STORAGE_KEY, JSON.stringify(form))

      if (!silent) {
        showStatus('Offline Mode – Draft saved locally on this device.', 'info')
        toast.info('Offline — draft saved on this device')
      }

      return false
    }
  }, [getValues, isLocked, prepareFormForSave, setValue])

  useEffect(() => {
    if (isLocked) return

    if (isFirstAutosaveRender.current) {
      isFirstAutosaveRender.current = false
      return
    }

    const interval = setInterval(async () => {
      const snapshot = getValues()
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
      } catch {
        // ignore quota or parse errors
      }

      if (!isDraftReady(snapshot)) {
        return
      }

      const now = Date.now()
      if (now - lastDraftSaveFailureAt.current < DRAFT_SAVE_COOLDOWN_MS) {
        return
      }

      if (now - lastDraftSaveAttemptAt.current < DRAFT_SAVE_COOLDOWN_MS) {
        return
      }

      lastDraftSaveAttemptAt.current = now

      try {
        setIsSavingDraft(true)
        await persistDraft('draft', { silent: true })
      } finally {
        setIsSavingDraft(false)
      }
    }, AUTO_SAVE_MS)

    return () => clearInterval(interval)
  }, [getValues, isLocked, persistDraft])

  useEffect(() => {
    if (isLocked) return
    const interval = setInterval(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(getValues()))
      } catch {
        // ignore
      }
    }, LOCAL_PERSIST_MS)
    return () => clearInterval(interval)
  }, [getValues, isLocked])

  const progress = useMemo(() => {
    const doors = watchedDoors ?? []
    const done = doors.filter(door => isDoorComplete(door)).length
    const total = Number(watchedTotalDoors || 1)
    return {
      done,
      total,
      percentage: Math.round((done / total) * 100),
      allDone: done === total,
    }
  }, [watchedDoors, watchedTotalDoors])

  const faultDetection = useMaintenanceFaultDetection(watchedDoors ?? [])

  // Auto-prefill from QR-scanned door when opening /maintenance/new?door_id=... or /maintenance/new?doorId=...
  useEffect(() => {
    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const doorId = params?.get('door_id') ?? params?.get('doorId') ?? initialDoorId
    console.log('Prefill doorId:', doorId)

    if (!doorId) return

    const prefillFromDoorId = async () => {
      const current = getValues()

      // If a report is already loaded or doors already have IDs, don't override existing data
      if (current.report_id || current.client_location_id || current.doors?.some(door => door.door_id)) {
        return
      }

      const { data, error } = await supabase
        .from('doors')
        .select('id, door_label, door_type, client_location_id')
        .eq('id', doorId)
        .maybeSingle()

      console.log('Door result:', data)

      if (error || !data) {
        console.error('[Maintenance] Failed to prefill from doorId:', { doorId, error })
        return
      }

      const doorRecord = data as {
        id: string
        door_label: string | null
        door_type: string | null
        client_location_id: string | null
      }

      if (doorRecord.client_location_id) {
        const { data: locationData } = await supabase
          .from('client_locations')
          .select('*')
          .eq('id', doorRecord.client_location_id)
          .maybeSingle()

        if (locationData) {
          const loc = locationData as {
            client_id?: string | null
            address?: string | null
            site_address?: string | null
            location_address?: string | null
            Company_address?: string | null
            company_address?: string | null
          }
          if (loc.client_id) {
            setValue('client_id', loc.client_id, { shouldDirty: true, shouldValidate: true })
            await loadLocationsForClient(loc.client_id)
          }
          const companyAddress = String(loc.Company_address ?? loc.company_address ?? '').trim()
          const resolvedAddress =
            companyAddress && companyAddress.toLowerCase() !== 'null'
              ? companyAddress
              : String(loc.address ?? loc.site_address ?? loc.location_address ?? '').trim()
          if (resolvedAddress) {
            setValue('address', resolvedAddress, { shouldDirty: true, shouldValidate: true })
          }
        }

        setValue('client_location_id', doorRecord.client_location_id, {
          shouldDirty: true,
          shouldValidate: true,
        })
      }

      const prefilledDoor: MaintenanceDoorForm = {
        local_id: crypto.randomUUID(),
        door_id: doorRecord.id,
        door_number: doorRecord.door_label || 'Door 1',
        door_type: doorRecord.door_type || '',
        door_cycles: 0,
        view_window_visibility: 0,
        notes: '',
        checklist: createEmptyChecklist(),
        photos: [],
        isCollapsed: false,
      }

      replace([prefilledDoor])
      setValue('total_doors', 1, { shouldDirty: true, shouldValidate: true })
    }

    void prefillFromDoorId()
  }, [getValues, initialDoorId, loadLocationsForClient, replace, setValue, supabase])

  const uploadSignature = async (signatureDataUrl: string): Promise<string> => {
    if (!signatureDataUrl) return ''

    const response = await fetch(signatureDataUrl)
    const blob = await response.blob()
    const reportPart = watchedReportId ?? 'local-draft'
    const path = `signatures/${reportPart}/${crypto.randomUUID()}.png`

    const result = await supabase.storage.from('maintenance-images').upload(path, blob, {
      contentType: 'image/png',
      upsert: true,
    })

    if (result.error) {
      throw new Error(humaniseStorageError(result.error.message))
    }

    const publicUrl = supabase.storage.from('maintenance-images').getPublicUrl(path)
    return publicUrl.data.publicUrl
  }

  const handleSaveDraft = async () => {
    if (isLocked) {
      return
    }
    setIsSavingDraft(true)
    await persistDraft('draft')
    setIsSavingDraft(false)
  }

  const submitReport = async (form: MaintenanceFormValues) => {
    if (!progress.allDone) {
      const msg = 'Complete checklist and required fields for all doors before submission.'
      showStatus(msg, 'error')
      toast.error(msg)
      return
    }

    setIsSubmitting(true)
    showStatus('', 'info')

    try {
      if (!navigator.onLine) {
        await offlineAddInspection(form)
        await refreshPendingCount()
        showStatus('Saved offline successfully', 'success')
        toast.success('Saved offline successfully')
        return
      }

      let signatureUrl = form.signature_storage_url
      if (form.signature_data_url && !signatureUrl) {
        signatureUrl = await uploadSignature(form.signature_data_url)
        setValue('signature_storage_url', signatureUrl)
      }

      const response = await fetch('/api/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'submitted',
          form: {
            ...form,
            signature_storage_url: signatureUrl,
          },
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to submit report')
      }

      setValue('report_id', result.report_id)
      localStorage.removeItem('maintenance:lastReportId')
      localStorage.removeItem(STORAGE_KEY)
      setIsLocked(true)
      showStatus('Report submitted successfully. Editing is now locked.', 'success')
      toast.success('Report submitted successfully')
      router.push('/maintenance')
    } catch (error) {
      // If we failed due to connectivity, queue offline
      if (!navigator.onLine) {
        await offlineAddInspection(form)
        await refreshPendingCount()
        showStatus('Saved offline successfully', 'success')
        toast.success('Saved offline successfully')
        return
      }
      const failMsg = error instanceof Error ? error.message : 'Submit failed'
      showStatus(failMsg, 'error')
      toast.error(failMsg)
    } finally {
      setIsSubmitting(false)
    }
  }

  const onSubmit = handleSubmit(submitReport)

  const generateDoorSummary = async (doorIndex: number) => {
    if (isLocked || aiDoorLoadingIndex !== null) return
    if (!navigator.onLine) {
      showStatus('This feature is not available offline', 'info')
      return
    }

    const door = getValues(`doors.${doorIndex}`)
    const doorNotes = String(door?.notes ?? '').trim()

    if (!doorNotes) {
      showStatus('Enter technician notes before improving wording.', 'info')
      return
    }

    setAiDoorLoadingIndex(doorIndex)

    try {
      const response = await fetch('/api/ai/door-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          door_number: door?.door_number ?? `Door ${doorIndex + 1}`,
          technician_notes: doorNotes,
        }),
      })

      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate AI summary')
      }

      const aiSummary = String(data.summary ?? '').trim()
      if (!aiSummary) {
        throw new Error('AI returned an empty summary')
      }

      setValue(`doors.${doorIndex}.notes`, aiSummary, { shouldDirty: true, shouldValidate: true })
      showStatus(`Notes improved for Door ${doorIndex + 1}. Please review before submission.`, 'success')
    } catch {
      showStatus('Unable to improve notes. Please check internet connection.', 'info')
    } finally {
      setAiDoorLoadingIndex(null)
    }
  }

  const handleToggleAllDoors = () => {
    const doors = getValues('doors') ?? []
    const allCollapsed = doors.every(door => Boolean(door.isCollapsed))
    replace(
      doors.map(door => ({
        ...door,
        isCollapsed: !allCollapsed,
      })),
    )
  }

  return (
    <div className="mx-auto w-full max-w-screen-md space-y-4">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Maintenance Inspection Form</h1>
        <p className="mt-0.5 text-xs text-slate-600">Mobile onsite inspection workflow with autosave</p>

        {isOffline ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            🔴 Offline Mode – Data will be saved locally
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
            🟢 Back Online – Please sync data
          </div>
        )}

        {pendingSyncCount > 0 && (
          <div className="mt-3 flex flex-col gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <div className="font-semibold">You have {pendingSyncCount} reports pending sync</div>
            <button
              type="button"
              onClick={async () => {
                await syncPendingReports()
              }}
              disabled={!isOnline || isSyncingPending}
              className="h-11 w-full rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isSyncingPending ? 'Syncing...' : 'Sync Pending Reports'}
            </button>
          </div>
        )}

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>Inspection Progress</span>
            <span>{progress.done}/{progress.total} doors complete</span>
          </div>
          <div className="h-3 rounded-full bg-slate-200">
            <div className="h-3 rounded-full bg-blue-600" style={{ width: `${progress.percentage}%` }} />
          </div>
        </div>

        {offlineSaveStatusLabel ? (
          <p className="mt-2 text-xs font-medium text-slate-600">{offlineSaveStatusLabel}</p>
        ) : null}

        {statusMessage && (
          <div className={`mt-3 rounded-xl border px-3 py-2 text-sm ${
            statusType === 'error'
              ? 'border-red-200 bg-red-50 text-red-700'
              : statusType === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}>
            {statusMessage}
          </div>
        )}

        <button
          type="button"
          onClick={() => setShowFaultPanel(prev => !prev)}
          className="mt-3 h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 md:hidden"
        >
          {showFaultPanel ? 'Hide Fault Summary' : 'View Fault Summary'}
        </button>

        {showFaultPanel && (
          <div className="mt-3 md:hidden">
            <FaultSummaryPanel doorsWithFaults={faultDetection.doorsWithFaults} />
          </div>
        )}
      </header>

      <div className="flex flex-col gap-4 md:grid md:grid-cols-[minmax(0,1fr)_280px]">
      <form className="space-y-4 pb-24 md:pb-4" onSubmit={onSubmit}>
        <Section6NotesSync control={control} setValue={setValue} supabase={supabase} />
        <fieldset disabled={isLocked && !isAdminMode} className="space-y-4">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">1. Technician Information</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Technician Name
              <input
                {...register('technician_name')}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
              />
              {errors.technician_name && <span className="text-xs text-red-600">{errors.technician_name.message}</span>}
            </label>

            <label className="text-sm font-medium text-slate-700">
              Submission Date
              <input
                type="date"
                {...register('submission_date')}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
              />
            </label>

            <label className="text-sm font-medium text-slate-700">
              Source App
              <input
                {...register('source_app')}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
              />
            </label>
          </div>
        </section>

        <h2 className="mb-3 text-lg font-semibold text-blue-900">Site &amp; inspection overview</h2>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">2. Client & Location</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Client
              <Controller
                name="client_id"
                control={control}
                render={({ field }) => (
                  <select
                    ref={field.ref}
                    name={field.name}
                    value={field.value ?? ''}
                    onBlur={field.onBlur}
                    className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
                    onChange={async event => {
                      const selectedId = event.target.value
                      field.onChange(selectedId)
                      setValue('client_location_id', '', { shouldDirty: true, shouldValidate: true })
                      setValue('address', '', { shouldDirty: true, shouldValidate: true })
                      void offlineSetLastSelection({ client_id: selectedId, client_location_id: '' })
                      await loadLocationsForClient(selectedId)
                    }}
                  >
                    <option value="">Select client</option>
                    {clientOptions.map(client => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {errors.client_id && <span className="text-xs text-red-600">{errors.client_id.message}</span>}
            </label>

            <label className="text-sm font-medium text-slate-700">
              Location
              <Controller
                name="client_location_id"
                control={control}
                render={({ field }) => (
                  <select
                    ref={field.ref}
                    name={field.name}
                    value={field.value ?? ''}
                    onBlur={field.onBlur}
                    className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
                    onChange={event => {
                      const selectedLocationId = event.target.value
                      field.onChange(selectedLocationId)
                      const foundLocation = locationOptions.find(item => item.id === selectedLocationId)
                      setValue('address', foundLocation?.address ?? '', { shouldDirty: true, shouldValidate: true })
                      const locationClientId = String(foundLocation?.client_id ?? '').trim()
                      const currentClientId = String(getValues('client_id') ?? '').trim()
                      if (locationClientId && locationClientId !== currentClientId) {
                        setValue('client_id', locationClientId, { shouldDirty: true, shouldValidate: true })
                      }
                      void offlineSetLastSelection({
                        client_id: locationClientId || currentClientId,
                        client_location_id: selectedLocationId,
                      })
                    }}
                  >
                    <option value="">Select location</option>
                    {locationOptions.map(location => (
                      <option key={location.id} value={location.id}>
                        {location.name}
                      </option>
                    ))}
                  </select>
                )}
              />
              {isOffline && watchedClientId && locations.length === 0 && (
                <span className="mt-1 block text-xs text-amber-700">
                  No offline data available. Please connect to internet once.
                </span>
              )}
              {errors.client_location_id && <span className="text-xs text-red-600">{errors.client_location_id.message}</span>}
            </label>

            <label className="text-sm font-medium text-slate-700 md:col-span-2">
              Address
              <textarea
                {...register('address')}
                rows={3}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
              />
              {errors.address && <span className="text-xs text-red-600">{errors.address.message}</span>}
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">3. Inspection Details</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
            <label className="text-sm font-medium text-slate-700">
              Date
              <input type="date" {...register('inspection_date')} className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Inspection Time Start
              <input type="time" {...register('inspection_start')} className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Inspection Time End
              <input type="time" {...register('inspection_end')} className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-base" />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Total Doors Inspected
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter number"
                value={String(watchedTotalDoors ?? '')}
                onChange={event => {
                  const raw = digitsOnly(event.target.value)
                  const parsed = raw ? Number(raw) : 0
                  setValue('total_doors', parsed, { shouldValidate: true, shouldDirty: true })
                }}
                className="mt-1 h-12 w-full rounded-xl border border-slate-300 px-3 text-base"
              />
              <p className="mt-1 text-xs text-slate-500">
              {watchedClientLocationId
                ? 'Auto-loaded from selected location door registry. You can adjust this if fewer doors were inspected.'
                : 'Required. Enter total doors inspected (1 to 50).'}
              </p>
              {errors.total_doors && <span className="text-xs text-red-600">{errors.total_doors.message}</span>}
            </label>
          </div>
        </section>

        <DoorDiagram />

        <section className="space-y-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">4 & 5. Door Inspection + Checklist Matrix</h2>
            <button
              type="button"
              onClick={handleToggleAllDoors}
              className="h-12 w-full rounded-xl border border-slate-300 px-4 text-sm font-semibold text-slate-700 sm:w-auto"
            >
              Collapse All Doors
            </button>
          </div>
          {isOffline && watchedClientLocationId && availableDoors.length === 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
              No offline doors available. Please connect once.
            </div>
          )}
          {fields.map((field, index) => (
            <DoorInspectionCard
              key={field.id}
              control={control}
              index={index}
              reportId={watchedReportId}
              register={register}
              update={update}
              availableDoors={availableDoors}
              hasFault={faultDetection.faultsByDoor[index]?.faultItems.length > 0}
              faultCount={faultDetection.faultsByDoor[index]?.faultItems.length ?? 0}
              disabled={isLocked && !isAdminMode}
              onGenerateSummary={() => void generateDoorSummary(index)}
              isGeneratingSummary={aiDoorLoadingIndex === index}
              isOffline={isOffline}
            />
          ))}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">6. Notes</h2>
          <p className="mt-1 text-xs text-slate-500">
            Compiled from door notes. Edit as needed. Use &quot;Improve / Rephrase Notes&quot; to improve wording.
          </p>
          <textarea
            {...register('notes')}
            rows={4}
            className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-base"
            placeholder="Door 1: ...&#10;Door 2: ..."
          />
          <AISummaryButton
            notes={watchedNotes || ''}
            reportId={watchedReportId}
            disabled={isLocked && !isAdminMode}
            isGenerating={isGeneratingAiSummary}
            setIsGenerating={setIsGeneratingAiSummary}
            onApplySummary={summary => {
              setValue('notes', summary, { shouldDirty: true, shouldValidate: true })
              showStatus('Notes improved. Please review before submission.', 'success')
            }}
            onError={message => {
              showStatus(message, 'info')
            }}
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">7. Photo Upload</h2>
          <p className="mt-2 text-sm text-slate-600">Photos are uploaded per door card and linked during report save/submit.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">8. Signature</h2>
          <div className="mt-3">
            <SignaturePad
              value={getValues('signature_data_url') || ''}
              onChange={dataUrl => {
                setValue('signature_data_url', dataUrl)
              }}
            />
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">9. Save / Submit</h2>
          {isAdminMode ? (
            <div className="mt-3 flex flex-col gap-4">
              <p className="text-sm text-slate-600">Manager / Admin: edit, approve, and download. Submit Report is not available.</p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={async () => {
                    setIsSavingDraft(true)
                    const ok = await persistDraft('reviewing', { adminEdit: true })
                    setIsSavingDraft(false)
                    if (ok) showStatus('Changes saved.', 'success')
                  }}
                  disabled={isSavingDraft}
                  className="h-12 rounded-xl bg-slate-900 px-5 text-base font-bold text-white disabled:opacity-50"
                >
                  {isSavingDraft ? 'Saving...' : 'Save changes'}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!reportIdFromRoute) return
                    setIsApproving(true)
                    try {
                      const res = await fetch(`/api/maintenance/reports/${reportIdFromRoute}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ status: 'approved' }),
                      })
                      const data = await res.json().catch(() => ({}))
                      if (!res.ok) throw new Error(data.error ?? 'Approve failed')
                      if (typeof data.client_view_url === 'string' && data.client_view_url) {
                        setClientViewUrl(data.client_view_url)
                      }
                      showStatus('Report approved.', 'success')
                      onApproved?.()
                    } catch (e) {
                      showStatus(e instanceof Error ? e.message : 'Approve failed', 'error')
                    } finally {
                      setIsApproving(false)
                    }
                  }}
                  disabled={isApproving}
                  className="h-12 rounded-xl bg-emerald-600 px-5 text-base font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {isApproving ? 'Approving...' : 'Approve Report'}
                </button>
                {clientViewUrl ? (
                  <button
                    type="button"
                    onClick={() => {
                      void navigator.clipboard.writeText(clientViewUrl).then(() => {
                        toast.success('Client link copied')
                      })
                    }}
                    className="h-12 rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-base font-bold text-emerald-800 hover:bg-emerald-100"
                  >
                    Copy client link
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={async () => {
                    if (!reportIdFromRoute) return
                    try {
                      const saved = await persistDraft('reviewing', { adminEdit: true, silent: true })
                      if (!saved) {
                        showStatus('Unable to save latest changes before generating PDF. Please try Save changes first.', 'error')
                        return
                      }
                      const { blob, filename } = await fetchPdfBlob(`/api/maintenance/pdf/${reportIdFromRoute}`)
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = filename ?? `maintenance-report-${reportIdFromRoute.slice(0, 8)}.pdf`
                      a.click()
                      URL.revokeObjectURL(url)
                      showStatus('PDF downloaded.', 'success')
                    } catch (e) {
                      showStatus(e instanceof Error ? e.message : 'Download failed', 'error')
                    }
                  }}
                  className="h-12 rounded-xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-800 hover:bg-slate-50"
                >
                  Generate PDF
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!reportIdFromRoute) return
                    try {
                      const saved = await persistDraft('reviewing', { adminEdit: true, silent: true })
                      if (!saved) {
                        showStatus('Unable to save latest changes before downloading report. Please try Save changes first.', 'error')
                        return
                      }
                      const { blob, filename } = await fetchPdfBlob(`/api/maintenance/pdf/${reportIdFromRoute}`)
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = filename ?? `maintenance-report-${reportIdFromRoute.slice(0, 8)}.pdf`
                      a.click()
                      URL.revokeObjectURL(url)
                      showStatus('Report downloaded.', 'success')
                    } catch (e) {
                      showStatus(e instanceof Error ? e.message : 'Download failed', 'error')
                    }
                  }}
                  className="h-12 rounded-xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-800 hover:bg-slate-50"
                >
                  Download
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!reportIdFromRoute) return
                    try {
                      const res = await fetch(`/api/maintenance/photos/${reportIdFromRoute}/zip`)
                      if (!res.ok) throw new Error('Download failed')
                      const blob = await res.blob()
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `maintenance-photos-${reportIdFromRoute.slice(0, 8)}.zip`
                      a.click()
                      URL.revokeObjectURL(url)
                      showStatus('Photos downloaded.', 'success')
                    } catch (e) {
                      showStatus(e instanceof Error ? e.message : 'Download failed', 'error')
                    }
                  }}
                  className="h-12 rounded-xl border border-slate-300 bg-white px-5 text-base font-bold text-slate-800 hover:bg-slate-50"
                >
                  Download Photos
                </button>
              </div>
            </div>
          ) : !isLocked ? (
            <div className="mt-3 flex flex-col gap-3">
              <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:flex-row md:border-0 md:bg-transparent md:px-0 md:py-0">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isSavingDraft || isSubmitting}
                  className="h-14 w-full rounded-xl border border-slate-300 px-5 text-base font-bold text-slate-800 disabled:opacity-50 md:w-auto"
                >
                  {isSavingDraft ? 'Saving Draft...' : 'Save Draft'}
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !progress.allDone}
                  className="h-14 w-full rounded-xl bg-slate-900 px-5 text-base font-bold text-white disabled:opacity-50 md:w-auto"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Report'}
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem(STORAGE_KEY)
                  reset(getDefaultFormValues())
                  showStatus('Form reset. All fields cleared.', 'info')
                }}
                className="h-12 w-full rounded-xl border border-red-300 bg-red-50 px-5 text-base font-semibold text-red-700 hover:bg-red-100 md:w-auto"
              >
                Reset Form
              </button>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
              Editing is locked for this submitted report.
            </p>
          )}

          {pendingSyncCount > 0 && (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              You have {pendingSyncCount} pending report{pendingSyncCount === 1 ? '' : 's'} to sync.
            </p>
          )}
        </section>
        </fieldset>
      </form>

      <div className="hidden md:sticky md:top-4 md:block md:self-start">
        <FaultSummaryPanel doorsWithFaults={faultDetection.doorsWithFaults} />
      </div>
      </div>
    </div>
  )
}

export default function MaintenanceInspectionPage() {
  return <MaintenanceInspectionForm />
}
