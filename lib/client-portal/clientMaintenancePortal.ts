import { createServiceRoleClient } from '@/lib/supabase/serviceRole'

export type ClientPortalSingleSummary = {
  kind: 'single'
  id: string
  shareToken: string
  /** YYYY-MM-DD for grouping */
  displayDate: string
  address: string | null
  locationLabel: string | null
}

export type ClientPortalMergedSummary = {
  kind: 'merged'
  id: string
  /** Token for `/report/view/[token]` */
  accessToken: string
  displayDate: string
  clientName: string | null
}

export type ClientPortalDoorFolder = {
  key: string
  /** `registry` = doors.id UUID; `legacy` = base64url composite */
  keyType: 'registry' | 'legacy'
  registryDoorId: string | null
  legacyLocationId: string | null
  legacyDoorNumber: string | null
  folderTitle: string
  hoverLines: string[]
}

export type ClientPortalDoorVisit = {
  reportId: string
  displayDate: string
  maintenanceDoorRowId: string
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(s: string): boolean {
  return UUID_RE.test(String(s ?? '').trim())
}

export function encodeLegacyDoorFolderKey(locationId: string, doorNumber: string): string {
  const payload = `${String(locationId).trim()}:${String(doorNumber).trim()}`
  return Buffer.from(payload, 'utf8').toString('base64url')
}

export function decodeLegacyDoorFolderKey(key: string): { locationId: string; doorNumber: string } | null {
  try {
    const raw = Buffer.from(String(key).trim(), 'base64url').toString('utf8')
    const idx = raw.indexOf(':')
    if (idx <= 0) return null
    const locationId = raw.slice(0, idx).trim()
    const doorNumber = raw.slice(idx + 1).trim()
    if (!locationId || !doorNumber) return null
    return { locationId, doorNumber }
  } catch {
    return null
  }
}

function ymdFromDateish(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  return s.slice(0, 10)
}

function locationHoverParts(loc: {
  location_name?: string | null
  Company_address?: string | null
  suburb?: string | null
} | null): string[] {
  if (!loc) return []
  const lines: string[] = []
  const name = String(loc.location_name ?? '').trim()
  if (name) lines.push(name)
  const addr = String(loc.Company_address ?? (loc as { company_address?: string | null }).company_address ?? '').trim()
  const sub = String(loc.suburb ?? '').trim()
  const addrLine = [addr, sub].filter(Boolean).join(', ')
  if (addrLine) lines.push(addrLine)
  return lines
}

/** Location IDs visible to this portal login — one site when `portalLocationId` set, else all org sites. */
export async function resolvePortalLocationIds(
  clientId: string,
  portalLocationId: string | null,
): Promise<string[]> {
  const supabase = createServiceRoleClient()
  const scoped = String(portalLocationId ?? '').trim()
  if (scoped) {
    const { data } = await supabase.from('client_locations').select('id, client_id').eq('id', scoped).maybeSingle()
    const row = data as { id?: string; client_id?: string } | null
    if (!row?.id || String(row.client_id ?? '').trim() !== clientId.trim()) {
      return []
    }
    return [String(row.id)]
  }
  const { data } = await supabase.from('client_locations').select('id').eq('client_id', clientId)
  return (data ?? []).map(r => String((r as { id?: string }).id ?? '').trim()).filter(Boolean)
}

/** Merged PDF allowed only if every bundled report is under an allowed location. */
export async function mergedReportAllowedForClientPortal(
  mergedReportRowId: string,
  clientId: string,
  portalLocationId: string | null,
): Promise<boolean> {
  const svc = createServiceRoleClient()
  const allowed = await resolvePortalLocationIds(clientId, portalLocationId)
  if (!allowed.length) return false

  const { data: mr } = await svc
    .from('merged_reports')
    .select('report_ids, client_id')
    .eq('id', mergedReportRowId)
    .maybeSingle()

  const row = mr as { report_ids?: string[] | null; client_id?: string | null } | null
  if (!row || String(row.client_id ?? '').trim() !== clientId.trim()) return false

  const ids = Array.isArray(row.report_ids) ? row.report_ids.map(id => String(id).trim()).filter(Boolean) : []
  if (!ids.length) return false

  const { data: reps } = await svc.from('maintenance_reports').select('client_location_id').in('id', ids)
  const locs = [
    ...new Set(
      (reps ?? [])
        .map(r => String((r as { client_location_id?: string | null }).client_location_id ?? '').trim())
        .filter(Boolean),
    ),
  ]
  if (!locs.length) return false
  return locs.every(l => allowed.includes(l))
}

/** Approved singles with share link + PDF, scoped to client's locations. */
export async function fetchClientPortalSingleReports(
  clientId: string,
  portalLocationId: string | null = null,
): Promise<ClientPortalSingleSummary[]> {
  const supabase = createServiceRoleClient()
  const locIds = await resolvePortalLocationIds(clientId, portalLocationId)
  if (!locIds.length) return []

  const { data, error } = await supabase
    .from('maintenance_reports')
    .select(
      `
      id,
      share_token,
      inspection_date,
      submission_date,
      address,
      pdf_url,
      client_location_id,
      client_locations (
        location_name,
        Company_address,
        suburb
      )
    `,
    )
    .eq('status', 'approved')
    .eq('approved', true)
    .not('share_token', 'is', null)
    .not('pdf_url', 'is', null)
    .in('client_location_id', locIds)
    .order('inspection_date', { ascending: false })

  if (error || !data) return []

  const rows = data as Array<{
    id: string
    share_token: string | null
    inspection_date: string | null
    submission_date: string | null
    address: string | null
    client_locations?: {
      location_name?: string | null
      Company_address?: string | null
      suburb?: string | null
    } | null
  }>

  return rows
    .map(r => {
      const token = String(r.share_token ?? '').trim()
      if (!token) return null
      const inspection = ymdFromDateish(r.inspection_date)
      const submission = ymdFromDateish(r.submission_date)
      const displayDate = inspection || submission
      if (!displayDate) return null
      const loc = r.client_locations ?? null
      const locationLabel = String(loc?.location_name ?? '').trim() || null
      return {
        kind: 'single' as const,
        id: String(r.id),
        shareToken: token,
        displayDate,
        address: r.address ? String(r.address).trim() || null : null,
        locationLabel,
      }
    })
    .filter(Boolean) as ClientPortalSingleSummary[]
}

export async function fetchClientPortalMergedReports(
  clientId: string,
  portalLocationId: string | null = null,
): Promise<ClientPortalMergedSummary[]> {
  const supabase = createServiceRoleClient()
  const { data, error } = await supabase
    .from('merged_reports')
    .select('id, share_token, access_token, client_name, created_at, pdf_storage_path, access_expires_at')
    .eq('client_id', clientId)
    .is('deleted_at', null)
    .not('pdf_storage_path', 'is', null)
    .order('created_at', { ascending: false })

  if (error || !data) return []

  const now = Date.now()
  const rows = data as Array<{
    id: string
    share_token: string | null
    access_token: string | null
    client_name: string | null
    created_at: string | null
    pdf_storage_path: string | null
    access_expires_at: string | null
  }>

  const out: ClientPortalMergedSummary[] = []
  for (const r of rows) {
    const exp = r.access_expires_at ? new Date(String(r.access_expires_at)).getTime() : NaN
    if (!Number.isNaN(exp) && exp < now) continue

    const token =
      String(r.share_token ?? '').trim() || String(r.access_token ?? '').trim()
    if (!token) continue

    if (portalLocationId?.trim()) {
      const ok = await mergedReportAllowedForClientPortal(String(r.id), clientId, portalLocationId)
      if (!ok) continue
    }

    const created = r.created_at ? String(r.created_at) : ''
    const displayDate = created.slice(0, 10) || '1970-01-01'

    out.push({
      kind: 'merged',
      id: String(r.id),
      accessToken: token,
      displayDate,
      clientName: r.client_name ? String(r.client_name).trim() || null : null,
    })
  }
  return out
}

export type ClientPortalReportEntry = ClientPortalSingleSummary | ClientPortalMergedSummary

export function groupPortalReportsByDate(entries: ClientPortalReportEntry[]): Map<string, ClientPortalReportEntry[]> {
  const map = new Map<string, ClientPortalReportEntry[]>()
  for (const e of entries) {
    const d = e.displayDate
    const list = map.get(d) ?? []
    list.push(e)
    map.set(d, list)
  }
  const sortedKeys = [...map.keys()].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  const ordered = new Map<string, ClientPortalReportEntry[]>()
  for (const k of sortedKeys) {
    ordered.set(k, map.get(k)!)
  }
  return ordered
}

export function formatPortalDisplayDateYmd(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number)
  if (!y || !m || !d) return ymd
  try {
    const dt = new Date(Date.UTC(y, m - 1, d))
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt)
  } catch {
    return ymd
  }
}

/** Registry doors + legacy door folders from inspections without door_id. */
export async function fetchClientGalleryDoorFolders(
  clientId: string,
  portalLocationId: string | null = null,
): Promise<ClientPortalDoorFolder[]> {
  const supabase = createServiceRoleClient()
  const locIds = await resolvePortalLocationIds(clientId, portalLocationId)
  if (!locIds.length) return []

  const { data: locRows } = await supabase
    .from('client_locations')
    .select('id, location_name, Company_address, suburb')
    .in('id', locIds)

  const locMap = new Map<string, { location_name?: string | null; Company_address?: string | null; suburb?: string | null }>()
  for (const row of locRows ?? []) {
    const id = String((row as { id?: string }).id ?? '').trim()
    if (id) locMap.set(id, row as { location_name?: string | null; Company_address?: string | null; suburb?: string | null })
  }

  const { data: doors } = await supabase
    .from('doors')
    .select(
      `
      id,
      door_label,
      door_description,
      door_type,
      client_location_id,
      client_locations (
        location_name,
        Company_address,
        suburb
      )
    `,
    )
    .in('client_location_id', locIds)
    .order('door_label', { ascending: true })

  const folders: ClientPortalDoorFolder[] = []

  for (const row of doors ?? []) {
    const dr = row as {
      id: string
      door_label: string | null
      door_description: string | null
      door_type: string | null
      client_location_id: string | null
      client_locations?: {
        location_name?: string | null
        Company_address?: string | null
        suburb?: string | null
      } | null
    }
    const id = String(dr.id ?? '').trim()
    const label = String(dr.door_label ?? '').trim() || 'Door'
    const desc = String(dr.door_description ?? '').trim()
    const dt = String(dr.door_type ?? '').trim()
    const locNested = dr.client_locations ?? locMap.get(String(dr.client_location_id ?? '')) ?? null
    const hover = [...locationHoverParts(locNested)]
    if (desc) hover.push(desc)
    if (dt) hover.push(`Type: ${dt}`)

    folders.push({
      key: id,
      keyType: 'registry',
      registryDoorId: id,
      legacyLocationId: null,
      legacyDoorNumber: null,
      folderTitle: label,
      hoverLines: hover.length ? hover : ['Maintenance inspection photos'],
    })
  }

  const { data: orphanMd } = await supabase
    .from('maintenance_doors')
    .select(
      `
      door_number,
      maintenance_reports!inner (
        id,
        status,
        approved,
        pdf_url,
        share_token,
        client_location_id
      )
    `,
    )
    .is('door_id', null)
    .eq('maintenance_reports.status', 'approved')
    .eq('maintenance_reports.approved', true)
    .not('maintenance_reports.share_token', 'is', null)
    .not('maintenance_reports.pdf_url', 'is', null)

  const legacySeen = new Set<string>()
  for (const row of orphanMd ?? []) {
    const md = row as {
      door_number: string | null
      maintenance_reports?: {
        client_location_id?: string | null
      } | null
    }
    const mr = md.maintenance_reports
    const clid = String(mr?.client_location_id ?? '').trim()
    const doorNum = String(md.door_number ?? '').trim()
    if (!clid || !doorNum || !locIds.includes(clid)) continue
    const composite = `${clid}:${doorNum}`
    if (legacySeen.has(composite)) continue
    legacySeen.add(composite)

    const loc = locMap.get(clid) ?? null
    const hover = [...locationHoverParts(loc)]
    hover.push(`Door label (report): ${doorNum}`)
    const folderTitle = doorNum

    folders.push({
      key: encodeLegacyDoorFolderKey(clid, doorNum),
      keyType: 'legacy',
      registryDoorId: null,
      legacyLocationId: clid,
      legacyDoorNumber: doorNum,
      folderTitle,
      hoverLines: hover.length ? hover : ['Maintenance inspection photos'],
    })
  }

  folders.sort((a, b) => a.folderTitle.localeCompare(b.folderTitle, undefined, { sensitivity: 'base' }))
  return folders
}

export async function fetchDoorGalleryVisits(
  clientId: string,
  folder: Pick<ClientPortalDoorFolder, 'keyType' | 'registryDoorId' | 'legacyLocationId' | 'legacyDoorNumber'>,
  portalLocationId: string | null = null,
): Promise<ClientPortalDoorVisit[]> {
  const supabase = createServiceRoleClient()
  const locIds = await resolvePortalLocationIds(clientId, portalLocationId)
  if (!locIds.length) return []

  if (folder.keyType === 'registry' && folder.registryDoorId) {
    const { data, error } = await supabase
      .from('maintenance_doors')
      .select(
        `
        id,
        maintenance_reports!inner (
          id,
          inspection_date,
          submission_date,
          status,
          approved,
          pdf_url,
          share_token,
          client_location_id
        )
      `,
      )
      .eq('door_id', folder.registryDoorId)

    if (error || !data) return []

    const visits = new Map<string, ClientPortalDoorVisit>()
    for (const row of data as Array<{
      id: string
      maintenance_reports?: {
        id?: string
        inspection_date?: string | null
        submission_date?: string | null
        status?: string
        approved?: boolean | null
        pdf_url?: string | null
        share_token?: string | null
        client_location_id?: string | null
      } | null
    }>) {
      const mr = row.maintenance_reports
      if (!mr) continue
      if (String(mr.status ?? '') !== 'approved' || !mr.approved) continue
      if (!String(mr.share_token ?? '').trim() || !String(mr.pdf_url ?? '').trim()) continue
      const clid = String(mr.client_location_id ?? '').trim()
      if (!locIds.includes(clid)) continue
      const inspection = ymdFromDateish(mr.inspection_date)
      const submission = ymdFromDateish(mr.submission_date)
      const displayDate = inspection || submission
      if (!displayDate) continue
      const reportId = String(mr.id ?? '').trim()
      const mdRowId = String(row.id ?? '').trim()
      if (!reportId || !mdRowId) continue
      visits.set(reportId, { reportId, displayDate, maintenanceDoorRowId: mdRowId })
    }
    return [...visits.values()].sort((a, b) => (a.displayDate < b.displayDate ? 1 : a.displayDate > b.displayDate ? -1 : 0))
  }

  if (
    folder.keyType === 'legacy' &&
    folder.legacyLocationId &&
    folder.legacyDoorNumber &&
    locIds.includes(folder.legacyLocationId)
  ) {
    const { data, error } = await supabase
      .from('maintenance_doors')
      .select(
        `
        id,
        door_number,
        maintenance_reports!inner (
          id,
          inspection_date,
          submission_date,
          status,
          approved,
          pdf_url,
          share_token,
          client_location_id
        )
      `,
      )
      .is('door_id', null)
      .eq('door_number', folder.legacyDoorNumber)

    if (error || !data) return []

    const visits = new Map<string, ClientPortalDoorVisit>()
    for (const row of data as Array<{
      id: string
      door_number?: string | null
      maintenance_reports?: {
        id?: string
        inspection_date?: string | null
        submission_date?: string | null
        status?: string
        approved?: boolean | null
        pdf_url?: string | null
        share_token?: string | null
        client_location_id?: string | null
      } | null
    }>) {
      const mr = row.maintenance_reports
      if (!mr) continue
      if (String(mr.client_location_id ?? '').trim() !== folder.legacyLocationId) continue
      if (String(row.door_number ?? '').trim() !== folder.legacyDoorNumber) continue
      if (String(mr.status ?? '') !== 'approved' || !mr.approved) continue
      if (!String(mr.share_token ?? '').trim() || !String(mr.pdf_url ?? '').trim()) continue
      const inspection = ymdFromDateish(mr.inspection_date)
      const submission = ymdFromDateish(mr.submission_date)
      const displayDate = inspection || submission
      if (!displayDate) continue
      const reportId = String(mr.id ?? '').trim()
      const mdRowId = String(row.id ?? '').trim()
      if (!reportId || !mdRowId) continue
      visits.set(reportId, { reportId, displayDate, maintenanceDoorRowId: mdRowId })
    }
    return [...visits.values()].sort((a, b) => (a.displayDate < b.displayDate ? 1 : a.displayDate > b.displayDate ? -1 : 0))
  }

  return []
}

/** Resolve gallery folder from URL segment (registry UUID or legacy base64url key). */
export async function resolveClientGalleryFolder(
  clientId: string,
  doorKey: string,
  portalLocationId: string | null = null,
): Promise<ClientPortalDoorFolder | null> {
  const supabase = createServiceRoleClient()
  const locIds = await resolvePortalLocationIds(clientId, portalLocationId)
  if (!locIds.length) return null

  const rawKey = String(doorKey ?? '').trim()
  if (!rawKey) return null

  if (isUuid(rawKey)) {
    const { data } = await supabase
      .from('doors')
      .select(
        `
        id,
        door_label,
        door_description,
        door_type,
        client_location_id,
        client_locations (
          location_name,
          Company_address,
          suburb
        )
      `,
      )
      .eq('id', rawKey)
      .maybeSingle()

    const dr = data as {
      id?: string
      door_label?: string | null
      door_description?: string | null
      door_type?: string | null
      client_location_id?: string | null
      client_locations?: {
        location_name?: string | null
        Company_address?: string | null
        suburb?: string | null
      } | null
    } | null

    if (!dr?.id) return null
    const clid = String(dr.client_location_id ?? '').trim()
    if (!locIds.includes(clid)) return null

    const label = String(dr.door_label ?? '').trim() || 'Door'
    const desc = String(dr.door_description ?? '').trim()
    const dt = String(dr.door_type ?? '').trim()
    const locNested = dr.client_locations ?? null
    const hover = [...locationHoverParts(locNested)]
    if (desc) hover.push(desc)
    if (dt) hover.push(`Type: ${dt}`)

    return {
      key: String(dr.id),
      keyType: 'registry',
      registryDoorId: String(dr.id),
      legacyLocationId: null,
      legacyDoorNumber: null,
      folderTitle: label,
      hoverLines: hover.length ? hover : ['Maintenance inspection photos'],
    }
  }

  const decoded = decodeLegacyDoorFolderKey(rawKey)
  if (!decoded || !locIds.includes(decoded.locationId)) return null

  const { data: locRow } = await supabase
    .from('client_locations')
    .select('location_name, Company_address, suburb')
    .eq('id', decoded.locationId)
    .maybeSingle()

  const loc = locRow as {
    location_name?: string | null
    Company_address?: string | null
    suburb?: string | null
  } | null

  const hover = [...locationHoverParts(loc)]
  hover.push(`Door label (report): ${decoded.doorNumber}`)

  return {
    key: rawKey,
    keyType: 'legacy',
    registryDoorId: null,
    legacyLocationId: decoded.locationId,
    legacyDoorNumber: decoded.doorNumber,
    folderTitle: decoded.doorNumber,
    hoverLines: hover.length ? hover : ['Maintenance inspection photos'],
  }
}

/** Same scope as portal listings: client's location, approved, shared token + PDF. */
export async function clientCanViewApprovedReportPhotos(
  clientId: string,
  reportId: string,
  portalLocationId: string | null = null,
): Promise<boolean> {
  const supabase = createServiceRoleClient()
  const locIds = await resolvePortalLocationIds(clientId, portalLocationId)
  if (!locIds.length) return false

  const { data } = await supabase
    .from('maintenance_reports')
    .select('client_location_id, status, approved, share_token, pdf_url')
    .eq('id', reportId)
    .maybeSingle()

  const row = data as {
    client_location_id?: string | null
    status?: string | null
    approved?: boolean | null
    share_token?: string | null
    pdf_url?: string | null
  } | null

  const clid = String(row?.client_location_id ?? '').trim()
  if (!clid || !locIds.includes(clid)) return false
  if (String(row?.status ?? '') !== 'approved' || !row?.approved) return false
  if (!String(row?.share_token ?? '').trim() || !String(row?.pdf_url ?? '').trim()) return false
  return true
}

/** Photo URLs for one door row on one report; null if access denied. */
/** Ordered photo row ids for gallery / proxied image URLs (stable order). */
export async function fetchGalleryPhotoIdsForVisit(
  clientId: string,
  reportId: string,
  maintenanceDoorRowId: string,
  portalLocationId: string | null = null,
): Promise<string[] | null> {
  const ok = await clientCanViewApprovedReportPhotos(clientId, reportId, portalLocationId)
  if (!ok) return null

  const supabase = createServiceRoleClient()
  const { data: md } = await supabase
    .from('maintenance_doors')
    .select('id')
    .eq('id', maintenanceDoorRowId)
    .eq('report_id', reportId)
    .maybeSingle()

  if (!md) return null

  const { data: photos } = await supabase
    .from('maintenance_photos')
    .select('id')
    .eq('door_id', maintenanceDoorRowId)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  return (photos ?? [])
    .map(p => String((p as { id?: string | null }).id ?? '').trim())
    .filter(Boolean)
}
