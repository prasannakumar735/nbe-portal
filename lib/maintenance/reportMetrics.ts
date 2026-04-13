import { MAINTENANCE_CHECKLIST_ITEMS } from '@/lib/types/maintenance.types'
import type { MaintenanceFormValues } from '@/lib/types/maintenance.types'

export type AggregatedReportMetrics = {
  totalDoors: number
  /** Non–N/A checklist answers only */
  totalChecks: number
  good: number
  caution: number
  fault: number
  /** Count of explicit N/A (informational only) */
  naCount: number
  healthScore: number | null
}

/**
 * Health score = good / (non-na checks). N/A is excluded from denominator.
 */
export function aggregateReportMetrics(form: MaintenanceFormValues): AggregatedReportMetrics {
  let good = 0
  let caution = 0
  let fault = 0
  let naCount = 0
  let totalChecks = 0

  for (const door of form.doors) {
    for (const item of MAINTENANCE_CHECKLIST_ITEMS) {
      const s = door.checklist[item.code] ?? null
      if (s === null) continue
      if (s === 'na') {
        naCount += 1
        continue
      }
      totalChecks += 1
      if (s === 'good') good += 1
      else if (s === 'caution') caution += 1
      else if (s === 'fault') fault += 1
    }
  }

  const healthScore = totalChecks > 0 ? Math.round((good / totalChecks) * 100) : null

  return {
    totalDoors: form.doors.length,
    totalChecks,
    good,
    caution,
    fault,
    naCount,
    healthScore,
  }
}

export type SectionFinding = { section: string; faults: number; cautions: number }

/** Per checklist section: fault/caution counts (ignores N/A and unset). */
export function buildSectionFindings(form: MaintenanceFormValues): SectionFinding[] {
  const map = new Map<string, { faults: number; cautions: number }>()
  for (const door of form.doors) {
    for (const item of MAINTENANCE_CHECKLIST_ITEMS) {
      const s = door.checklist[item.code] ?? null
      if (s === null || s === 'na') continue
      const sec = item.section || 'Other'
      if (!map.has(sec)) map.set(sec, { faults: 0, cautions: 0 })
      const e = map.get(sec)!
      if (s === 'fault') e.faults += 1
      if (s === 'caution') e.cautions += 1
    }
  }
  const out: SectionFinding[] = []
  map.forEach((v, section) => {
    if (v.faults > 0 || v.cautions > 0) out.push({ section, faults: v.faults, cautions: v.cautions })
  })
  out.sort((a, b) => b.faults + b.cautions - (a.faults + a.cautions))
  return out
}

/** Human-readable section label (matches PDF checklist section styling). */
export function formatMaintenanceSectionTitle(section: string): string {
  const s = section.trim()
  const m = s.match(/^([A-Z]\.\s*)(.+)$/i)
  if (!m) return s
  const rest = m[2]!.trim()
  const segments = rest.split(/\s*\/\s*/)
  const titled = segments
    .map(seg =>
      seg
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .map(w => {
          if (w === '&') return '&'
          if (!w) return w
          return w.charAt(0).toUpperCase() + w.slice(1)
        })
        .join(' ')
    )
    .join(' / ')
  return `${m[1]!.trimEnd()} ${titled}`
}

export type SignOffDisplayMetrics = {
  totalDoors: number
  /** All answered checklist cells: good + caution + fault + na */
  totalChecks: number
  good: number
  caution: number
  fault: number
  na: number
  /** good / (totalChecks - na) × 100; 0 when no non-N/A answers */
  healthScore: number
}

/**
 * Metrics for Approval & Sign-off summary. `totalChecks` includes N/A rows;
 * health score excludes N/A from the denominator (manager requirement).
 */
export function aggregateSignOffDisplayMetrics(form: MaintenanceFormValues): SignOffDisplayMetrics {
  let good = 0
  let caution = 0
  let fault = 0
  let na = 0
  for (const door of form.doors) {
    for (const item of MAINTENANCE_CHECKLIST_ITEMS) {
      const s = door.checklist[item.code] ?? null
      if (s === null) continue
      if (s === 'na') {
        na += 1
        continue
      }
      if (s === 'good') good += 1
      else if (s === 'caution') caution += 1
      else if (s === 'fault') fault += 1
    }
  }
  const totalChecks = good + caution + fault + na
  const validChecks = totalChecks - na
  const healthScore = validChecks > 0 ? Math.round((good / validChecks) * 100) : 0
  return {
    totalDoors: form.doors.length,
    totalChecks,
    good,
    caution,
    fault,
    na,
    healthScore,
  }
}

/** @deprecated Prefer buildSignOffFindingGroups — avoids duplicate section lines */
export type SignOffFindingRow = { section: string; count: number; typeLabel: string }

/** One row per section + severity (legacy). */
export function buildSignOffFindingRows(form: MaintenanceFormValues): SignOffFindingRow[] {
  const rows = buildSectionFindings(form)
  const out: SignOffFindingRow[] = []
  for (const r of rows) {
    const section = formatMaintenanceSectionTitle(r.section)
    if (r.cautions > 0) {
      out.push({
        section,
        count: r.cautions,
        typeLabel: r.cautions === 1 ? 'caution' : 'cautions',
      })
    }
    if (r.faults > 0) {
      out.push({
        section,
        count: r.faults,
        typeLabel: r.faults === 1 ? 'fault' : 'faults',
      })
    }
  }
  out.sort((a, b) => b.count - a.count)
  return out
}

/** Single row per checklist section (caution + fault combined). */
export type SignOffFindingGroup = {
  section: string
  caution: number
  fault: number
}

export function buildSignOffFindingGroups(form: MaintenanceFormValues): SignOffFindingGroup[] {
  return buildSectionFindings(form).map(r => ({
    section: formatMaintenanceSectionTitle(r.section),
    caution: r.cautions,
    fault: r.faults,
  }))
}

/** Concatenate all doors from merged maintenance reports for bundle metrics. */
export function combineMaintenanceFormsForBundle(forms: MaintenanceFormValues[]): MaintenanceFormValues {
  if (forms.length === 0) {
    throw new Error('combineMaintenanceFormsForBundle: at least one form required')
  }
  const doors = forms.flatMap(f => f.doors)
  const first = forms[0]!
  return {
    ...first,
    doors,
    total_doors: doors.length,
  }
}
