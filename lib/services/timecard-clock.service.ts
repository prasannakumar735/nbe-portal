// Timecard Clock In/Out Service
// Handles GPS-based clock tracking with Supabase

import { supabase } from '../supabase'

export interface TimecardRecord {
  id: string
  user_id: string
  clock_in_time: string
  clock_out_time: string | null
  clock_in_gps_lat?: number | null
  clock_in_gps_lng?: number | null
  clock_out_gps_lat?: number | null
  clock_out_gps_lng?: number | null
  gps_accuracy?: number | null
  status: 'active' | 'completed' | 'cancelled'
  created_at: string
  updated_at?: string
}

export interface GPSCoordinates {
  latitude: number
  longitude: number
  accuracy: number
}

// ============================================
// WEEK RANGE LABEL (for UI display)
// ============================================
export function getWeekRangeLabel(): string {
  const today = new Date()
  const day = today.getDay()
  const diffToMonday = day === 0 ? -6 : 1 - day

  const monday = new Date(today)
  monday.setDate(today.getDate() + diffToMonday)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)

  const format = (date: Date) =>
    date.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    })

  return `Week of ${format(monday)} – ${format(sunday)}`
}

// ============================================
// ACTIVE SHIFT
// ============================================
export async function getActiveShift(userId: string): Promise<TimecardRecord | null> {
  if (!userId) {
    console.error('[getActiveShift] userId is required but received:', userId)
    return null
  }
  const { data, error } = await supabase
    .from('timecards')
    .select('*')
    .eq('user_id', userId)
    .is('clock_out_time', null)
    .maybeSingle()

  if (error) {
    console.error('Supabase error in getActiveShift:', error)
    throw error
  }

  return data
}

// ============================================
// WEEKLY TIMECARDS
// ============================================
export async function getWeeklyTimecards(userId: string): Promise<TimecardRecord[]> {
  if (!userId) {
    console.error('[getWeeklyTimecards] userId is required but received:', userId)
    return []
  }
  const { weekStart, weekEnd } = getCurrentWeekRange()

  const { data, error } = await supabase
    .from('timecards')
    .select('*')
    .eq('user_id', userId)
    .gte('clock_in_time', weekStart)
    .lte('clock_in_time', weekEnd)
    .order('clock_in_time', { ascending: false })

  if (error) throw error

  return data || []
}

// ============================================
// CLOCK IN
// ============================================
export async function clockIn(
  userId: string,
  gps: { latitude: number; longitude: number; accuracy: string }
): Promise<TimecardRecord> {
  const { data, error } = await supabase
    .from('timecards')
    .insert([
      {
        user_id: userId,
        clock_in_time: new Date().toISOString(),
        clock_out_time: null,
        gps_lat: gps.latitude,
        gps_lng: gps.longitude,
        gps_accuracy: gps.accuracy,
        status: 'active'
      }
    ])
    .select()
    .single()

  if (error) {
    console.error('Supabase error in clockIn:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    throw error
  }

  return data
}

// ============================================
// CLOCK OUT
// ============================================
export async function clockOut(userId: string): Promise<TimecardRecord> {
  if (!userId) {
    console.error('[clockOut] userId is required but received:', userId)
    throw new Error('User id is required to clock out')
  }
  const { data, error } = await supabase
    .from('timecards')
    .update({
      clock_out_time: new Date().toISOString(),
      status: 'completed' as const
    })
    .eq('user_id', userId)
    .eq('status', 'active')
    .select()
    .is('clock_out_time', null)
    .maybeSingle()

  if (error) {
    console.error('Supabase error in clockOut:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    })
    throw error
  }

  if (!data) {
    throw new Error('No active shift found to clock out.')
  }

  return data
}

// ============================================
// HELPER: GET CURRENT WEEK RANGE (MONDAY-SUNDAY)
// ============================================
function getCurrentWeekRange(): { weekStart: string; weekEnd: string } {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday

  const monday = new Date(now)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)

  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)

  return {
    weekStart: monday.toISOString(),
    weekEnd: sunday.toISOString()
  }
}

// ============================================
// HELPER: CALCULATE DURATION
// ============================================
export function calculateDuration(
  clockIn: string,
  clockOut: string | null
): { hours: number; minutes: number; totalMinutes: number } {
  if (!clockOut) {
    return { hours: 0, minutes: 0, totalMinutes: 0 }
  }

  const start = new Date(clockIn)
  const end = new Date(clockOut)
  const totalMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60))
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return { hours, minutes, totalMinutes }
}

// ============================================
// HELPER: FORMAT TIME (24h to 12h with AM/PM)
// ============================================
export function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
  let hours = date.getHours()
  const minutes = date.getMinutes()
  const ampm = hours >= 12 ? 'PM' : 'AM'
  
  hours = hours % 12
  hours = hours ? hours : 12 // 0 becomes 12
  
  const minutesStr = minutes.toString().padStart(2, '0')
  
  return `${hours}:${minutesStr} ${ampm}`
}

// ============================================
// HELPER: FORMAT DATE
// ============================================
export function formatDate(timestamp: string): string {
  const date = new Date(timestamp)
  const options: Intl.DateTimeFormatOptions = { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric' 
  }
  return date.toLocaleDateString('en-US', options)
}

// ============================================
// HELPER: GET DAY OF WEEK
// ============================================
export function getDayOfWeek(timestamp: string): string {
  const date = new Date(timestamp)
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  return days[date.getDay()]
}

// ============================================
// HELPER: DETERMINE SHIFT TYPE
// ============================================
export function determineShiftType(totalMinutes: number): string {
  const hours = totalMinutes / 60

  if (hours > 8) return 'Overtime'
  if (hours < 4) return 'Partial Shift'
  return 'Full Shift'
}

// ============================================
// HELPER: FORMAT DURATION AS STRING
// ============================================
export function formatDuration(hours: number, minutes: number): string {
  return `${hours}h ${minutes}m`
}

// ============================================
// HELPER: CALCULATE WEEKLY TOTAL
// ============================================
export function calculateWeeklyTotal(timecards: TimecardRecord[]): string {
  let totalMinutes = 0

  timecards.forEach(card => {
    if (card.clock_out_time) {
      const duration = calculateDuration(card.clock_in_time, card.clock_out_time)
      totalMinutes += duration.totalMinutes
    }
  })

  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60

  return formatDuration(hours, minutes)
}
