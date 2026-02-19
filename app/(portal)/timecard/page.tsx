'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { TopNavigation } from '../components/TopNavigation'
import {
  MapPin,
  Play,
  Download,
  FileText,
  AlertCircle,
  CheckCircle,
  MapPinOff,
  Zap
} from 'lucide-react'

interface TimeEntry {
  id: string
  date: string
  dayOfWeek: string
  clockIn: string
  clockOut: string
  totalHours: string
  gpsStatus: 'verified' | 'off-site' | 'pending'
  shiftType: string
}

const TIMESHEET_DATA: TimeEntry[] = [
  {
    id: '1',
    date: 'Fri, Oct 20',
    dayOfWeek: 'Friday',
    clockIn: '08:58 AM',
    clockOut: '05:12 PM',
    totalHours: '8h 14m',
    gpsStatus: 'verified',
    shiftType: 'Full Shift'
  },
  {
    id: '2',
    date: 'Thu, Oct 19',
    dayOfWeek: 'Thursday',
    clockIn: '09:02 AM',
    clockOut: '05:05 PM',
    totalHours: '8h 03m',
    gpsStatus: 'verified',
    shiftType: 'Full Shift'
  },
  {
    id: '3',
    date: 'Wed, Oct 18',
    dayOfWeek: 'Wednesday',
    clockIn: '08:45 AM',
    clockOut: '06:30 PM',
    totalHours: '9h 45m',
    gpsStatus: 'verified',
    shiftType: 'Overtime'
  },
  {
    id: '4',
    date: 'Tue, Oct 17',
    dayOfWeek: 'Tuesday',
    clockIn: '09:15 AM',
    clockOut: '01:00 PM',
    totalHours: '3h 45m',
    gpsStatus: 'off-site',
    shiftType: 'Partial Shift'
  }
]

export default function TimeCardPage() {
  const router = useRouter()
  const [user, setUser] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [currentTime, setCurrentTime] = useState<string>('08:45:21')
  const [isClockedIn, setIsClockedIn] = useState(false)
  const [isClockingIn, setIsClockingIn] = useState(false)
  const [gpsLocation, setGpsLocation] = useState({
    address: '123 Business Parkway, Suite 400',
    city: 'New York, NY 10001',
    accuracy: 'High (< 10m)'
  })

  // Check authentication on mount
  useEffect(() => {
    const checkUser = async () => {
      try {
        const { data } = await supabase.auth.getUser()
        if (!data.user) {
          router.push('/')
        } else {
          setUser(data.user)
        }
      } catch (error) {
        console.error('Auth check failed:', error)
        router.push('/')
      } finally {
        setIsLoading(false)
      }
    }

    checkUser()
  }, [router])

  // Real-time clock update
  useEffect(() => {
    const updateClock = () => {
      const now = new Date()
      const hours = String(now.getHours()).padStart(2, '0')
      const minutes = String(now.getMinutes()).padStart(2, '0')
      const seconds = String(now.getSeconds()).padStart(2, '0')
      setCurrentTime(`${hours}:${minutes}:${seconds}`)
    }

    updateClock()
    const interval = setInterval(updateClock, 1000)

    return () => clearInterval(interval)
  }, [])

  // Get current time period (AM/PM)
  const getTimePeriod = () => {
    const hour = parseInt(currentTime.split(':')[0])
    return hour >= 12 ? 'PM' : 'AM'
  }

  // Request location (mock GPS)
  const requestGPSLocation = async (): Promise<{ latitude: number; longitude: number }> => {
    return new Promise((resolve) => {
      if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setGpsLocation({
              address: '123 Business Parkway, Suite 400',
              city: 'New York, NY 10001',
              accuracy: `High (${Math.round(position.coords.accuracy)}m)`
            })
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude
            })
          },
          () => {
            // Fallback if GPS denied
            resolve({ latitude: 40.7128, longitude: -74.006 })
          }
        )
      } else {
        resolve({ latitude: 40.7128, longitude: -74.006 })
      }
    })
  }

  // Handle clock-in
  const handleStartShift = async () => {
    setIsClockingIn(true)
    try {
      const gpsCoords = await requestGPSLocation()

      // Prepare timecard entry (ready for Supabase insert)
      const timecardEntry = {
        user_id: user?.id,
        clock_in_time: new Date().toISOString(),
        gps_lat: gpsCoords.latitude,
        gps_lng: gpsCoords.longitude,
        gps_accuracy: gpsLocation.accuracy,
        status: 'active'
      }

      // TODO: Replace with actual Supabase insert
      // const { error } = await supabase
      //   .from('timecards')
      //   .insert([timecardEntry])
      //
      // if (error) throw error

      console.log('Clock-in entry:', timecardEntry)
      setIsClockedIn(true)
    } catch (error) {
      console.error('Clock-in failed:', error)
      alert('Failed to clock in. Please try again.')
    } finally {
      setIsClockingIn(false)
    }
  }

  // Handle clock-out
  const handleEndShift = async () => {
    setIsClockingIn(true)
    try {
      // TODO: Replace with actual Supabase update
      // const { error } = await supabase
      //   .from('timecards')
      //   .update({ clock_out_time: new Date().toISOString(), status: 'completed' })
      //   .eq('user_id', user?.id)
      //   .is('clock_out_time', null)
      //
      // if (error) throw error

      console.log('Clock-out recorded')
      setIsClockedIn(false)
    } catch (error) {
      console.error('Clock-out failed:', error)
      alert('Failed to clock out. Please try again.')
    } finally {
      setIsClockingIn(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-background-light">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-slate-600 font-medium">Loading timecard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <TopNavigation user={user} />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Breadcrumb */}
        <div className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span>NBE Portal</span>
            <span className="text-[10px]">›</span>
            <span className="text-slate-600 font-medium">Timecard & GPS Tracking</span>
          </div>
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            System Online
          </div>
        </div>

        {/* Main Content */}
        <div className="p-8 space-y-8 max-w-[1600px] mx-auto w-full flex-1 overflow-y-auto">
        {/* Clock In/Out Section and Map */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Clock In/Out Card */}
          <div className="lg:col-span-4 bg-white rounded-xl shadow-sm border border-slate-200 p-8 flex flex-col items-center justify-center text-center">
            <div className="mb-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-400 animate-pulse"></span>
              {isClockedIn ? 'CLOCKED IN' : 'NOT CLOCKED IN'}
            </div>

            <div className="text-6xl font-black tracking-tight mb-1 text-slate-900 tabular-nums font-mono">
              {currentTime}
            </div>

            <div className="text-sm text-slate-400 mb-8 uppercase tracking-[0.2em] font-bold">
              {getTimePeriod()}
            </div>

            <button
              onClick={isClockedIn ? handleEndShift : handleStartShift}
              disabled={isClockingIn}
              className={`w-full font-bold py-4 rounded-xl transition-all shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] ${
                isClockedIn
                  ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20 text-white'
                  : 'bg-primary hover:bg-blue-700 shadow-primary/20 text-white'
              } ${isClockingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Play size={20} />
              {isClockingIn ? 'Processing...' : isClockedIn ? 'END SHIFT' : 'START SHIFT'}
            </button>

            <p className="mt-6 text-xs text-slate-400 italic flex items-center gap-1.5">
              <AlertCircle size={14} />
              Your GPS location will be recorded upon clock-in.
            </p>
          </div>

          {/* Location Map Card */}
          <div className="lg:col-span-8 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center">
              <div className="flex items-center gap-2">
                <MapPin size={20} className="text-primary" />
                <h3 className="font-bold text-sm">Current Location</h3>
              </div>
              <div className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Accuracy: {gpsLocation.accuracy}
              </div>
            </div>

            {/* Map Container */}
            <div
              className="flex-1 min-h-[300px] relative bg-cover bg-center"
              style={{
                backgroundImage:
                  'url(https://lh3.googleusercontent.com/aida-public/AB6AXuAWpVWtJg_TQse42MREOxpH1BYYtOzf-kK98_alUQMV12G4CSqI8a4Em-lGg_L-paJIwwNk6tqt3W6BfoVWo4E8yY49sW2NjBPK9SKhzi3WL5ZwnuEaxxDp4-1kH_qAPeDECIpwvzoTPKVcTjIGz98bVyJyK5Zu7Ca3csw2yZUJgedORSZmL6Qs-R2SXOwv5v4B9kkfomFSJrPniPlbjra49UlitdPmZpXZfBjLqNsi_TX8rCYIRN86AkTVT93J-ipAU_GTxjgL4Q)'
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative">
                  <div className="w-12 h-12 bg-primary/20 rounded-full animate-ping absolute -top-3 -left-3"></div>
                  <div className="w-6 h-6 bg-primary border-4 border-white rounded-full shadow-xl relative z-10"></div>
                </div>
              </div>

              {/* Address Card */}
              <div className="absolute bottom-6 left-6 bg-white/95 backdrop-blur-sm p-4 rounded-xl shadow-xl border border-slate-200 max-w-xs">
                <p className="text-[10px] text-primary font-black uppercase tracking-widest mb-1">
                  Current Address
                </p>
                <p className="text-sm font-bold text-slate-900">{gpsLocation.address}</p>
                <p className="text-xs text-slate-500 font-medium">{gpsLocation.city}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Timesheet Table */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {/* Header */}
          <div className="px-8 py-6 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                Weekly Timesheet
                <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded">
                  Active Period
                </span>
              </h2>
              <p className="text-sm text-slate-500">Week of October 23, 2023</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-slate-200 text-sm font-bold rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-2">
                <Download size={16} />
                Export PDF
              </button>
              <button className="px-4 py-2 bg-primary/10 text-primary text-sm font-bold rounded-lg hover:bg-primary/20 transition-colors flex items-center gap-2">
                <FileText size={16} />
                Request Correction
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Date
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Clock-In
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Clock-Out
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                    Total Hours
                  </th>
                  <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">
                    GPS Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {TIMESHEET_DATA.map(entry => (
                  <tr
                    key={entry.id}
                    className="hover:bg-slate-50/50 transition-colors group"
                  >
                    <td className="px-8 py-5">
                      <p className="font-bold text-sm group-hover:text-primary transition-colors">
                        {entry.date}
                      </p>
                      <p className="text-xs text-slate-500">{entry.shiftType}</p>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium tabular-nums">{entry.clockIn}</td>
                    <td className="px-8 py-5 text-sm font-medium tabular-nums">{entry.clockOut}</td>
                    <td className="px-8 py-5 text-center">
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold tabular-nums ${
                          entry.shiftType === 'Overtime'
                            ? 'bg-primary/10 text-primary'
                            : 'bg-slate-100 text-slate-900'
                        }`}
                      >
                        {entry.totalHours}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border ${
                          entry.gpsStatus === 'verified'
                            ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                            : entry.gpsStatus === 'off-site'
                            ? 'bg-amber-50 text-amber-600 border-amber-100'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {entry.gpsStatus === 'verified' && <CheckCircle size={14} />}
                        {entry.gpsStatus === 'off-site' && <MapPinOff size={14} />}
                        {entry.gpsStatus === 'pending' && <AlertCircle size={14} />}
                        <span className="text-[11px] font-bold uppercase tracking-tight">
                          {entry.gpsStatus === 'verified' && 'Verified'}
                          {entry.gpsStatus === 'off-site' && 'Off-site'}
                          {entry.gpsStatus === 'pending' && 'Pending'}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="px-8 py-5 bg-slate-50 flex justify-between items-center border-t border-slate-200">
            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
              Showing {TIMESHEET_DATA.length} records for the current week
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Total Week Hours:</span>
              <span className="text-sm font-black text-slate-900">29h 47m</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  )
}
