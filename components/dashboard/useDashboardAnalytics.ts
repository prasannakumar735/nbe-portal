'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { PeriodFilter } from './DashboardFilters'
import type { WeeklyChartDatum } from './DashboardWeeklyChart'
import type { ProjectPieDatum } from './DashboardProjectPie'

interface TimeEntryRow {
  id: string
  client_id: string
  start_time: string
  end_time: string | null
  hours: number | null
  status: string | null
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const

function getRange(period: PeriodFilter, customStart: string, customEnd: string) {
  const now = new Date()

  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  if (period === 'custom' && customStart && customEnd) {
    const start = new Date(customStart)
    const end = new Date(customEnd)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  const monday = new Date(now)
  const day = monday.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  monday.setDate(monday.getDate() + mondayOffset)
  monday.setHours(0, 0, 0, 0)

  if (period === 'last_week') {
    const start = new Date(monday)
    start.setDate(start.getDate() - 7)
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
    return { start, end }
  }

  const start = new Date(monday)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

function toHours(entry: TimeEntryRow): number {
  if (typeof entry.hours === 'number' && Number.isFinite(entry.hours)) {
    return entry.hours
  }

  if (entry.end_time) {
    const start = new Date(entry.start_time).getTime()
    const end = new Date(entry.end_time).getTime()
    const diff = Math.max(0, end - start)
    return diff / 3600000
  }

  return 0
}

export function useDashboardAnalytics(userId: string) {
  const [period, setPeriod] = useState<PeriodFilter>('this_week')
  const [projectId, setProjectId] = useState('all')
  const [customRange, setCustomRange] = useState({ start: '', end: '' })
  const [entries, setEntries] = useState<TimeEntryRow[]>([])
  const [projectLookup, setProjectLookup] = useState<Record<string, string>>({})
  const [isLoading, setIsLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const isRangeIncomplete = period === 'custom' && (!customRange.start || !customRange.end)

  const loadAnalytics = useCallback(async () => {
    if (!userId) return

    if (isRangeIncomplete) {
      setEntries([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const { start, end } = getRange(period, customRange.start, customRange.end)

      const { data, error } = await supabase
        .from('time_entries')
        .select('id, client_id, start_time, end_time, hours, status')
        .eq('employee_id', userId)
        .neq('status', 'active')
        .gte('start_time', start.toISOString())
        .lte('start_time', end.toISOString())
        .order('start_time', { ascending: true })

      if (error) throw error

      const rows = (data || []) as TimeEntryRow[]
      setEntries(rows)

      const clientIds = Array.from(new Set(rows.map(entry => entry.client_id).filter(Boolean)))

      if (clientIds.length === 0) {
        setProjectLookup({})
        return
      }

      const { data: clients, error: clientsError } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds)

      if (clientsError) throw clientsError

      const lookup = (clients || []).reduce<Record<string, string>>((acc, client) => {
        acc[client.id] = client.name || 'Unnamed project'
        return acc
      }, {})

      setProjectLookup(lookup)
    } catch (error) {
      console.error('[dashboard analytics] load failed:', error)
      setErrorMessage('Unable to load analytics data. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }, [customRange.end, customRange.start, isRangeIncomplete, period, userId])

  useEffect(() => {
    loadAnalytics()
  }, [loadAnalytics])

  const entriesWithHours = useMemo(() => {
    return entries.map(entry => ({
      ...entry,
      computedHours: toHours(entry)
    }))
  }, [entries])

  const projectOptions = useMemo(() => {
    const map = entriesWithHours.reduce<Record<string, string>>((acc, entry) => {
      const name = projectLookup[entry.client_id] || 'Unnamed project'
      acc[entry.client_id] = name
      return acc
    }, {})

    return Object.entries(map)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [entriesWithHours, projectLookup])

  const filteredEntries = useMemo(() => {
    if (projectId === 'all') return entriesWithHours
    return entriesWithHours.filter(entry => entry.client_id === projectId)
  }, [entriesWithHours, projectId])

  const totalHours = useMemo(
    () => filteredEntries.reduce((sum, entry) => sum + entry.computedHours, 0),
    [filteredEntries]
  )

  const projectBreakdown = useMemo(() => {
    return filteredEntries.reduce<Record<string, { name: string; hours: number }>>((acc, entry) => {
      const name = projectLookup[entry.client_id] || 'Unnamed project'

      if (!acc[entry.client_id]) {
        acc[entry.client_id] = { name, hours: 0 }
      }

      acc[entry.client_id].hours += entry.computedHours
      return acc
    }, {})
  }, [filteredEntries, projectLookup])

  const dailyData = useMemo<WeeklyChartDatum[]>(() => {
    const initial = DAY_LABELS.reduce<Record<string, number>>((acc, label) => {
      acc[label] = 0
      return acc
    }, {})

    const grouped = filteredEntries.reduce<Record<string, number>>((acc, entry) => {
      const date = new Date(entry.start_time)
      const dayIndex = (date.getDay() + 6) % 7
      const label = DAY_LABELS[dayIndex]
      acc[label] = (acc[label] || 0) + entry.computedHours
      return acc
    }, initial)

    return DAY_LABELS.map(label => ({ day: label, hours: Number((grouped[label] || 0).toFixed(2)) }))
  }, [filteredEntries])

  const pieData = useMemo<ProjectPieDatum[]>(() => {
    return Object.values(projectBreakdown).map(project => ({
      name: project.name,
      value: Number(project.hours.toFixed(2))
    }))
  }, [projectBreakdown])

  const topProject = useMemo(() => {
    const values = Object.values(projectBreakdown)
    if (values.length === 0) return null
    return values.reduce((top, current) => (current.hours > top.hours ? current : top), values[0])
  }, [projectBreakdown])

  const projectsWorked = Object.keys(projectBreakdown).length

  return {
    period,
    setPeriod,
    projectId,
    setProjectId,
    customRange,
    setCustomRange,
    isLoading,
    errorMessage,
    isRangeIncomplete,
    projectOptions,
    filteredEntries,
    totalHours,
    topProject,
    projectsWorked,
    dailyData,
    pieData
  }
}
